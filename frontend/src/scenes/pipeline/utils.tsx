import { LemonButton } from 'lib/lemon-ui/LemonButton/LemonButton'
import { urls } from 'scenes/urls'
import { singularName } from './pipelineLogic'
import { PipelineTabs } from '~/types'

export function newButton(tab: PipelineTabs): JSX.Element {
    const singular = singularName(tab)
    return (
        <LemonButton data-attr={`new-${singular}`} to={urls.pipelineNew(tab)} type="primary">
            New {singular}
        </LemonButton>
    )
}