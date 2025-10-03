import './App.css'
import luggageSvg from './assets/luggage.svg?raw'
import ImportButton from './components/ImportButton'
import ResetButton from './components/ResetButton'
import ListSection from './components/ListSection'
import { usePackman } from './state/usePackman'
import type { Item } from './types'

function App() {

  const {
    items,
    stateMap,
    orderedGroups,
    childrenByGroup,
    idsWithChildren,
    toPackCount,
    packedCount,
    notNeededCount,
    animating,
    setAnimating,
    actions,
    setItems,
  } = usePackman()

  return (
     <div className="app">
       <header className="header">
         <h1>Packman</h1>
         <p className="subtitle">A simple trip packing checklist</p>
         <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
           <ImportButton onImport={(newItems) => {
             setItems(newItems)
           }} />
           <ResetButton onReset={(newItems) => {
             setItems(newItems)
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
          actions={actions}
        />

        <ListSection
          mode="packed"
          orderedGroups={orderedGroups}
          childrenByGroup={childrenByGroup}
          idsWithChildren={idsWithChildren}
          items={items}
          stateMap={stateMap}
          count={packedCount}
          emptyComponent={<p className="empty">No items packed yet.</p>}
          animating={animating}
          setAnimating={setAnimating}
          actions={actions}
        />

        <ListSection
          mode="not-needed"
          orderedGroups={orderedGroups}
          childrenByGroup={childrenByGroup}
          idsWithChildren={idsWithChildren}
          items={items}
          stateMap={stateMap}
          count={notNeededCount}
          emptyComponent={<p className="empty">No items marked as not needed.</p>}
          animating={animating}
          setAnimating={setAnimating}
          actions={actions}
        />
      </main>

    </div>
  )
}

export default App
