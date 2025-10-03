import React from 'react'
import type { ItemStatus, Node } from '../types'

export type ListMode = 'to-pack' | 'packed' | 'not-needed'

export type ListSectionProps = {
  mode: ListMode
  orderedGroups: Node[]
  childrenByGroup: Map<string, Node[]>
  idsWithChildren: Set<string>
  // counts and visuals for headers/empty states
  toPackCount?: number
  packedLeavesCount?: number
  notNeededLeavesCount?: number
  luggageSvg?: string
  // interaction/animation helpers
  animating: { id: string; type: 'packed' | 'not-needed' } | null
  indentClass: (depth: number) => string
  setGroupStatus: (groupId: string, status: ItemStatus) => void
  markWithAnimation: (id: string, type: 'packed' | 'not-needed') => void
  restore: (id: string) => void
  restoreGroup: (groupId: string) => void
}

export default function ListSection(props: ListSectionProps) {
  const {
    mode,
    orderedGroups,
    childrenByGroup,
    idsWithChildren,
    toPackCount = 0,
    packedLeavesCount = 0,
    notNeededLeavesCount = 0,
    luggageSvg,
    animating,
    indentClass,
    setGroupStatus,
    markWithAnimation,
    restore,
    restoreGroup,
  } = props

  const hasDescendantWithStatus = (id: string, status: ItemStatus): boolean => {
    const stack = [id]
    while (stack.length) {
      const cur = stack.pop()!
      const kids = childrenByGroup.get(cur) ?? []
      for (const k of kids) {
        if (k.status === status) return true
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
        if (k.status === 'default') return true
        stack.push(k.id)
      }
    }
    return false
  }

  const renderToPackSubtree = (parentId: string, depth: number): React.ReactNode => {
    const children = childrenByGroup.get(parentId) ?? []
    return children
      .filter((n) => n.status === 'default')
      .map((n) => {
        const childHasChildren = idsWithChildren.has(n.id)
        if (childHasChildren) {
          return (
            <div key={n.id} className="group">
              <div className={`item ${indentClass(depth)}`}>
                <span className="title">{n.name}</span>
                <div className="actions">
                  <button className="btn small" onClick={() => setGroupStatus(n.id, 'packed')} disabled={!!animating}>
                    Packed
                  </button>
                  <button className="btn small ghost" onClick={() => setGroupStatus(n.id, 'not-needed')} disabled={!!animating}>
                    Not needed
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
              <button className="btn small" onClick={() => markWithAnimation(n.id, 'packed')} disabled={isAnimating}>
                Packed
              </button>
              <button className="btn small ghost" onClick={() => markWithAnimation(n.id, 'not-needed')} disabled={isAnimating}>
                Not needed
              </button>
            </div>
          </li>
        )
      })
  }

  const renderStatusSubtree = (parentId: string, depth: number, status: ItemStatus): React.ReactNode => {
    const children = childrenByGroup.get(parentId) ?? []
    const parts: React.ReactNode[] = []
    for (const n of children) {
      const isGroup = idsWithChildren.has(n.id)
      if (isGroup) {
        const any = hasDescendantWithStatus(n.id, status)
        const showGroup = n.status === status || any
        if (showGroup) {
          const hasDefaults = hasDefaultDescendants(n.id)
          parts.push(
            <li key={n.id} className={`item crossed ${status === 'not-needed' ? 'dim' : ''} ${indentClass(depth)}`}>
              <span className="title">{n.name}</span>
              <div className="actions">
                {n.status === status && !hasDefaults && (
                  <button className="btn small ghost" onClick={() => restoreGroup(n.id)}>
                    Restore
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
        if (n.status === status) {
          parts.push(
            <li key={n.id} className={`item crossed ${status === 'not-needed' ? 'dim' : ''} ${indentClass(depth)}`}>
              <span className="title">{n.name}</span>
              <div className="actions">
                <button className="btn small ghost" onClick={() => restore(n.id)}>
                  Restore
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
        {toPackCount === 0 ? (
          <div className="empty-hero" aria-live="polite">
            {luggageSvg && <div dangerouslySetInnerHTML={{ __html: luggageSvg }} />}
            <h2 className="hero-title">All set! Your luggage is ready.</h2>
            <p className="hero-subtitle">Nothing left to pack. Have a great trip!</p>
          </div>
        ) : (
          <>
            <h2>
              To pack{' '}
              <span className="badge" aria-label={`To pack count: ${toPackCount}`}>{toPackCount}</span>
            </h2>
            {orderedGroups
              .filter((g) => g.status === 'default')
              .map((g) => (
                <div key={g.id} className="group">
                  <div className={`item ${indentClass(0)}`}>
                    <span className="title">{g.name}</span>
                    <div className="actions">
                      <button className="btn small" onClick={() => setGroupStatus(g.id, 'packed')} disabled={!!animating}>
                        Packed
                      </button>
                      <button className="btn small ghost" onClick={() => setGroupStatus(g.id, 'not-needed')} disabled={!!animating}>
                        Not needed
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

  const status: ItemStatus = mode === 'packed' ? 'packed' : 'not-needed'
  const isNotNeeded = status === 'not-needed'
  const empty = status === 'packed' ? packedLeavesCount === 0 : notNeededLeavesCount === 0

  return (
    <section className="column">
      <h2>{status === 'packed' ? 'Packed' : 'Not needed'}</h2>
      {empty && (
        <p className="empty">{status === 'packed' ? 'No items packed yet.' : 'Everything might be useful!'}</p>
      )}
      {orderedGroups.map((g) => {
        const any = hasDescendantWithStatus(g.id, status)
        const showGroup = g.status === status || any
        if (!showGroup) return null
        const hasDefaults = hasDefaultDescendants(g.id)
        return (
          <div key={g.id} className="group">
            <ul className="items">
              <li className={`item crossed ${isNotNeeded ? 'dim' : ''} ${indentClass(0)}`}>
                <span className="title">{g.name}</span>
                <div className="actions">
                  {g.status === status && !hasDefaults && (
                    <button className="btn small ghost" onClick={() => restoreGroup(g.id)}>
                      Restore
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
