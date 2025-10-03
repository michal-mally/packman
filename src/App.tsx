import { useEffect, useMemo, useState } from 'react'
import './App.css'
import luggageSvg from './assets/luggage.svg?raw'
import ImportButton from './components/ImportButton'
import ResetButton from './components/ResetButton'
import ListSection from './components/ListSection'
import { itemsFromText, defaultListText } from './lib/imports'
import type { Item, ItemState } from './types'

const ITEMS_STORAGE_KEY = 'packman.items.v3'
const STATE_STORAGE_KEY = 'packman.state.v1'

function App() {

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
    for (const it of items) init[it.id] = null
    return init
  })

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
  const packedCount = useMemo(() => {
    const status: ItemState = 'packed'
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

  const notNeededCount = useMemo(() => {
    const status: ItemState = 'not-needed'
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



  return (
     <div className="app">
       <header className="header">
         <h1>Packman</h1>
         <p className="subtitle">A simple trip packing checklist</p>
         <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
           <ImportButton onImport={(newItems) => {
             setItems(newItems)
             // reset state map for new structure
             const init: Record<string, ItemState> = {}
             for (const it of newItems) init[it.id] = null
             setStateMap(init)
           }} />
           <ResetButton onReset={(newItems) => {
             setItems(newItems)
             const init: Record<string, ItemState> = {}
             for (const it of newItems) init[it.id] = null
             setStateMap(init)
           }} />
         </div>
       </header>

      <main className="columns">
        <ListSection
          mode="to-pack"
          orderedGroups={orderedGroups}
          childrenByGroup={childrenByGroup}
          idsWithChildren={idsWithChildren}
          items={items}
          stateMap={stateMap}
          setStateMap={setStateMap}
          count={toPackCount}
          emptyComponent={(
            <div className="empty-hero" aria-live="polite">
              {luggageSvg && <div dangerouslySetInnerHTML={{ __html: luggageSvg }} />}
              <h2 className="hero-title">All set! Your luggage is ready.</h2>
              <p className="hero-subtitle">Nothing left to pack. Have a great trip!</p>
            </div>
          )}
          animating={animating}
          setAnimating={setAnimating}
        />

        <ListSection
          mode="packed"
          orderedGroups={orderedGroups}
          childrenByGroup={childrenByGroup}
          idsWithChildren={idsWithChildren}
          items={items}
          stateMap={stateMap}
          setStateMap={setStateMap}
          count={packedCount}
          emptyComponent={<p className="empty">No items packed yet.</p>}
          animating={animating}
          setAnimating={setAnimating}
        />

        <ListSection
          mode="not-needed"
          orderedGroups={orderedGroups}
          childrenByGroup={childrenByGroup}
          idsWithChildren={idsWithChildren}
          items={items}
          stateMap={stateMap}
          setStateMap={setStateMap}
          count={notNeededCount}
          emptyComponent={<p className="empty">No items marked as not needed.</p>}
          animating={animating}
          setAnimating={setAnimating}
        />
      </main>

    </div>
  )
}

export default App
