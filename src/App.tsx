import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import defaultListRaw from './default-list.txt?raw'

export type ItemStatus = 'default' | 'packed' | 'not-needed'

type Node = {
  id: string
  name: string
  status: ItemStatus
  parentId: string | null // null means this is a group (root-level item)
}

const STORAGE_KEY = 'packman.nodes.v2'
// GROUP_STORAGE_KEY is no longer used; group state is part of Node now

const CATEGORY_ORDER = ['Essentials', 'Electronics', 'Toiletries', 'Clothes', 'Accessories', 'Food', 'Other'] as const

function categorize(name: string): string {
  const n = name.toLowerCase()
  if (['passport/id', 'boarding pass', 'wallet'].some((k) => n.includes(k))) return 'Essentials'
  if (
    ['phone', 'charger', 'laptop', 'tablet', 'headphones', 'adapter'].some((k) => n.includes(k))
  )
    return 'Electronics'
  if (['toothbrush', 'toothpaste', 'deodorant', 'medication', 'medications'].some((k) => n.includes(k)))
    return 'Toiletries'
  if (
    ['socks', 'underwear', 't-shirts', 't-shirt', 'pants', 'shorts', 'jacket', 'sweater', 'shoes'].some((k) =>
      n.includes(k)
    )
  )
    return 'Clothes'
  if (['sunglasses', 'water bottle'].some((k) => n.includes(k))) return 'Accessories'
  if (['snack', 'snacks'].some((k) => n.includes(k))) return 'Food'
  return 'Other'
}


function parseUserList(text: string): { items: { name: string; status: ItemStatus; category?: string }[] } {
  const lines = text.replace(/\r/g, '').split('\n')
  const result: { name: string; status: ItemStatus; category?: string }[] = []
  let currentGroup: string | null = null
  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, '')
    if (line.trim().length === 0) continue
    const match = line.match(/^(\s*)/)
    const indent = match ? match[1].length : 0
    if (indent === 0) {
      // Group header
      currentGroup = line.trim()
      continue
    }
    if (indent === 2) {
      const name = line.slice(2).trim()
      if (name.length === 0) continue
      result.push({ name, status: 'default', category: currentGroup ?? 'Other' })
      continue
    }
    // For any other indentation, ignore the line as invalid per spec
  }
  return { items: result }
}

// Build Node[] from parsed items (used by import, default initialization, and reset)
function buildNodesFromParsed(items: { name: string; status: ItemStatus; category?: string }[]): Node[] {
  const cats = Array.from(new Set(items.map((it) => it.category ?? categorize(it.name))))
  const groupIdByCat = new Map<string, string>()
  const nodes: Node[] = []
  for (const c of cats) {
    const gid = `g:${c}`
    groupIdByCat.set(c, gid)
    nodes.push({ id: gid, name: c, status: 'default', parentId: null })
  }
  items.forEach((it, i) => {
    const cat = it.category ?? categorize(it.name)
    nodes.push({ id: `i:${i + 1}`, name: it.name, status: 'default', parentId: groupIdByCat.get(cat)! })
  })
  return nodes
}

function nodesFromText(text: string): Node[] {
  const { items } = parseUserList(text)
  return buildNodesFromParsed(items)
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
              new Set(legacyItems.map((i) => i.category ?? categorize(i.name)))
            )
            const groupIdByCat = new Map<string, string>()
            const result: Node[] = []
            for (const c of cats) {
              const gid = `g:${c}`
              groupIdByCat.set(c, gid)
              result.push({ id: gid, name: c, status: legacyGroupStatus[c] ?? 'default', parentId: null })
            }
            legacyItems.forEach((it, idx) => {
              const cat = it.category ?? categorize(it.name)
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
      const { items: parsed } = parseUserList(text)
      if (parsed.length === 0) {
        window.alert('No items found in the uploaded file. Use format:\nGroup\n  Item\n  Item')
        return
      }
      if (!window.confirm('Importing will replace your current list (and keep Reset to defaults). Continue?')) {
        return
      }
      // Build unified nodes via import pipeline
      const next = buildNodesFromParsed(parsed)
      setNodes(next)
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

  const leavesByStatus = useMemo(() => {
    return {
      default: nodes.filter((n) => n.parentId && n.status === 'default'),
      packed: nodes.filter((n) => n.parentId && n.status === 'packed'),
      notNeeded: nodes.filter((n) => n.parentId && n.status === 'not-needed'),
    }
  }, [nodes])

  const groupOrder = (arr: Node[]) => {
    const present = arr.map((g) => g.name)
    const orderedNames = [
      ...CATEGORY_ORDER.filter((c) => present.includes(c as string)),
      ...present.filter((n) => !(CATEGORY_ORDER as readonly string[]).includes(n)),
    ]
    const byName = new Map(arr.map((g) => [g.name, g] as const))
    return orderedNames.map((name) => byName.get(name)!).filter(Boolean)
  }

  const orderedGroups = useMemo(() => groupOrder(groups), [groups])

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
    setNodes((prev) => prev.map((n) => (n.id === groupId || n.parentId === groupId ? { ...n, status } : n)))
  }

  const restoreGroup = (groupId: string) => {
    setNodes((prev) => prev.map((n) => (n.id === groupId ? { ...n, status: 'default' } : n)))
  }

  const restore = (id: string) => {
    setNodes((prev) => {
      const target = prev.find((n) => n.id === id)
      if (!target) return prev
      if (target.parentId === null) {
        // Group restore only resets the group itself
        return prev.map((n) => (n.id === id ? { ...n, status: 'default' } : n))
      }
      const parentId = target.parentId
      const next = prev.map((n) => (n.id === id ? { ...n, status: 'default' as ItemStatus } : n))
      const parent = prev.find((n) => n.id === parentId)
      if (parent && parent.status !== 'default') {
        // Ensure parent appears in To pack when restoring a child
        return next.map((n) => (n.id === parentId ? { ...n, status: 'default' } : n))
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

  const resetAll = () => {
    // Optional confirmation to prevent accidental reset
    if (window.confirm('Reset all items to the initial state?')) {
      const text = defaultListText()
      const result = nodesFromText(text)
      setNodes(result)
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {}
    }
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
          <h2>To pack</h2>
          {leavesByStatus.default.length === 0 && (
            <p className="empty">Nothing left here. Nice!</p>
          )}
          {orderedGroups
            .filter((g) => g.status === 'default')
            .map((g) => (
              <div key={g.id} className="group">
                {/* Group row visually similar to an item, only indentation differs */}
                <div className="item indent-0">
                  <span className="title">{g.name}</span>
                  <div className="actions">
                    <button
                      className="btn small"
                      onClick={() => setGroupStatus(g.id, 'packed')}
                      aria-label={`Mark all items in ${g.name} as packed`}
                      disabled={!!animating}
                    >
                      Packed
                    </button>
                    <button
                      className="btn small ghost"
                      onClick={() => setGroupStatus(g.id, 'not-needed')}
                      aria-label={`Mark all items in ${g.name} as not needed`}
                      disabled={!!animating}
                    >
                      Not needed
                    </button>
                  </div>
                </div>
                <ul className="items">
                  {(childrenByGroup.get(g.id) ?? [])
                    .filter((item) => item.status === 'default')
                    .map((item) => {
                      const isAnimating = animating?.id === item.id
                      const animClass = isAnimating
                        ? animating!.type === 'packed'
                          ? 'anim-packed'
                          : 'anim-notneeded'
                        : ''
                      return (
                        <li key={item.id} className={`item ${animClass} indent-1`}>
                          <span className="title">{item.name}</span>
                          <div className="actions">
                            <button
                              className="btn small"
                              onClick={() => markWithAnimation(item.id, 'packed')}
                              aria-label={`Mark ${item.name} as packed`}
                              disabled={isAnimating}
                            >
                              Packed
                            </button>
                            <button
                              className="btn small ghost"
                              onClick={() => markWithAnimation(item.id, 'not-needed')}
                              aria-label={`Mark ${item.name} as not needed`}
                              disabled={isAnimating}
                            >
                              Not needed
                            </button>
                          </div>
                        </li>
                      )
                    })}
                </ul>
              </div>
            ))}
        </section>

        <section className="column">
          <h2>Packed</h2>
          {leavesByStatus.packed.length === 0 && <p className="empty">No items packed yet.</p>}
          {orderedGroups.map((g) => {
            const children = childrenByGroup.get(g.id) ?? []
            const anyPacked = children.some((c) => c.status === 'packed')
            const showGroup = g.status === 'packed' || anyPacked
            if (!showGroup) return null
            const hasDefaultChildren = children.some((c) => c.status === 'default')
            return (
              <div key={g.id} className="group">
                <ul className="items">
                  <li className="item crossed indent-0">
                    <span className="title">{g.name}</span>
                    <div className="actions">
                      {g.status === 'packed' && !hasDefaultChildren && (
                        <button
                          className="btn small ghost"
                          onClick={() => restoreGroup(g.id)}
                          aria-label={`Move ${g.name} back to default`}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </li>
                </ul>
                <ul className="items">
                  {children
                    .filter((item) => item.status === 'packed')
                    .map((item) => (
                      <li key={item.id} className="item crossed indent-1">
                        <span className="title">{item.name}</span>
                        <div className="actions">
                          <button
                            className="btn small ghost"
                            onClick={() => restore(item.id)}
                            aria-label={`Move ${item.name} back to default`}
                          >
                            Restore
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
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
            const children = childrenByGroup.get(g.id) ?? []
            const anyNN = children.some((c) => c.status === 'not-needed')
            const showGroup = g.status === 'not-needed' || anyNN
            if (!showGroup) return null
            const hasDefaultChildren = children.some((c) => c.status === 'default')
            return (
              <div key={g.id} className="group">
                <ul className="items">
                  <li className="item crossed dim indent-0">
                    <span className="title">{g.name}</span>
                    <div className="actions">
                      {g.status === 'not-needed' && !hasDefaultChildren && (
                        <button
                          className="btn small ghost"
                          onClick={() => restoreGroup(g.id)}
                          aria-label={`Move ${g.name} back to default`}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </li>
                </ul>
                <ul className="items">
                  {children
                    .filter((item) => item.status === 'not-needed')
                    .map((item) => (
                      <li key={item.id} className="item crossed dim indent-1">
                        <span className="title">{item.name}</span>
                        <div className="actions">
                          <button
                            className="btn small ghost"
                            onClick={() => restore(item.id)}
                            aria-label={`Move ${item.name} back to default`}
                          >
                            Restore
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            )
          })}
        </section>
      </main>
    </div>
  )
}

export default App
