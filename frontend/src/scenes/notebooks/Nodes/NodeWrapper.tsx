import {
    Node,
    NodeViewWrapper,
    mergeAttributes,
    ReactNodeViewRenderer,
    ExtendedRegExpMatchArray,
    Attribute,
    NodeViewProps,
    getExtensionField,
} from '@tiptap/react'
import { memo, useCallback, useRef } from 'react'
import clsx from 'clsx'
import {
    IconClose,
    IconDragHandle,
    IconFilter,
    IconLink,
    IconPlusMini,
    IconUnfoldLess,
    IconUnfoldMore,
} from 'lib/lemon-ui/icons'
import { LemonButton } from '@posthog/lemon-ui'
import './NodeWrapper.scss'
import { LemonSkeleton } from 'lib/lemon-ui/LemonSkeleton'
import { BindLogic, useActions, useMountedLogic, useValues } from 'kea'
import { notebookLogic } from '../Notebook/notebookLogic'
import { useInView } from 'react-intersection-observer'
import { NotebookNodeResource, NotebookNodeType } from '~/types'
import { ErrorBoundary } from '~/layout/ErrorBoundary'
import { NotebookNodeContext, NotebookNodeLogicProps, notebookNodeLogic } from './notebookNodeLogic'
import { posthogNodePasteRule, useSyncedAttributes } from './utils'
import {
    NotebookNodeAttributes,
    NotebookNodeProps,
    CustomNotebookNodeAttributes,
    NotebookNodeSettings,
} from '../Notebook/utils'
import { useWhyDidIRender } from 'lib/hooks/useWhyDidIRender'
import { NotebookNodeTitle } from './components/NotebookNodeTitle'
import { notebookNodeLogicType } from './notebookNodeLogicType'

// TODO: fix the typing of string to NotebookNodeType
const KNOWN_NODES: Record<string, CreatePostHogWidgetNodeOptions<any>> = {}

export interface NodeWrapperProps<T extends CustomNotebookNodeAttributes> {
    nodeType: NotebookNodeType
    Component: (props: NotebookNodeProps<T>) => JSX.Element | null

    // Meta properties - these should never be too advanced - more advanced should be done via updateAttributes in the component
    titlePlaceholder: string
    href?: string | ((attributes: NotebookNodeAttributes<T>) => string | undefined)

    // Sizing
    expandable?: boolean
    startExpanded?: boolean
    resizeable?: boolean | ((attributes: CustomNotebookNodeAttributes) => boolean)
    heightEstimate?: number | string
    minHeight?: number | string
    /** If true the metadata area will only show when hovered if in editing mode */
    autoHideMetadata?: boolean
    /** Expand the node if the component is clicked */
    expandOnClick?: boolean
    settings?: NotebookNodeSettings

    /** get the position in the notebook. If not set, we assume this is a side widget. TODO - make this more explicit */
    getPos?: () => number
}

function NodeWrapper<T extends CustomNotebookNodeAttributes>(
    props: NodeWrapperProps<T> & NotebookNodeProps<T> & Pick<NodeViewProps, 'selected'>
): JSX.Element {
    const {
        titlePlaceholder,
        nodeType,
        Component,
        selected,
        href,
        heightEstimate = '4rem',
        resizeable: resizeableOrGenerator = true,
        startExpanded = false,
        expandable = true,
        expandOnClick = true,
        autoHideMetadata = false,
        minHeight,
        getPos,
        attributes,
        updateAttributes,
        settings = null,
    } = props

    useWhyDidIRender('NodeWrapper.props', props)

    const mountedNotebookLogic = useMountedLogic(notebookLogic)
    const { isEditable, editingNodeId } = useValues(notebookLogic)

    // nodeId can start null, but should then immediately be generated
    const nodeId = attributes.nodeId
    const nodeLogicProps: NotebookNodeLogicProps = {
        nodeType,
        attributes,
        updateAttributes,
        nodeId,
        notebookLogic: mountedNotebookLogic,
        getPos,
        resizeable: resizeableOrGenerator,
        settings,
        startExpanded,
        titlePlaceholder,
    }
    const nodeLogic = useMountedLogic(notebookNodeLogic(nodeLogicProps))
    const { resizeable, expanded, actions } = useValues(nodeLogic)
    const { setExpanded, deleteNode, toggleEditing, insertOrSelectNextLine } = useActions(nodeLogic)

    useWhyDidIRender('NodeWrapper.logicProps', {
        resizeable,
        expanded,
        actions,
        setExpanded,
        deleteNode,
        toggleEditing,
        mountedNotebookLogic,
    })

    const [ref, inView] = useInView({ triggerOnce: true })
    const contentRef = useRef<HTMLDivElement | null>(null)

    // If resizeable is true then the node attr "height" is required
    const height = attributes.height ?? heightEstimate

    const onResizeStart = useCallback((): void => {
        if (!resizeable) {
            return
        }
        const initialHeightAttr = contentRef.current?.style.height
        const onResizedEnd = (): void => {
            window.removeEventListener('mouseup', onResizedEnd)
            // css resize sets the style attr so we check that to detect changes. Resize obsserver doesn't trigger for style changes
            const heightAttr = contentRef.current?.style.height
            if (heightAttr && heightAttr !== initialHeightAttr) {
                updateAttributes({
                    height: contentRef.current?.clientHeight,
                } as any)
            }
        }

        window.addEventListener('mouseup', onResizedEnd)
    }, [resizeable, updateAttributes])

    const onActionsAreaClick = (): void => {
        // Clicking in the area of the actions without selecting a specific action likely indicates the user wants to
        // add new content below. If we are in editing mode, we should select the next line if there is one, otherwise
        insertOrSelectNextLine()
        // setTextSelection(getPos() + 1)
    }

    const parsedHref = typeof href === 'function' ? href(attributes) : href

    // Element is resizable if resizable is set to true. If expandable is set to true then is is only resizable if expanded is true
    const isResizeable = resizeable && (!expandable || expanded)
    const isDraggable = !!(isEditable && getPos)
    const isWidget = !getPos

    return (
        <NotebookNodeContext.Provider value={nodeLogic}>
            <BindLogic logic={notebookNodeLogic} props={nodeLogicProps}>
                <NodeViewWrapper as="div">
                    <div
                        ref={ref}
                        className={clsx(nodeType, 'NotebookNode', {
                            'NotebookNode--selected': isEditable && selected,
                            'NotebookNode--auto-hide-metadata': autoHideMetadata,
                            'NotebookNode--has-actions': getPos && isEditable && actions.length,
                        })}
                    >
                        <div className="NotebookNode__box">
                            <ErrorBoundary>
                                {!inView ? (
                                    <>
                                        <div className="h-4" /> {/* Placeholder for the drag handle */}
                                        {/* eslint-disable-next-line react/forbid-dom-props */}
                                        <div style={{ height: heightEstimate }}>
                                            <LemonSkeleton className="h-full" />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="NotebookNode__meta" data-drag-handle>
                                            <div className="flex items-center flex-1 overflow-hidden">
                                                {isDraggable && (
                                                    <IconDragHandle className="cursor-move text-base shrink-0" />
                                                )}
                                                <NotebookNodeTitle />
                                            </div>

                                            <div className="flex space-x-1">
                                                {parsedHref && (
                                                    <LemonButton size="small" icon={<IconLink />} to={parsedHref} />
                                                )}

                                                {expandable && (
                                                    <LemonButton
                                                        onClick={() => setExpanded(!expanded)}
                                                        size="small"
                                                        icon={expanded ? <IconUnfoldLess /> : <IconUnfoldMore />}
                                                    />
                                                )}

                                                {!isWidget && isEditable ? (
                                                    <>
                                                        {settings ? (
                                                            <LemonButton
                                                                onClick={() => toggleEditing()}
                                                                size="small"
                                                                icon={<IconFilter />}
                                                                active={editingNodeId === nodeId}
                                                            />
                                                        ) : null}

                                                        <LemonButton
                                                            onClick={() => deleteNode()}
                                                            size="small"
                                                            status="danger"
                                                            icon={<IconClose />}
                                                        />
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div
                                            ref={contentRef}
                                            className={clsx(
                                                'NotebookNode__content flex flex-col relative z-0 overflow-hidden',
                                                isEditable && isResizeable && 'resize-y'
                                            )}
                                            // eslint-disable-next-line react/forbid-dom-props
                                            style={isResizeable ? { height, minHeight } : {}}
                                            onClick={!expanded && expandOnClick ? () => setExpanded(true) : undefined}
                                            onMouseDown={onResizeStart}
                                        >
                                            <Component attributes={attributes} updateAttributes={updateAttributes} />
                                        </div>
                                    </>
                                )}
                            </ErrorBoundary>
                        </div>
                        <div
                            className="NotebookNode__gap"
                            // UX improvement so that the actions don't get in the way of the cursor
                            onClick={() => onActionsAreaClick()}
                        >
                            {!isWidget && isEditable && actions.length ? (
                                <>
                                    {actions.map((x, i) => (
                                        <LemonButton
                                            key={i}
                                            type="secondary"
                                            status="primary"
                                            size="small"
                                            icon={x.icon ?? <IconPlusMini />}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                x.onClick()
                                            }}
                                        >
                                            {x.text}
                                        </LemonButton>
                                    ))}
                                </>
                            ) : null}
                        </div>
                    </div>
                </NodeViewWrapper>
            </BindLogic>
        </NotebookNodeContext.Provider>
    )
}

export const MemoizedNodeWrapper = memo(NodeWrapper) as typeof NodeWrapper

export type CreatePostHogWidgetNodeOptions<T extends CustomNotebookNodeAttributes> = NodeWrapperProps<T> & {
    nodeType: NotebookNodeType
    Component: (props: NotebookNodeProps<T>) => JSX.Element | null
    pasteOptions?: {
        find: string
        getAttributes: (match: ExtendedRegExpMatchArray) => Promise<T | null | undefined> | T | null | undefined
    }
    attributes: Record<keyof T, Partial<Attribute>>
    settings?: NotebookNodeSettings
    serializedText?: (attributes: NotebookNodeAttributes<T>) => string
}

export function createPostHogWidgetNode<T extends CustomNotebookNodeAttributes>(
    options: CreatePostHogWidgetNodeOptions<T>
): Node {
    const { Component, pasteOptions, attributes, serializedText, ...wrapperProps } = options

    KNOWN_NODES[wrapperProps.nodeType] = options

    // NOTE: We use NodeViewProps here as we convert them to NotebookNodeProps
    const WrappedComponent = (props: NodeViewProps): JSX.Element => {
        useWhyDidIRender('NodeWrapper(WrappedComponent)', props)
        const [attributes, updateAttributes] = useSyncedAttributes<T>(props)

        if (props.node.attrs.nodeId === null) {
            // TODO only wrapped in setTimeout because of the flushSync bug
            setTimeout(() => {
                props.updateAttributes({
                    nodeId: attributes.nodeId,
                })
            }, 0)
        }

        const nodeProps: NotebookNodeProps<T> & Omit<NodeViewProps, 'attributes' | 'updateAttributes'> = {
            ...props,
            attributes,
            updateAttributes,
        }

        return <MemoizedNodeWrapper Component={Component} {...nodeProps} {...wrapperProps} />
    }

    return Node.create({
        name: wrapperProps.nodeType,
        group: 'block',
        atom: true,
        draggable: true,

        serializedText: serializedText,

        extendNodeSchema(extension) {
            const context = {
                name: extension.name,
                options: extension.options,
                storage: extension.storage,
            }
            return {
                serializedText: getExtensionField(extension, 'serializedText', context),
            }
        },

        addAttributes() {
            return {
                height: {},
                title: {},
                nodeId: {
                    default: null,
                },
                __init: { default: null },
                children: {},
                ...attributes,
            }
        },

        parseHTML() {
            return [
                {
                    tag: wrapperProps.nodeType,
                },
            ]
        },

        renderHTML({ HTMLAttributes }) {
            return [wrapperProps.nodeType, mergeAttributes(HTMLAttributes)]
        },

        addNodeView() {
            return ReactNodeViewRenderer(WrappedComponent)
        },

        addPasteRules() {
            return pasteOptions
                ? [
                      posthogNodePasteRule({
                          editor: this.editor,
                          type: this.type,
                          ...pasteOptions,
                      }),
                  ]
                : []
        },
    })
}

export const NotebookNodeChildRenderer = ({
    nodeLogic,
    content,
}: {
    nodeLogic: notebookNodeLogicType
    content: NotebookNodeResource
}): JSX.Element => {
    const options = KNOWN_NODES[content.type]

    // TODO: Save updated attributes to parent node
    // TODO: Support deletion of nodes
    // TODO: Check that node logics are unmounted when removed (from the list of logics)

    return (
        <MemoizedNodeWrapper
            {...options}
            Component={options.Component}
            nodeType={content.type}
            titlePlaceholder={options.titlePlaceholder}
            attributes={content.attrs}
            updateAttributes={(newAttrs) => {
                console.log('updated called (TODO)', newAttrs)
            }}
            selected={false}
        />
    )
    // return
}
