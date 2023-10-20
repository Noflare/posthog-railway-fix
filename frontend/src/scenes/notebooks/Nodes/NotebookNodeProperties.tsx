import { NotebookNodeType } from '~/types'
import { createPostHogWidgetNode } from 'scenes/notebooks/Nodes/NodeWrapper'
import { LemonLabel, LemonSkeleton } from '@posthog/lemon-ui'
import { PropertyKeyInfo } from 'lib/components/PropertyKeyInfo'
import { PropertiesTable } from 'lib/components/PropertiesTable'
import { useValues } from 'kea'
import { personLogic } from 'scenes/persons/personLogic'
import { NotebookNodeProps } from '../Notebook/utils'
import { NotFound } from 'lib/components/NotFound'

const Component = ({ attributes }: NotebookNodeProps<NotebookNodePropertiesAttributes>): JSX.Element => {
    const { id } = attributes

    const logic = personLogic({ id })
    const { person, personLoading } = useValues(logic)

    if (personLoading) {
        return <LemonSkeleton className="h-6" />
    } else if (!person) {
        return <NotFound object="person" />
    }

    const numProperties = Object.keys(person.properties).length

    return (
        <div className="py-2 px-4 text-xs">
            {Object.entries(person.properties).map(([key, value], index) => {
                const isLast = index === numProperties - 1

                return (
                    <div key={key} className="mb-1">
                        <LemonLabel className="leading-4">
                            <PropertyKeyInfo value={key} />
                        </LemonLabel>
                        <div className={`${!isLast && 'border-b border-border-light pb-1'}`}>
                            <PropertiesTable properties={value} rootKey={key} />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

type NotebookNodePropertiesAttributes = {
    id: string
}

export const NotebookNodeProperties = createPostHogWidgetNode({
    nodeType: NotebookNodeType.Properties,
    titlePlaceholder: 'Properties',
    Component,
    resizeable: true,
    expandable: false,
    attributes: {
        id: {},
    },
})
