import React from 'react'
import { useValues, BindLogic, useActions } from 'kea'
import '../../../scenes/actions/Actions.scss'
import { PropertyGroupFilter, FilterLogicalOperator, PropertyGroupFilterValue, FilterType } from '~/types'
import { TaxonomicFilterGroupType } from 'lib/components/TaxonomicFilter/types'
import { Col, Row, Select } from 'antd'
import './PropertyGroupFilters.scss'
import { propertyGroupFilterLogic } from './propertyGroupFilterLogic'
import { PropertyFilters } from '../PropertyFilters/PropertyFilters'
import { GlobalFiltersTitle } from 'scenes/insights/common'
import { IconCopy, IconDelete, IconPlusMini } from '../icons'
import { LemonButton } from '../LemonButton'
import { TestAccountFilter } from 'scenes/insights/TestAccountFilter'

interface PropertyGroupFilters {
    value: PropertyGroupFilter
    onChange: (filters: PropertyGroupFilter) => void
    pageKey: string
    taxonomicGroupTypes?: TaxonomicFilterGroupType[]
    eventNames?: string[]
    setTestFilters: (filters: Partial<FilterType>) => void
    filters: Partial<FilterType>
    noTitle?: boolean
}

export function PropertyGroupFilters({
    value,
    onChange,
    pageKey,
    taxonomicGroupTypes,
    eventNames = [],
    setTestFilters,
    filters,
    noTitle,
}: PropertyGroupFilters): JSX.Element {
    const logicProps = { propertyGroupFilter: value, onChange, pageKey }
    const { propertyGroupFilter } = useValues(propertyGroupFilterLogic(logicProps))
    const {
        addFilterGroup,
        removeFilterGroup,
        setOuterPropertyGroupsType,
        setInnerPropertyGroupType,
        setPropertyFilters,
        duplicateFilterGroup,
    } = useActions(propertyGroupFilterLogic(logicProps))

    const showHeader = !noTitle || (propertyGroupFilter.type && propertyGroupFilter.values.length > 1)

    return (
        <>
            {propertyGroupFilter.values && (
                <div className="property-group-filters">
                    <BindLogic logic={propertyGroupFilterLogic} props={logicProps}>
                        {showHeader ? (
                            <div className="pr pb mb space-between-items border-bottom">
                                {!noTitle ? <GlobalFiltersTitle orFiltering={true} /> : null}
                                {propertyGroupFilter.type && propertyGroupFilter.values.length > 1 && (
                                    <AndOrFilterSelect
                                        value={propertyGroupFilter.type}
                                        onChange={(value) => setOuterPropertyGroupsType(value)}
                                        topLevelFilter={true}
                                    />
                                )}
                            </div>
                        ) : null}
                        {propertyGroupFilter.values?.map(
                            (group: PropertyGroupFilterValue, propertyGroupIndex: number) => {
                                return (
                                    <div key={propertyGroupIndex}>
                                        <div className="property-group">
                                            <Row justify="space-between" align="middle" className="mb-05">
                                                <AndOrFilterSelect
                                                    onChange={(type) =>
                                                        setInnerPropertyGroupType(type, propertyGroupIndex)
                                                    }
                                                    value={group.type}
                                                />
                                                <div
                                                    style={{
                                                        marginLeft: 8,
                                                        marginRight: 8,
                                                        height: 1,
                                                        background: '#d9d9d9',
                                                        flex: 1,
                                                    }}
                                                />
                                                <LemonButton
                                                    icon={<IconCopy />}
                                                    type="secondary"
                                                    onClick={() => duplicateFilterGroup(propertyGroupIndex)}
                                                    size="small"
                                                />
                                                <LemonButton
                                                    icon={<IconDelete />}
                                                    type="secondary"
                                                    onClick={() => removeFilterGroup(propertyGroupIndex)}
                                                    size="small"
                                                />
                                            </Row>
                                            <PropertyFilters
                                                orFiltering={true}
                                                propertyFilters={group.values}
                                                style={{ marginBottom: 0 }}
                                                onChange={(properties) => {
                                                    setPropertyFilters(properties, propertyGroupIndex)
                                                }}
                                                pageKey={`trends-filters-${propertyGroupIndex}`}
                                                taxonomicGroupTypes={taxonomicGroupTypes}
                                                eventNames={eventNames}
                                                propertyGroupType={group.type}
                                            />
                                        </div>
                                        {propertyGroupIndex !== propertyGroupFilter.values.length - 1 && (
                                            <div className="property-group-and-or-separator">
                                                <span>{propertyGroupFilter.type}</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            }
                        )}
                        <div className="mb" />
                        <TestAccountFilter filters={filters} onChange={(testFilters) => setTestFilters(testFilters)} />
                    </BindLogic>
                </div>
            )}
            <LemonButton
                data-attr={`${pageKey}-add-filter-group`}
                className="mb mt"
                type="secondary"
                onClick={() => addFilterGroup()}
                icon={<IconPlusMini color="var(--primary)" />}
                fullWidth
            >
                Add filter group
            </LemonButton>
        </>
    )
}

interface AndOrFilterSelectProps {
    onChange: (type: FilterLogicalOperator) => void
    value: FilterLogicalOperator
    topLevelFilter?: boolean
}

export function AndOrFilterSelect({ onChange, value, topLevelFilter }: AndOrFilterSelectProps): JSX.Element {
    return (
        <Row align="middle" className="and-or-filter">
            <span className="ml-05">Match</span>
            <Select
                optionLabelProp="label"
                dropdownClassName="and-or-filter-select"
                style={{ marginLeft: 8, marginRight: 8 }}
                defaultValue={value || FilterLogicalOperator.And}
                onChange={(type) => onChange(type)}
                dropdownMatchSelectWidth={false}
                placement={topLevelFilter ? 'bottomRight' : 'bottomLeft'}
            >
                <Select.Option value={FilterLogicalOperator.And} label="all" className="condition-option">
                    <Row>
                        <div className={`condition-text ${value === FilterLogicalOperator.And ? 'selected' : ''}`}>
                            {FilterLogicalOperator.And}
                        </div>
                        <Col>
                            <div>
                                <b>All filter</b>{' '}
                            </div>
                            <div>All filters must be met (logical and)</div>
                        </Col>
                    </Row>
                </Select.Option>
                <Select.Option value={FilterLogicalOperator.Or} label="any" className="condition-option">
                    <Row>
                        <div className={`condition-text ${value === FilterLogicalOperator.Or ? 'selected' : ''}`}>
                            {FilterLogicalOperator.Or}
                        </div>
                        <Col>
                            <div>
                                <b>Any filter</b>{' '}
                            </div>
                            <div>Any filter can be met (logical or)</div>
                        </Col>
                    </Row>
                </Select.Option>
            </Select>{' '}
            filters in this group
        </Row>
    )
}
