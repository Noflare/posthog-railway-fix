import { databaseTableListLogic } from './databaseTableListLogic'
import { useActions, useValues } from 'kea'
import { LemonInput } from '@posthog/lemon-ui'
import { DatabaseTablesContainer } from 'scenes/data-management/database/DatabaseTables'

export function DatabaseTableList(): JSX.Element {
    const { searchTerm } = useValues(databaseTableListLogic)
    const { setSearchTerm } = useActions(databaseTableListLogic)

    return (
        <div data-attr="database-list">
            <div className="flex items-center justify-between gap-2 mb-4">
                <LemonInput type="search" placeholder="Search for tables" onChange={setSearchTerm} value={searchTerm} />
            </div>
            <div className="flex items-center justify-between gap-2 mb-4">
                <div>
                    These are the database tables you can query under SQL insights with{' '}
                    <a href="https://posthog.com/manual/hogql" target="_blank">
                        HogQL
                    </a>
                    .
                </div>
            </div>
            <DatabaseTablesContainer />
        </div>
    )
}