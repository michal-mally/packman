import React from 'react'
import type { Item, ItemState } from '../types'
import checkIcon from '../assets/check.svg'
import minusIcon from '../assets/minus.svg'
import restoreIcon from '../assets/restore.svg'

export type ListMode = 'to-pack' | 'packed' | 'not-needed'

export type ListSectionProps = {
  mode: ListMode
  orderedGroups: Item[]
  childrenByGroup: Map<string, Item[]>
  idsWithChildren: Set<string>
  items: Item[]
  stateMap: Record<string, ItemState>
  setStateMap: React.Dispatch<React.SetStateAction<Record<string, ItemState>>>
  // unified count of visible entries in this section
  count?: number
  // custom empty state component to render when the section is empty
  emptyComponent?: React.ReactNode
  // interaction/animation helpers
  animating: { id: string; type: 'packed' | 'not-needed' } | null
  setAnimating: React.Dispatch<React.SetStateAction<{ id: string; type: 'packed' | 'not-needed' } | null>>
}

export default function ListSection(props: ListSectionProps) {
  const {
    mode,
    orderedGroups,
    childrenByGroup,
    idsWithChildren,
    items,
    stateMap,
    setStateMap,
    count = 0,
    emptyComponent,
    animating,
    setAnimating,
  } = props

  // Local helpers (identical across lists)
  const indentClass = (depth: number) => `indent-${Math.min(depth, 4)}`

  const setStatus = (id: string, state: ItemState) => {
    setStateMap((prev) => ({ ...prev, [id]: state }))
  }

  const setGroupStatus = (groupId: string, state: ItemState) => {
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
      collect(groupId, all)
      const next: Record<string, ItemState> = { ...prev }
      for (const id of all) next[id] = state
      return next
    })
  }

  const restoreGroup = (groupId: string) => {
    setStateMap((prev) => ({ ...prev, [groupId]: null }))
  }

  const restore = (id: string) => {
    setStateMap((prev) => {
      const byId = new Map(items.map((n) => [n.id, n] as const))
      const target = byId.get(id)
      if (!target) return prev
      const next: Record<string, ItemState> = { ...prev, [id]: null }
      let p = target.parentId
      while (p) {
        const parent = byId.get(p)
        if (!parent) break
        if (next[p] !== null) {
          next[p] = null
        }
        p = parent.parentId
      }
      return next
    })
  }

  const markWithAnimation = (id: string, type: 'packed' | 'not-needed') => {
    if (animating) return
    setAnimating({ id, type })
    window.setTimeout(() => {
      setStatus(id, type)
      setAnimating(null)
    }, 350)
  }

  const hasDescendantWithStatus = (id: string, status: ItemState): boolean => {
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

  const hasDefaultDescendants = (id: string): boolean => {
    const stack = [id]
    while (stack.length) {
      const cur = stack.pop()!
      const kids = childrenByGroup.get(cur) ?? []
      for (const k of kids) {
        if (stateMap[k.id] === null) return true
        stack.push(k.id)
      }
    }
    return false
  }

  const renderToPackSubtree = (parentId: string, depth: number): React.ReactNode => {
    const children = childrenByGroup.get(parentId) ?? []
    return children
      .filter((n) => stateMap[n.id] === null)
      .map((n) => {
        const childHasChildren = idsWithChildren.has(n.id)
        if (childHasChildren) {
          return (
            <div key={n.id} className="group">
              <div className={`item ${indentClass(depth)}`}>
                <span className="title">{n.name}</span>
                <div className="actions">
                  <button className="btn small icon-btn" onClick={() => setGroupStatus(n.id, 'packed')} disabled={!!animating} aria-label="Mark group as packed">
                    <img src={checkIcon} className="icon" alt="" aria-hidden="true" />
                    <span className="btn-label">Packed</span>
                  </button>
                  <button className="btn small ghost warn icon-btn" onClick={() => setGroupStatus(n.id, 'not-needed')} disabled={!!animating} aria-label="Mark group as not needed">
                    <img src={minusIcon} className="icon" alt="" aria-hidden="true" />
                    <span className="btn-label">Not needed</span>
                  </button>
                </div>
              </div>
              <ul className="items">{renderToPackSubtree(n.id, depth + 1)}</ul>
            </div>
          )
        }
        const isAnimating = animating?.id === n.id
        const animClass = isAnimating ? (animating!.type === 'packed' ? 'anim-packed' : 'anim-notneeded') : ''
        return (
          <li key={n.id} className={`item ${animClass} ${indentClass(depth)}`}>
            <span className="title">{n.name}</span>
            <div className="actions">
              <button className="btn small icon-btn" onClick={() => markWithAnimation(n.id, 'packed')} disabled={isAnimating} aria-label="Mark item as packed">
                <img src={checkIcon} className="icon" alt="" aria-hidden="true" />
                <span className="btn-label">Packed</span>
              </button>
              <button className="btn small ghost warn icon-btn" onClick={() => markWithAnimation(n.id, 'not-needed')} disabled={isAnimating} aria-label="Mark item as not needed">
                <img src={minusIcon} className="icon" alt="" aria-hidden="true" />
                <span className="btn-label">Not needed</span>
              </button>
            </div>
          </li>
        )
      })
  }

  const renderStatusSubtree = (parentId: string, depth: number, status: ItemState): React.ReactNode => {
    const children = childrenByGroup.get(parentId) ?? []
    const parts: React.ReactNode[] = []
    for (const n of children) {
      const isGroup = idsWithChildren.has(n.id)
      if (isGroup) {
        const any = hasDescendantWithStatus(n.id, status)
        const showGroup = stateMap[n.id] === status || any
        if (showGroup) {
          const hasDefaults = hasDefaultDescendants(n.id)
          parts.push(
            <li key={n.id} className={`item crossed ${status === 'not-needed' ? 'dim' : ''} ${indentClass(depth)}`}>
              <span className="title">{n.name}</span>
              <div className="actions">
                {stateMap[n.id] === status && !hasDefaults && (
                  <button className="btn small ghost restore icon-btn" onClick={() => restoreGroup(n.id)} aria-label="Restore group to To pack">
                    <img src={restoreIcon} className="icon" alt="" aria-hidden="true" />
                    <span className="btn-label">Restore</span>
                  </button>
                )}
              </div>
            </li>
          )
          parts.push(
            <ul key={n.id + ':children'} className="items">
              {renderStatusSubtree(n.id, depth + 1, status)}
            </ul>
          )
        }
      } else {
        if (stateMap[n.id] === status) {
          parts.push(
            <li key={n.id} className={`item crossed ${status === 'not-needed' ? 'dim' : ''} ${indentClass(depth)}`}>
              <span className="title">{n.name}</span>
              <div className="actions">
                <button className="btn small ghost restore icon-btn" onClick={() => restore(n.id)} aria-label="Restore item to To pack">
                  <img src={restoreIcon} className="icon" alt="" aria-hidden="true" />
                  <span className="btn-label">Restore</span>
                </button>
              </div>
            </li>
          )
        }
      }
    }
    return parts
  }

  if (mode === 'to-pack') {
    return (
      <section className="column">
        {count === 0 ? (
          <>{emptyComponent}</>
        ) : (
          <>
            <h2>
              To pack{' '}
              <span className="badge" aria-label={`To pack count: ${count}`}>{count}</span>
            </h2>
            {orderedGroups
              .filter((g) => stateMap[g.id] === null)
              .map((g) => (
                <div key={g.id} className="group">
                  <div className={`item ${indentClass(0)}`}>
                    <span className="title">{g.name}</span>
                    <div className="actions">
                      <button className="btn small icon-btn" onClick={() => setGroupStatus(g.id, 'packed')} disabled={!!animating} aria-label="Mark group as packed">
                        <img src={checkIcon} className="icon" alt="" aria-hidden="true" />
                        <span className="btn-label">Packed</span>
                      </button>
                      <button className="btn small ghost warn icon-btn" onClick={() => setGroupStatus(g.id, 'not-needed')} disabled={!!animating} aria-label="Mark group as not needed">
                        <img src={minusIcon} className="icon" alt="" aria-hidden="true" />
                        <span className="btn-label">Not needed</span>
                      </button>
                    </div>
                  </div>
                  <ul className="items">{renderToPackSubtree(g.id, 1)}</ul>
                </div>
              ))}
          </>
        )}
      </section>
    )
  }

  const status: ItemState = mode === 'packed' ? 'packed' : 'not-needed'
  const isNotNeeded = status === 'not-needed'
  const empty = count === 0

  return (
    <section className="column">
      <h2>
        {status === 'packed' ? 'Packed' : 'Not needed'}{' '}
        <span className="badge" aria-label={`${status === 'packed' ? 'Packed' : 'Not needed'} count: ${count}`}>{count}</span>
      </h2>
      {empty && (
        <>{emptyComponent}</>
      )}
      {!empty && orderedGroups.map((g) => {
        const any = hasDescendantWithStatus(g.id, status)
        const showGroup = stateMap[g.id] === status || any
        if (!showGroup) return null
        const hasDefaults = hasDefaultDescendants(g.id)
        return (
          <div key={g.id} className="group">
            <ul className="items">
              <li className={`item crossed ${isNotNeeded ? 'dim' : ''} ${indentClass(0)}`}>
                <span className="title">{g.name}</span>
                <div className="actions">
                  {stateMap[g.id] === status && !hasDefaults && (
                    <button className="btn small ghost restore icon-btn" onClick={() => restoreGroup(g.id)} aria-label="Restore group to To pack">
                      <img src={restoreIcon} className="icon" alt="" aria-hidden="true" />
                      <span className="btn-label">Restore</span>
                    </button>
                  )}
                </div>
              </li>
            </ul>
            <ul className="items">{renderStatusSubtree(g.id, 1, status)}</ul>
          </div>
        )
      })}
    </section>
  )
}
