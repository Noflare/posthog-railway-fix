import { kea, path, actions, reducers, selectors, listeners, connect, afterMount } from 'kea'
import { loaders } from 'kea-loaders'
import { router } from 'kea-router'

import api from 'lib/api'
import { urls } from 'scenes/urls'
import { InsightShortId } from '~/types'
import { commandBarLogic } from './commandBarLogic'

import type { searchBarLogicType } from './searchBarLogicType'
import { ResultTypeWithAll, SearchResponse, SearchResult } from './types'

export const searchBarLogic = kea<searchBarLogicType>([
    path(['lib', 'components', 'CommandBar', 'searchBarLogic']),
    connect({
        actions: [commandBarLogic, ['hideCommandBar']],
    }),
    actions({
        setSearchQuery: (query: string) => ({ query }),
        onArrowUp: (activeIndex: number, maxIndex: number) => ({ activeIndex, maxIndex }),
        onArrowDown: (activeIndex: number, maxIndex: number) => ({ activeIndex, maxIndex }),
        onMouseEnterResult: (index: number) => ({ index }),
        onMouseLeaveResult: true,
        openResult: (index: number) => ({ index }),
    }),
    loaders({
        searchResponse: [
            null as SearchResponse | null,
            {
                setSearchQuery: async ({ query }) => {
                    return await api.get(`api/projects/@current/search?q=${query}`)
                },
            },
        ],
    }),
    reducers({
        searchQuery: ['', { setSearchQuery: (_, { query }) => query }],
        keyboardResultIndex: [
            0,
            {
                setSearchQuery: () => 0,
                openResult: () => 0,
                onArrowUp: (_, { activeIndex, maxIndex }) => (activeIndex > 0 ? activeIndex - 1 : maxIndex),
                onArrowDown: (_, { activeIndex, maxIndex }) => (activeIndex < maxIndex ? activeIndex + 1 : 0),
            },
        ],
        hoverResultIndex: [
            null as number | null,
            {
                onMouseEnterResult: (_, { index }) => index,
                onMouseLeaveResult: () => null,
                onArrowUp: () => null,
                onArrowDown: () => null,
            },
        ],
        activeTab: ['all' as ResultTypeWithAll, {}],
    }),
    selectors({
        searchResults: [(s) => [s.searchResponse], (searchResponse) => searchResponse?.results],
        searchCounts: [(s) => [s.searchResponse], (searchResponse) => searchResponse?.counts],
        maxIndex: [(s) => [s.searchResults], (searchResults) => (searchResults ? searchResults.length - 1 : 0)],
        activeResultIndex: [
            (s) => [s.keyboardResultIndex, s.hoverResultIndex],
            (keyboardResultIndex: number, hoverResultIndex: number | null) => keyboardResultIndex,
        ],
    }),
    listeners(({ values, actions }) => ({
        openResult: ({ index }) => {
            const result = values.searchResults[index]
            router.actions.push(urlForResult(result))
            actions.hideCommandBar()
        },
    })),
    afterMount(({ actions }) => {
        actions.setSearchQuery('')
    }),
])

export const urlForResult = (result: SearchResult): string => {
    switch (result.type) {
        case 'action':
            return urls.action(result.result_id)
        case 'cohort':
            return urls.cohort(result.result_id)
        case 'dashboard':
            return urls.dashboard(result.result_id)
        case 'experiment':
            return urls.experiment(result.result_id)
        case 'feature_flag':
            return urls.featureFlag(result.result_id)
        case 'insight':
            return urls.insightView(result.result_id as InsightShortId)
        default:
            throw new Error(`No action for type '${result.type}' defined.`)
    }
}
