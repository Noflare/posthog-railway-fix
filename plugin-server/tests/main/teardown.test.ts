import Piscina from '@posthog/piscina'
import { PluginEvent } from '@posthog/plugin-scaffold'

import { startPluginsServer } from '../../src/main/pluginsServer'
import { LogLevel, PluginConfig } from '../../src/types'
import { delay } from '../../src/utils/utils'
import { makePiscina } from '../../src/worker/piscina'
import { getErrorForPluginConfig, resetTestDatabase } from '../helpers/sql'

jest.mock('../../src/utils/status')
jest.setTimeout(60000) // 60 sec timeout

const defaultEvent = {
    uuid: '00000000-0000-0000-0000-000000000000',
    distinct_id: 'my_id',
    ip: '127.0.0.1',
    site_url: 'http://localhost',
    now: new Date().toISOString(),
    event: 'default event',
    properties: { key: 'value' },
}

let pluginConfig39: PluginConfig
let teamId: number

describe('teardown', () => {
    const processEvent = async (piscina: Piscina, event: PluginEvent) => {
        const result = await piscina.run({ task: 'runEventPipeline', args: { event } })
        const resultEvent = result.args[0]
        return resultEvent
    }

    test('teardown code runs when stopping', async () => {
        ;({ pluginConfig: pluginConfig39, teamId } = await resetTestDatabase(`
            async function processEvent (event) {
                event.properties.processed = 'hell yes'
                event.properties.upperUuid = event.properties.uuid?.toUpperCase()
                return event
            }
            async function teardownPlugin() {
                throw new Error('This Happened In The Teardown Palace')
            }
        `))
        const { piscina, stop } = await startPluginsServer(
            {
                WORKER_CONCURRENCY: 1,
                LOG_LEVEL: LogLevel.Log,
            },
            makePiscina
        )

        const error1 = await getErrorForPluginConfig(pluginConfig39.id)
        expect(error1).toBe(null)

        await processEvent(piscina, { ...defaultEvent, team_id: teamId })

        await stop()

        // verify the teardownPlugin code runs
        const error2 = await getErrorForPluginConfig(pluginConfig39.id)
        expect(error2.message).toBe('This Happened In The Teardown Palace')
    })

    test('no need to tear down if plugin was never setup', async () => {
        ;({ pluginConfig: pluginConfig39, teamId } = await resetTestDatabase(`
            async function processEvent (event) {
                event.properties.processed = 'hell yes'
                event.properties.upperUuid = event.properties.uuid?.toUpperCase()
                return event
            }
            async function teardownPlugin() {
                throw new Error('This Happened In The Teardown Palace')
            }
        `))
        const { stop } = await startPluginsServer(
            {
                WORKER_CONCURRENCY: 1,
                LOG_LEVEL: LogLevel.Log,
            },
            makePiscina
        )

        const error1 = await getErrorForPluginConfig(pluginConfig39.id)
        expect(error1).toBe(null)

        await stop()

        // verify the teardownPlugin code doesn't run, because processEvent was never called
        // and thus the plugin was never setup - see LazyVM
        const error2 = await getErrorForPluginConfig(pluginConfig39.id)
        expect(error2).toBe(null)
    })

    test('teardown code runs when reloading', async () => {
        ;({ pluginConfig: pluginConfig39, teamId } = await resetTestDatabase(`
            async function processEvent (event, meta) {
                event.properties.storage = await meta.storage.get('storage', 'nope')
                return event
            }
            async function teardownPlugin(meta) {
                await meta.storage.set('storage', 'tore down')
            }
        `))
        const { piscina, stop, hub } = await startPluginsServer(
            {
                WORKER_CONCURRENCY: 1,
                LOG_LEVEL: LogLevel.Log,
            },
            makePiscina
        )

        const error1 = await getErrorForPluginConfig(pluginConfig39.id)
        expect(error1).toBe(null)

        await delay(100)

        await hub.db.postgresQuery(
            'update posthog_pluginconfig set updated_at = now() where id = $1',
            [pluginConfig39.id],
            'testTag'
        )
        const event1 = await processEvent(piscina, { ...defaultEvent, team_id: teamId })
        expect(event1.properties.storage).toBe('nope')

        await piscina!.broadcastTask({ task: 'reloadPlugins' })
        await delay(10000)

        // const event2 = await piscina!.run({ task: 'runEventPipeline', args: { event: { ...defaultEvent } } })
        const event2 = await processEvent(piscina, { ...defaultEvent, team_id: teamId })
        expect(event2.properties.storage).toBe('tore down')

        await stop()
    })
})
