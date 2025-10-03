import { useEffect, useMemo, useState } from 'react'
import './App.css'
import luggageSvg from './assets/luggage.svg?raw'
import ImportButton from './components/ImportButton'
import ResetButton from './components/ResetButton'
import ListSection from './components/ListSection'
import { nodesFromText, defaultListText } from './lib/imports'
import type { ItemStatus, Node } from './types'

const STORAGE_KEY = 'packman.nodes.v2'
// GROUP_STORAGE_KEY is no longer used; group state is part of Node now

function App() {
  const LEGACY_ITEMS_KEY = 'packman.items.v1'
  const LEGACY_GROUP_KEY = 'packman.groups.v1'

  const [nodes, setNodes] = useState<Node[]>(() => {
    const okStatuses: ItemStatus[] = ['default', 'packed', 'not-needed']
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const valid = parsed.every(
            (it: any) => it && typeof it.id === 'string' && typeof it.name === 'string' && okStatuses.includes(it.status) && ('parentId' in it)
          )
          if (valid) return parsed as Node[]
        }
      }
      // Try legacy migration
      const legacyRaw = localStorage.getItem(LEGACY_ITEMS_KEY)
      if (legacyRaw) {
        const arr = JSON.parse(legacyRaw)
        if (Array.isArray(arr)) {
          // legacy items have name/status and optional category, no parentId
          const legacyItems: { id?: string; name: string; status: ItemStatus; category?: string }[] = arr.filter(
            (it: any) => it && typeof it.name === 'string' && okStatuses.includes(it.status)
          )
          if (legacyItems.length > 0) {
            const legacyGroupStatus = (() => {
              try {
                const g = localStorage.getItem(LEGACY_GROUP_KEY)
                if (!g) return {}
                const obj = JSON.parse(g)
                return obj && typeof obj === 'object' ? (obj as Record<string, ItemStatus>) : {}
              } catch {
                return {}
              }
            })()
            const cats = Array.from(
              new Set(legacyItems.map((i) => i.category ?? 'Other'))
            )
            const groupIdByCat = new Map<string, string>()
            const result: Node[] = []
            for (const c of cats) {
              const gid = `g:${c}`
              groupIdByCat.set(c, gid)
              result.push({ id: gid, name: c, status: legacyGroupStatus[c] ?? 'default', parentId: null })
            }
            legacyItems.forEach((it, idx) => {
              const cat = it.category ?? 'Other'
              const gid = groupIdByCat.get(cat)!
              result.push({ id: `i:${idx + 1}`, name: it.name, status: it.status, parentId: gid })
            })
            // Clear legacy keys now that we migrated
            try {
              localStorage.removeItem(LEGACY_ITEMS_KEY)
              localStorage.removeItem(LEGACY_GROUP_KEY)
            } catch {}
            return result
          }
        }
      }
    } catch {}
    // Fallback: build from default list using the same pipeline as import
    const text = defaultListText()
    return nodesFromText(text)
  })

  const [animating, setAnimating] = useState<{ id: string; type: 'packed' | 'not-needed' } | null>(null)

  // Derived structures
  const groups = useMemo(() => nodes.filter((n) => n.parentId === null), [nodes])
  const childrenByGroup = useMemo(() => {
    const m = new Map<string, Node[]>()
    for (const n of nodes) {
      if (n.parentId) {
        const list = m.get(n.parentId) ?? []
        list.push(n)
        m.set(n.parentId, list)
      }
    }
    return m
  }, [nodes])

  const idsWithChildren = useMemo(() => new Set(Array.from(childrenByGroup.keys())), [childrenByGroup])

  const leavesByStatus = useMemo(() => {
    const isLeaf = (n: Node) => !idsWithChildren.has(n.id)
    return {
      default: nodes.filter((n) => isLeaf(n) && n.status === 'default'),
      packed: nodes.filter((n) => isLeaf(n) && n.status === 'packed'),
      notNeeded: nodes.filter((n) => isLeaf(n) && n.status === 'not-needed'),
    }
  }, [nodes, idsWithChildren])

  // Count all entries (groups and items) that are actually visible in "To pack"
  const toPackCount = useMemo(() => {
    const parentById = new Map(nodes.map((n) => [n.id, n.parentId] as const))
    const statusById = new Map(nodes.map((n) => [n.id, n.status] as const))
    const isVisibleInToPack = (id: string): boolean => {
      // Node must be default and all ancestors default
      if (statusById.get(id) !== 'default') return false
      let pid = parentById.get(id)
      while (pid) {
        if (statusById.get(pid) !== 'default') return false
        pid = parentById.get(pid) ?? null
      }
      return true
    }
    let count = 0
    for (const n of nodes) {
      if (isVisibleInToPack(n.id)) count++
    }
    return count
  }, [nodes])

  // Use groups in their natural order as defined by the source list (default or imported)
  const orderedGroups = groups

  // Persist nodes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes))
    } catch {}
  }, [nodes])

  const setStatus = (id: string, status: ItemStatus) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, status } : n)))
  }

  const setGroupStatus = (groupId: string, status: ItemStatus) => {
    setNodes((prev) => {
      // build children map
      const map = new Map<string, string[]>()
      for (const n of prev) {
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
      return prev.map((n) => (all.has(n.id) ? { ...n, status } : n))
    })
  }

  const restoreGroup = (groupId: string) => {
    setNodes((prev) => prev.map((n) => (n.id === groupId ? { ...n, status: 'default' } : n)))
  }

  const restore = (id: string) => {
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n] as const))
      const target = byId.get(id)
      if (!target) return prev
      // set the node to default
      let next = prev.map((n) => (n.id === id ? { ...n, status: 'default' as ItemStatus } : n))
      // ensure all ancestors are default so it appears in To pack with its parents
      let p = target.parentId
      while (p) {
        const parent = byId.get(p)
        if (!parent) break
        if (parent.status !== 'default') {
          next = next.map((n) => (n.id === p ? { ...n, status: 'default' } : n))
        }
        p = parent.parentId
      }
      return next
    })
  }

  const markWithAnimation = (id: string, type: 'packed' | 'not-needed') => {
    // Prevent overlapping animations; keep UX simple
    if (animating) return
    setAnimating({ id, type })
    // Duration should match CSS animation time
    window.setTimeout(() => {
      setStatus(id, type)
      setAnimating(null)
    }, 350)
  }

  // Helpers for recursive views
  const indentClass = (depth: number) => `indent-${Math.min(depth, 4)}`
  const getChildren = (id: string) => childrenByGroup.get(id) ?? []
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

  const renderToPackSubtree = (parentId: string, depth: number) => {
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

  const renderStatusSubtree = (parentId: string, depth: number, status: ItemStatus) => {
    const children = childrenByGroup.get(parentId) ?? []
    const parts: JSX.Element[] = []
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
          // recurse beneath this group
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

  return (
     <div className="app">
       <header className="header">
         <h1>Packman</h1>
         <p className="subtitle">A simple trip packing checklist</p>
         <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
           <ImportButton onImport={(newNodes) => setNodes(newNodes)} />
           <ResetButton onReset={(newNodes) => setNodes(newNodes)} />
         </div>
       </header>

      <main className="columns">
        <ListSection
          mode="to-pack"
          orderedGroups={orderedGroups}
          childrenByGroup={childrenByGroup}
          idsWithChildren={idsWithChildren}
          toPackCount={toPackCount}
          luggageSvg={luggageSvg}
          animating={animating}
          setAnimating={setAnimating}
          setNodes={setNodes}
        />

        <ListSection
          mode="packed"
          orderedGroups={orderedGroups}
          childrenByGroup={childrenByGroup}
          idsWithChildren={idsWithChildren}
          packedLeavesCount={leavesByStatus.packed.length}
          animating={animating}
          setAnimating={setAnimating}
          setNodes={setNodes}
        />

        <ListSection
          mode="not-needed"
          orderedGroups={orderedGroups}
          childrenByGroup={childrenByGroup}
          idsWithChildren={idsWithChildren}
          notNeededLeavesCount={leavesByStatus.notNeeded.length}
          animating={animating}
          setAnimating={setAnimating}
          setNodes={setNodes}
        />
      </main>

    </div>
  )
}

export default App
