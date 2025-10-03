import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

export type ItemStatus = 'default' | 'packed' | 'not-needed'

type Item = {
  id: string
  name: string
  status: ItemStatus
  category?: string
}

const STORAGE_KEY = 'packman.items.v1'
const GROUP_STORAGE_KEY = 'packman.groups.v1'

type GroupStatusMap = Record<string, ItemStatus>

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

const initialNames = [
  'Passport/ID',
  'Boarding pass',
  'Wallet',
  'Phone & charger',
  'Laptop/tablet & charger',
  'Headphones',
  'Travel adapter',
  'Toothbrush & toothpaste',
  'Deodorant',
  'Medications',
  'Socks',
  'Underwear',
  'T-shirts',
  'Pants/Shorts',
  'Jacket/Sweater',
  'Shoes',
  'Sunglasses',
  'Water bottle',
  'Snacks',
]

function parseUserList(text: string): { items: Omit<Item, 'id'>[] } {
  const lines = text.replace(/\r/g, '').split('\n')
  const result: Omit<Item, 'id'>[] = []
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

function App() {
  const [items, setItems] = useState<Item[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const okStatuses: ItemStatus[] = ['default', 'packed', 'not-needed']
          const valid = parsed.every(
            (it: any) =>
              it && typeof it.id === 'string' && typeof it.name === 'string' && okStatuses.includes(it.status)
          )
          if (valid)
            return (parsed as Item[]).map((it, idx) => ({
              ...it,
              id: typeof it.id === 'string' ? it.id : String(idx + 1),
              category: it.category ?? categorize(it.name),
            }))
        }
      }
    } catch {}
    return initialNames.map((name, i) => ({ id: String(i + 1), name, status: 'default', category: categorize(name) }))
  })

  const [animating, setAnimating] = useState<{ id: string; type: 'packed' | 'not-needed' } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Independent group (category) statuses: groups must be explicitly marked
  const [groupStatus, setGroupStatusMap] = useState<GroupStatusMap>(() => {
    try {
      const raw = localStorage.getItem(GROUP_STORAGE_KEY)
      if (raw) {
        const obj = JSON.parse(raw)
        if (obj && typeof obj === 'object') return obj as GroupStatusMap
      }
    } catch {}
    const cats = Array.from(new Set(
      (Array.isArray(items) ? items : []).map((i) => i.category ?? categorize(i.name))
    ))
    const map: GroupStatusMap = {}
    for (const c of cats) map[c] = 'default'
    return map
  })

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
      const next: Item[] = parsed.map((it, i) => ({ id: String(i + 1), ...it }))
      setItems(next)
    } catch (err) {
      console.error(err)
      window.alert('Failed to read the file. Please ensure it is a plain text (.txt) file.')
    }
  }

  const lists = useMemo(() => {
    return {
      default: items.filter((i) => i.status === 'default'),
      packed: items.filter((i) => i.status === 'packed'),
      notNeeded: items.filter((i) => i.status === 'not-needed'),
    }
  }, [items])

  const groupByCategory = (arr: Item[]) => {
    const m = new Map<string, Item[]>()
    for (const it of arr) {
      const cat = it.category ?? categorize(it.name)
      const list = m.get(cat) ?? []
      list.push(it)
      m.set(cat, list)
    }
    return m
  }

  const groupedDefault = useMemo(() => groupByCategory(lists.default), [lists.default])
  const groupedPacked = useMemo(() => groupByCategory(lists.packed), [lists.packed])
  const groupedNotNeeded = useMemo(() => groupByCategory(lists.notNeeded), [lists.notNeeded])

  const orderedCategories = (m: Map<string, Item[]>) => {
    const present = Array.from(m.keys())
    const ordered = CATEGORY_ORDER.filter((c) => present.includes(c as string)) as string[]
    const others = present.filter((c) => !CATEGORY_ORDER.includes(c as any))
    return [...ordered, ...others]
  }

  const orderedDefaultCategories = useMemo(() => orderedCategories(groupedDefault), [groupedDefault])
  const orderedPackedCategories = useMemo(() => orderedCategories(groupedPacked), [groupedPacked])
  const orderedNotNeededCategories = useMemo(() => orderedCategories(groupedNotNeeded), [groupedNotNeeded])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {}
  }, [items])

  // Persist group statuses
  useEffect(() => {
    try {
      localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(groupStatus))
    } catch {}
  }, [groupStatus])

  // Ensure groupStatus covers all categories present in items
  useEffect(() => {
    const cats = Array.from(new Set(items.map((i) => i.category ?? categorize(i.name))))
    setGroupStatusMap((prev) => {
      let changed = false
      const next: GroupStatusMap = { ...prev }
      for (const c of cats) {
        if (!(c in next)) {
          next[c] = 'default'
          changed = true
        }
      }
      // Remove categories no longer present
      for (const k of Object.keys(next)) {
        if (!cats.includes(k)) {
          delete next[k]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [items])

  const setStatus = (id: string, status: ItemStatus) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)))
  }

  const setGroupStatus = (category: string, status: ItemStatus) => {
    // Update group’s own status and batch update items as before
    setGroupStatusMap((prev) => ({ ...prev, [category]: status }))
    setItems((prev) =>
      prev.map((it) => ((it.category ?? categorize(it.name)) === category ? { ...it, status } : it))
    )
  }

  const restoreGroup = (category: string) => {
    setGroupStatusMap((prev) => ({ ...prev, [category]: 'default' }))
  }

  const restore = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id)
      if (!target) return prev
      const cat = target.category ?? categorize(target.name)
      const hadDefaultInGroup = prev.some(
        (i) => (i.category ?? categorize(i.name)) === cat && i.status === 'default'
      )
      // If there were no default items in this group before restore, also restore the group itself
      if (!hadDefaultInGroup) {
        setGroupStatusMap((gs) => ({ ...gs, [cat]: 'default' }))
      }
      return prev.map((it) => (it.id === id ? { ...it, status: 'default' as ItemStatus } : it))
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
    const initial = initialNames.map((name, i) => ({ id: String(i + 1), name, status: 'default' as ItemStatus, category: categorize(name) }))
    // Optional confirmation to prevent accidental reset
    if (window.confirm('Reset all items to the initial state?')) {
      setItems(initial)
      // Reset group statuses to defaults for the initial categories
      const cats = Array.from(new Set(initial.map((i) => i.category ?? categorize(i.name))))
      const map: GroupStatusMap = {}
      for (const c of cats) map[c] = 'default'
      setGroupStatusMap(map)
      try {
        // Not strictly required since useEffect will persist the new state,
        // but this ensures we drop any corrupted value if present.
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(GROUP_STORAGE_KEY)
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
          {lists.default.length === 0 && (
            <p className="empty">Nothing left here. Nice!</p>
          )}
          {orderedDefaultCategories.map((cat) => (
            <div key={cat} className="group">
              {/* Group row visually similar to an item, only indentation differs */}
              {(groupStatus[cat] ?? 'default') === 'default' && (
                <div className="item indent-0">
                  <span className="title">{cat}</span>
                  <div className="actions">
                    <button
                      className="btn small"
                      onClick={() => setGroupStatus(cat, 'packed')}
                      aria-label={`Mark all items in ${cat} as packed`}
                      disabled={!!animating}
                    >
                      Packed
                    </button>
                    <button
                      className="btn small ghost"
                      onClick={() => setGroupStatus(cat, 'not-needed')}
                      aria-label={`Mark all items in ${cat} as not needed`}
                      disabled={!!animating}
                    >
                      Not needed
                    </button>
                  </div>
                </div>
              )}
              <ul className="items">
                {groupedDefault.get(cat)!.map((item) => {
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
          {lists.packed.length === 0 && <p className="empty">No items packed yet.</p>}
          {orderedPackedCategories.map((cat) => (
            <div key={cat} className="group">
              {(groupStatus[cat] ?? 'default') === 'packed' && (
                <ul className="items">
                  <li className="item crossed indent-0">
                    <span className="title">{cat}</span>
                    <div className="actions">
                      {(groupedDefault.get(cat)?.length ?? 0) === 0 && (
                        <button
                          className="btn small ghost"
                          onClick={() => restoreGroup(cat)}
                          aria-label={`Move ${cat} back to default`}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </li>
                </ul>
              )}
              <ul className="items">
                {groupedPacked.get(cat)!.map((item) => (
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
          ))}
        </section>

        <section className="column">
          <h2>Not needed</h2>
          {lists.notNeeded.length === 0 && (
            <p className="empty">Everything might be useful!</p>
          )}
          {orderedNotNeededCategories.map((cat) => (
            <div key={cat} className="group">
              {(groupStatus[cat] ?? 'default') === 'not-needed' && (
                <ul className="items">
                  <li className="item crossed dim indent-0">
                    <span className="title">{cat}</span>
                    <div className="actions">
                      {(groupedDefault.get(cat)?.length ?? 0) === 0 && (
                        <button
                          className="btn small ghost"
                          onClick={() => restoreGroup(cat)}
                          aria-label={`Move ${cat} back to default`}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </li>
                </ul>
              )}
              <ul className="items">
                {groupedNotNeeded.get(cat)!.map((item) => (
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
          ))}
        </section>
      </main>
    </div>
  )
}

export default App
