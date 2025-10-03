import { useEffect, useMemo, useState } from 'react'
import { itemsFromText, defaultListText } from '../lib/imports'
import type { Item, ItemActions, ItemState } from '../types'

const ITEMS_STORAGE_KEY = 'packman.items.v3'
const STATE_STORAGE_KEY = 'packman.state.v1'

export function usePackman() {
  // Items structure (immutable list of items/groups)
  const [items, setItems] = useState<Item[]>(() => {
    try {
      const rawItems = localStorage.getItem(ITEMS_STORAGE_KEY)
      if (rawItems) {
        const parsed = JSON.parse(rawItems)
        if (Array.isArray(parsed) && parsed.every((it: any) => it && typeof it.id === 'string' && typeof it.name === 'string' && 'parentId' in it)) {
          return parsed as Item[]
        }
      }
    } catch {}
    const text = defaultListText()
    return itemsFromText(text)
  })

  // Single source of truth for item state: null (to pack), 'packed', or 'not-needed'
  const [stateMap, setStateMap] = useState<Record<string, ItemState>>(() => {
    try {
      const rawState = localStorage.getItem(STATE_STORAGE_KEY)
      if (rawState) {
        const parsed = JSON.parse(rawState)
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, ItemState>
        }
      }
    } catch {}
    // default: all items are null (to pack)
    const init: Record<string, ItemState> = {}
    return init
  })

  // Initialize state map when items change and it lacks entries
  useEffect(() => {
    // If stateMap is empty or missing keys, reinitialize to null for each item id
    setStateMap((prev) => {
      const next: Record<string, ItemState> = { ...prev }
      let changed = false
      for (const it of items) {
        if (!(it.id in next)) {
          next[it.id] = null
          changed = true
        }
      }
      // Optionally remove stale keys (ids no longer present)
      for (const key of Object.keys(next)) {
        if (!items.some((it) => it.id === key)) {
          delete next[key]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [items])

  const [animating, setAnimating] = useState<{ id: string; type: 'packed' | 'not-needed' } | null>(null)

  // Derived structures (from items only)
  const groups = useMemo(() => items.filter((n) => n.parentId === null), [items])
  const childrenByGroup = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const n of items) {
      if (n.parentId) {
        const list = m.get(n.parentId) ?? []
        list.push(n)
        m.set(n.parentId, list)
      }
    }
    return m
  }, [items])

  const idsWithChildren = useMemo(() => new Set(Array.from(childrenByGroup.keys())), [childrenByGroup])

  // Count all entries (groups and items) that are actually visible in "To pack"
  const toPackCount = useMemo(() => {
    const parentById = new Map(items.map((n) => [n.id, n.parentId] as const))
    const isVisibleInToPack = (id: string): boolean => {
      // Item must be in default (null) and all ancestors default (null)
      if (stateMap[id] !== null) return false
      let pid = parentById.get(id)
      while (pid) {
        if (stateMap[pid] !== null) return false
        pid = parentById.get(pid) ?? null
      }
      return true
    }
    let count = 0
    for (const n of items) {
      if (isVisibleInToPack(n.id)) count++
    }
    return count
  }, [items, stateMap])

  // Use groups in their natural order as defined by the source list (default or imported)
  const orderedGroups = groups

  // Count visible entries for status sections (groups + items actually rendered)
  const makeStatusCount = (status: ItemState) => useMemo(() => {
    let count = 0
    const hasDescWithStatus = (id: string): boolean => {
      const stack = [id]
      while (stack.length) {
        const cur = stack.pop()!
        const kids = childrenByGroup.get(cur) ?? []
        for (const k of kids) {
          if (stateMap[k.id] === status) return true
          stack.push(k.id)
        }
      }
      return false
    }
    const visit = (parentId: string) => {
      const children = childrenByGroup.get(parentId) ?? []
      for (const n of children) {
        const isGroup = idsWithChildren.has(n.id)
        if (isGroup) {
          const any = hasDescWithStatus(n.id)
          const showGroup = stateMap[n.id] === status || any
          if (showGroup) {
            count++
            visit(n.id)
          }
        } else {
          if (stateMap[n.id] === status) count++
        }
      }
    }
    for (const g of orderedGroups) {
      const any = hasDescWithStatus(g.id)
      const showGroup = stateMap[g.id] === status || any
      if (showGroup) {
        count++
        visit(g.id)
      }
    }
    return count
  }, [orderedGroups, childrenByGroup, idsWithChildren, stateMap])

  const packedCount = makeStatusCount('packed')
  const notNeededCount = makeStatusCount('not-needed')

  // Persist items and state map
  useEffect(() => {
    try {
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items))
    } catch {}
  }, [items])
  useEffect(() => {
    try {
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(stateMap))
    } catch {}
  }, [stateMap])

  // Encapsulated state modification helpers
  const setItemsHelper = (newItems: Item[]) => {
    setItems(newItems)
    const init: Record<string, ItemState> = {}
    for (const it of newItems) init[it.id] = null
    setStateMap(init)
  }

  const packItem = (item: Item) => {
    setStateMap((prev) => ({ ...prev, [item.id]: 'packed' }))
  }

  const notNeededItem = (item: Item) => {
    setStateMap((prev) => ({ ...prev, [item.id]: 'not-needed' }))
  }

  const restoreItem = (item: Item) => {
    setStateMap((prev) => {
      const byId = new Map(items.map((n) => [n.id, n] as const))
      const target = byId.get(item.id)
      if (!target) return prev
      const next: Record<string, ItemState> = { ...prev, [item.id]: null }
      let p = target.parentId
      while (p) {
        const parent = byId.get(p)
        if (!parent) break
        if (next[p] !== null) next[p] = null
        p = parent.parentId
      }
      return next
    })
  }

  const setGroupStatus = (group: Item, state: ItemState) => {
    setStateMap((prev) => {
      const map = new Map<string, string[]>()
      for (const n of items) {
        if (n.parentId) {
          const arr = map.get(n.parentId) ?? []
          arr.push(n.id)
          map.set(n.parentId, arr)
        }
      }
      const collect = (id: string, acc: Set<string>) => {
        acc.add(id)
        const kids = map.get(id) ?? []
        for (const k of kids) collect(k, acc)
      }
      const all = new Set<string>()
      collect(group.id, all)
      const next: Record<string, ItemState> = { ...prev }
      for (const id of all) next[id] = state
      return next
    })
  }

  const packGroup = (group: Item) => setGroupStatus(group, 'packed')
  const notNeededGroup = (group: Item) => setGroupStatus(group, 'not-needed')
  const restoreGroup = (group: Item) => {
    setStateMap((prev) => ({ ...prev, [group.id]: null }))
  }

  // Single actions API
  const actions: ItemActions = {
    packItem,
    notNeededItem,
    restoreItem,
    packGroup,
    notNeededGroup,
    restoreGroup,
  }

  return {
    // data
    items,
    stateMap,
    orderedGroups,
    childrenByGroup,
    idsWithChildren,
    // counts
    toPackCount,
    packedCount,
    notNeededCount,
    // ui state
    animating,
    setAnimating,
    // actions
    actions,
    setItems: setItemsHelper,
  }
}
