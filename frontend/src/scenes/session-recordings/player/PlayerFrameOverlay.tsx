import { useActions, useValues } from 'kea'
import {
    sessionRecordingPlayerLogic,
    SessionRecordingPlayerLogicProps,
} from 'scenes/session-recordings/player/sessionRecordingPlayerLogic'
import { SessionPlayerState, SessionRecordingType } from '~/types'
import { IconErrorOutline, IconPlay } from 'lib/lemon-ui/icons'
import { LemonButton } from 'lib/lemon-ui/LemonButton'
import './PlayerFrameOverlay.scss'
import { PlayerUpNext } from './PlayerUpNext'
import { useState } from 'react'
import { sessionRecordingAnnotationLogic } from 'scenes/session-recordings/player/sessionRecordingAnnotationsLogic'

export interface PlayerFrameOverlayProps extends SessionRecordingPlayerLogicProps {
    nextSessionRecording?: Partial<SessionRecordingType>
}

const PlayerFrameOverlayContent = ({
    currentPlayerState,
}: {
    currentPlayerState: SessionPlayerState
}): JSX.Element | null => {
    let content = null
    if (currentPlayerState === SessionPlayerState.ERROR) {
        content = (
            <div className="flex flex-col justify-center items-center p-6 bg-white rounded m-6 gap-2 max-w-120 shadow">
                <IconErrorOutline className="text-danger text-5xl" />
                <div className="font-bold text-default text-lg">We're unable to play this recording</div>
                <div className="text-muted text-sm text-center">
                    An error occurred that is preventing this recording from being played. You can refresh the page to
                    reload the recording.
                </div>
                <LemonButton
                    onClick={() => {
                        window.location.reload()
                    }}
                    type="primary"
                    fullWidth
                    center
                >
                    Reload
                </LemonButton>
                <LemonButton
                    targetBlank
                    to="https://posthog.com/support?utm_medium=in-product&utm_campaign=recording-not-found"
                    type="secondary"
                    fullWidth
                    center
                >
                    Contact support
                </LemonButton>
            </div>
        )
    }
    if (currentPlayerState === SessionPlayerState.BUFFER) {
        content = <div className="text-4xl text-white">Buffering...</div>
    }
    if (currentPlayerState === SessionPlayerState.PAUSE || currentPlayerState === SessionPlayerState.READY) {
        content = <IconPlay className="text-6xl text-white" />
    }
    if (currentPlayerState === SessionPlayerState.SKIP) {
        content = <div className="text-4xl text-white">Skipping inactivity</div>
    }
    return content ? <div className="PlayerFrameOverlay__content">{content}</div> : null
}

export function PlayerFrameOverlay(): JSX.Element {
    const { currentPlayerState, logicProps, sessionPlayerData } = useValues(sessionRecordingPlayerLogic)
    const { togglePlayPause } = useActions(sessionRecordingPlayerLogic)

    const annotationsLogic = sessionRecordingAnnotationLogic(logicProps)
    const { annotations } = useValues(annotationsLogic)
    console.log({ annotations })

    const [interrupted, setInterrupted] = useState(false)

    return (
        <div
            className="PlayerFrameOverlay"
            onClick={togglePlayPause}
            onMouseMove={() => setInterrupted(true)}
            onMouseOut={() => setInterrupted(false)}
        >
            <PlayerFrameOverlayContent currentPlayerState={currentPlayerState} />
            <PlayerUpNext interrupted={interrupted} clearInterrupted={() => setInterrupted(false)} />
            {annotations ? (
                <div className={'h-4 w-full absolute text-xl'} style={{ bottom: '8px' }}>
                    {annotations.map((a, i) => {
                        if (a.recording_timestamp === null || a.recording_timestamp === undefined) {
                            return null
                        }
                        const left = (a.recording_timestamp / sessionPlayerData.durationMs) * 100
                        return (
                            // eslint-disable-next-line react/forbid-dom-props
                            <span
                                key={i}
                                className={'absolute RecordingAnnotation rounded p-1'}
                                style={{
                                    left: `${left}%`,
                                }}
                            >
                                {a.content}
                            </span>
                        )
                    })}
                </div>
            ) : null}
        </div>
    )
}
