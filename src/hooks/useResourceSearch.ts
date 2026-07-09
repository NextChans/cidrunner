import { useEffect, useMemo, useState } from 'react'
import { resourceList, type ResourceMeta } from '@/resources'
import { CATEGORY_LABELS } from '@/resources/types'
import { useGraphStore } from '@/store/useGraphStore'

/** Debounce window for the live palette filter (ADR 0037). */
const DEBOUNCE_MS = 100

/**
 * Case-insensitive partial match across a resource's label (original English),
 * description (Korean), type id, and category label — so "cog", "인증",
 * "security", and "cognito" all surface the Cognito block.
 */
function matches(meta: ResourceMeta, query: string): boolean {
  const haystack = [meta.label, meta.description, meta.type, CATEGORY_LABELS[meta.category]]
    .join('\n')
    .toLowerCase()
  return haystack.includes(query)
}

/**
 * Pure filter behind the hook (exported for testing): case-insensitive partial
 * match over label/description/type/category. An empty/blank query returns the
 * full list unchanged.
 */
export function filterResources(query: string): ResourceMeta[] {
  const q = query.trim().toLowerCase()
  return q === '' ? resourceList : resourceList.filter((m) => matches(m, q))
}

export interface ResourceSearch {
  /** Raw, live query bound to the input (store-backed). */
  query: string
  setQuery: (query: string) => void
  clear: () => void
  /** True while a (debounced, non-empty) query is active. */
  active: boolean
  /** Filtered resources — the full list when the query is empty. */
  results: ResourceMeta[]
  /** Match count, for the `aria-live` announcement. */
  count: number
}

/**
 * Live, debounced palette search (ADR 0037). The raw query lives in the store
 * so the `/` shortcut and the clear button can drive it from outside the input;
 * this hook debounces it 100ms and returns the filtered resource list. Both the
 * desktop aside and the mobile drawer share the one store-backed query.
 */
export function useResourceSearch(): ResourceSearch {
  const query = useGraphStore((s) => s.search)
  const setQuery = useGraphStore((s) => s.setSearch)
  const [debounced, setDebounced] = useState(query)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [query])

  const trimmed = debounced.trim().toLowerCase()
  const results = useMemo(() => filterResources(trimmed), [trimmed])

  return {
    query,
    setQuery,
    clear: () => setQuery(''),
    active: trimmed !== '',
    results,
    count: results.length,
  }
}
