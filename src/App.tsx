import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import defaultListRaw from './default-list.txt?raw'
import luggageSvg from './assets/luggage.svg?raw'
import ConfirmModal from './components/ConfirmModal'

export type ItemStatus = 'default' | 'packed' | 'not-needed'

type Node = {
  id: string
  name: string
  status: ItemStatus
  parentId: string | null // null means this is a group (root-level item)
}

const STORAGE_KEY = 'packman.nodes.v2'
// GROUP_STORAGE_KEY is no longer used; group state is part of Node now



// Parse text with arbitrary nesting (2 spaces per level). Each non-empty line becomes a node.
function nodesFromText(text: string): Node[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const nodes: Node[] = []
  // stack of node ids by depth
  const stack: string[] = []
  let seq = 0
  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, '')
    if (line.trim().length === 0) continue
    const m = line.match(/^(\s*)/)
    const indent = m ? m[1].length : 0
    if (indent % 2 !== 0) {
      // ignore invalid indentation
      continue
    }
    const depth = indent / 2
    const name = line.trim()
    // shrink stack to current depth
    while (stack.length > depth) stack.pop()
    const parentId = depth === 0 ? null : stack[stack.length - 1] ?? null
    const id = `n:${++seq}`
    nodes.push({ id, name, status: 'default', parentId })
    // push this node as current parent for deeper levels
    stack.push(id)
  }
  return nodes
}

// Compose default list text in the same format as import feature (Group + 2-space indented items)
function defaultListText(): string {
  // Now sourced from a hardcoded text file in the same format as user input
  return (defaultListRaw || '').replace(/\r/g, '').trim() + '\n'
}

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
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [showReset, setShowReset] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [pendingImport, setPendingImport] = useState<Node[] | null>(null)

  const onClickImport = () => {
    fileInputRef.current?.click()
  }

  const onFileSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0]
    // Reset input value so selecting the same file again re-triggers change
    e.currentTarget.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsedNodes = nodesFromText(text)
      if (parsedNodes.length === 0) {
        window.alert('No items found in the uploaded file. Use 2-space indentation to nest groups/items.')
        return
      }
      // Use custom modal confirmation instead of native confirm
      setPendingImport(parsedNodes)
      setShowImport(true)
    } catch (err) {
      console.error(err)
      window.alert('Failed to read the file. Please ensure it is a plain text (.txt) file.')
    }
  }

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

  const confirmReset = () => {
      const text = defaultListText()
      const result = nodesFromText(text)
      setNodes(result)
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {}
      setShowReset(false)
    }

    const cancelReset = () => setShowReset(false)

    const confirmImport = () => {
      if (pendingImport && pendingImport.length > 0) {
        setNodes(pendingImport)
      }
      setPendingImport(null)
      setShowImport(false)
    }

    const cancelImport = () => {
      setPendingImport(null)
      setShowImport(false)
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

  const resetAll = () => {
    // Show custom modal instead of native confirm
    setShowReset(true)
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
           <button className="btn small" onClick={onClickImport} aria-label="Import items list from a text file">
             Import list
           </button>
           <button className="btn small ghost" onClick={resetAll} aria-label="Reset all items to initial state">
             Reset
           </button>
           <input
             ref={fileInputRef}
             type="file"
             accept=".txt,text/plain"
             onChange={onFileSelected}
             style={{ display: 'none' }}
           />
         </div>
       </header>

      <main className="columns">
        <section className="column">
          {toPackCount === 0 ? (
            <div className="empty-hero" aria-live="polite">
              <div dangerouslySetInnerHTML={{ __html: luggageSvg }} />
              <h2 className="hero-title">All set! Your luggage is ready.</h2>
              <p className="hero-subtitle">Nothing left to pack. Have a great trip!</p>
            </div>
          ) : (
            <>
              <h2>To pack <span className="badge" aria-label={`To pack count: ${toPackCount}`}>{toPackCount}</span></h2>
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

        <section className="column">
          <h2>Packed</h2>
          {leavesByStatus.packed.length === 0 && <p className="empty">No items packed yet.</p>}
          {orderedGroups.map((g) => {
            const anyPacked = hasDescendantWithStatus(g.id, 'packed')
            const showGroup = g.status === 'packed' || anyPacked
            if (!showGroup) return null
            const hasDefaults = hasDefaultDescendants(g.id)
            return (
              <div key={g.id} className="group">
                <ul className="items">
                  <li className={`item crossed ${indentClass(0)}`}>
                    <span className="title">{g.name}</span>
                    <div className="actions">
                      {g.status === 'packed' && !hasDefaults && (
                        <button className="btn small ghost" onClick={() => restoreGroup(g.id)}>
                          Restore
                        </button>
                      )}
                    </div>
                  </li>
                </ul>
                <ul className="items">{renderStatusSubtree(g.id, 1, 'packed')}</ul>
              </div>
            )
          })}
        </section>

        <section className="column">
          <h2>Not needed</h2>
          {leavesByStatus.notNeeded.length === 0 && (
            <p className="empty">Everything might be useful!</p>
          )}
          {orderedGroups.map((g) => {
            const any = hasDescendantWithStatus(g.id, 'not-needed')
            const showGroup = g.status === 'not-needed' || any
            if (!showGroup) return null
            const hasDefaults = hasDefaultDescendants(g.id)
            return (
              <div key={g.id} className="group">
                <ul className="items">
                  <li className={`item crossed dim ${indentClass(0)}`}>
                    <span className="title">{g.name}</span>
                    <div className="actions">
                      {g.status === 'not-needed' && !hasDefaults && (
                        <button className="btn small ghost" onClick={() => restoreGroup(g.id)}>
                          Restore
                        </button>
                      )}
                    </div>
                  </li>
                </ul>
                <ul className="items">{renderStatusSubtree(g.id, 1, 'not-needed')}</ul>
              </div>
            )
          })}
        </section>
      </main>

      <ConfirmModal
        open={showReset}
        title="Reset to default list?"
        message="This will remove your current items and restore the original default list. This action cannot be undone."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onCancel={cancelReset}
        onConfirm={confirmReset}
      />

      <ConfirmModal
        open={showImport}
        title="Import new list?"
        message="Importing will replace your current list. You can still use Reset to go back to the default list."
        confirmLabel="Import"
        cancelLabel="Cancel"
        onCancel={cancelImport}
        onConfirm={confirmImport}
      />
    </div>
  )
}

export default App
