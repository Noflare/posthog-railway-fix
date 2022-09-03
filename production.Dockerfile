# syntax=docker/dockerfile:1.4
#
# This Dockerfile is used for self-hosted production builds.
#
# Note: for 'posthog/posthog-cloud' remember to update 'prod.web.Dockerfile' as appropriate
#

#
# Build the frontend artifacts
#
FROM node:16.15-alpine3.14 AS frontend

WORKDIR /code

COPY package.json yarn.lock ./
RUN yarn config set network-timeout 300000 && \
    yarn install --frozen-lockfile

COPY frontend/ frontend/
COPY ./bin/copy-scripts-recorder ./bin/
COPY babel.config.js tsconfig.json webpack.config.js ./
RUN yarn build

#
# Build the plugin-server artifacts. Note that we still need to install the
# runtime deps in the main image
#
FROM node:16.15-alpine3.14 AS plugin-server

WORKDIR /code/plugin-server


# Compile and install Yarn dependencies.
#
# Notes:
#
# - we explicitly COPY the files so that we don't need to rebuild
#   the container every time a dependency changes
# - Install python, make and gcc as they are needed for the yarn install. We do
#   this as one layer to reduce the layer sizes should we need to pull these for
#   subsequent opperations.
COPY ./plugin-server/package.json ./plugin-server/yarn.lock ./plugin-server/tsconfig.json ./
RUN apk --update --no-cache add \
    --virtual .install-deps \
    "make~=4.3" \
    "g++~=10.3" \
    "gcc~=10.3" \
    "python3~=3.9" && \
    yarn config set network-timeout 300000 && \
    yarn install --frozen-lockfile && \
    apk del .install-deps

# Build the plugin server
#
# Note: we run the build as a separate actions to increase
# the cache hit ratio of the layers above.
COPY ./plugin-server/src/ ./src/
RUN yarn build

# Build the posthog image, incorporating the Django app along with the frontend,
# as well as the plugin-server
FROM python:3.8.12-alpine3.14

ENV PYTHONUNBUFFERED 1

WORKDIR /code

# Install OS dependencies needed to run PostHog
#
# Note: please add in this section runtime dependences only.
# If you temporary need a package to build a Python or npm
# dependency take a look at the sections below.
RUN apk --update --no-cache add \
    "libpq~=13" \
    "libxslt~=1.1" \
    "nodejs-current~=16" \
    "chromium~=93" \
    "chromium-chromedriver~=93" \
    "xmlsec~=1.2"

# Curl the GeoLite2-City database that will be used for IP geolocation within Django 
#
# Notes:
#
# - We are doing this here because it makes sense to ensure the stack will work
#   even if the database is not available at the time of boot.
#   It's better here to fail at build then it is to fail at boot time.

RUN apk --update --no-cache --virtual .geolite-deps add \
    "curl~=7" \
    "brotli~=1.0.9" \
    && \
    mkdir share \
    && \
    ( curl -L "https://mmdbcdn.posthog.net/" | brotli --decompress --output=./share/GeoLite2-City.mmdb ) \
    && \
    chmod -R 755 ./share/GeoLite2-City.mmdb \
    && \
    apk del .geolite-deps


# Compile and install Python dependencies.
#
# Notes:
#
# - we explicitly COPY the files so that we don't need to rebuild
#   the container every time a dependency changes
#
# - we need few additional OS packages for this. Let's install
#   and then uninstall them when the compilation is completed.
COPY requirements.txt ./
RUN apk --update --no-cache --virtual .build-deps add \
    "bash~=5.1" \
    "g++~=10.3" \
    "gcc~=10.3" \
    "cargo~=1.52" \
    "git~=2" \
    "make~=4.3" \
    "libffi-dev~=3.3" \
    "libxml2-dev~=2.9" \
    "libxslt-dev~=1.1" \
    "xmlsec-dev~=1.2" \
    "postgresql-dev~=13" \
    "libmaxminddb~=1.5" \
    && \
    pip install -r requirements.txt --compile --no-cache-dir \
    && \
    apk del .build-deps

RUN addgroup -S posthog && \
    adduser -S posthog -G posthog

RUN chown posthog.posthog /code

# Add in Django deps and generate Django's static files
COPY manage.py manage.py
COPY posthog posthog/
COPY ee ee/

# NOTE: given we have to run ./manage.py collectstatic, the --link isn't much
# use here as it will need to pull down layer dependecies at that point, but I'm
# leaving it in if only to highlight that there is a possible gain to be had if
# we can remove that dependency.
COPY --from=frontend --link /code/frontend/dist /code/frontend/dist
RUN SKIP_SERVICE_VERSION_REQUIREMENTS=1 SECRET_KEY='unsafe secret key for collectstatic only' DATABASE_URL='postgres:///' REDIS_URL='redis:///' python manage.py collectstatic --noinput

# Add in the compiled plugin-server
COPY --from=plugin-server --link /code/plugin-server/dist/ ./plugin-server/dist/

# We need bash to run the bin scripts
COPY --link ./bin ./bin/

ENV CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/ \
    CHROMEDRIVER_BIN=/usr/bin/chromedriver

COPY --link gunicorn.config.py ./

USER posthog


# Expose container port and run entry point script
EXPOSE 8000

# Expose the port from which we serve OpenMetrics data
EXPOSE 8001

CMD ["./bin/docker"]
