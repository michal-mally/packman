import { useEffect, useMemo, useState } from 'react'
import './App.css'

export type ItemStatus = 'default' | 'packed' | 'not-needed'

type Item = {
  id: string
  name: string
  status: ItemStatus
  category?: string
}

const STORAGE_KEY = 'packman.items.v1'

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

  const lists = useMemo(() => {
    return {
      default: items.filter((i) => i.status === 'default'),
      packed: items.filter((i) => i.status === 'packed'),
      notNeeded: items.filter((i) => i.status === 'not-needed'),
    }
  }, [items])

  const groupedDefault = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const it of lists.default) {
      const cat = it.category ?? categorize(it.name)
      const arr = m.get(cat) ?? []
      arr.push(it)
      m.set(cat, arr)
    }
    return m
  }, [lists.default])

  const orderedDefaultCategories = useMemo(() => {
    const present = Array.from(groupedDefault.keys())
    const ordered = CATEGORY_ORDER.filter((c) => present.includes(c as string)) as string[]
    const others = present.filter((c) => !CATEGORY_ORDER.includes(c as any))
    return [...ordered, ...others]
  }, [groupedDefault])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {}
  }, [items])

  const setStatus = (id: string, status: ItemStatus) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)))
  }

  const restore = (id: string) => setStatus(id, 'default')

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
      try {
        // Not strictly required since useEffect will persist the new state,
        // but this ensures we drop any corrupted value if present.
        localStorage.removeItem(STORAGE_KEY)
      } catch {}
    }
  }
 
   return (
     <div className="app">
       <header className="header">
         <h1>Packman</h1>
         <p className="subtitle">A simple trip packing checklist</p>
         <button className="btn small ghost" onClick={resetAll} aria-label="Reset all items to initial state">
           Reset
         </button>
       </header>

      <main className="columns">
        <section className="column">
          <h2>To pack</h2>
          {lists.default.length === 0 && (
            <p className="empty">Nothing left here. Nice!</p>
          )}
          {orderedDefaultCategories.map((cat) => (
            <div key={cat} className="group">
              <h3 className="group-title">{cat}</h3>
              <ul className="items">
                {groupedDefault.get(cat)!.map((item) => {
                  const isAnimating = animating?.id === item.id
                  const animClass = isAnimating
                    ? animating!.type === 'packed'
                      ? 'anim-packed'
                      : 'anim-notneeded'
                    : ''
                  return (
                    <li key={item.id} className={`item ${animClass}`}>
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
          <ul className="items">
            {lists.packed.map((item) => (
              <li key={item.id} className="item crossed">
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
        </section>

        <section className="column">
          <h2>Not needed</h2>
          {lists.notNeeded.length === 0 && (
            <p className="empty">Everything might be useful!</p>
          )}
          <ul className="items">
            {lists.notNeeded.map((item) => (
              <li key={item.id} className="item crossed dim">
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
        </section>
      </main>
    </div>
  )
}

export default App
