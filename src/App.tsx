import { useEffect, useMemo, useState } from 'react'
import './App.css'

export type ItemStatus = 'default' | 'packed' | 'not-needed'

type Item = {
  id: string
  name: string
  status: ItemStatus
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
  const [items, setItems] = useState<Item[]>(() =>
    initialNames.map((name, i) => ({ id: String(i + 1), name, status: 'default' }))
  )

  const lists = useMemo(() => {
    return {
      default: items.filter((i) => i.status === 'default'),
      packed: items.filter((i) => i.status === 'packed'),
      notNeeded: items.filter((i) => i.status === 'not-needed'),
    }
  }, [items])

  const setStatus = (id: string, status: ItemStatus) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)))
  }

  const restore = (id: string) => setStatus(id, 'default')

  return (
    <div className="app">
      <header className="header">
        <h1>Packman</h1>
        <p className="subtitle">A simple trip packing checklist</p>
      </header>

      <main className="columns">
        <section className="column">
          <h2>To pack</h2>
          {lists.default.length === 0 && (
            <p className="empty">Nothing left here. Nice!</p>
          )}
          <ul className="items">
            {lists.default.map((item) => (
              <li key={item.id} className="item">
                <span className="title">{item.name}</span>
                <div className="actions">
                  <button
                    className="btn small"
                    onClick={() => setStatus(item.id, 'packed')}
                    aria-label={`Mark ${item.name} as packed`}
                  >
                    Packed
                  </button>
                  <button
                    className="btn small ghost"
                    onClick={() => setStatus(item.id, 'not-needed')}
                    aria-label={`Mark ${item.name} as not needed`}
                  >
                    Not needed
                  </button>
                </div>
              </li>
            ))}
          </ul>
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
