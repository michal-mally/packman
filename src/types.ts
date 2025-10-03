export type ItemState = null | 'packed' | 'not-needed'

export type Item = {
  id: string
  name: string
  parentId: string | null
}


export type ItemActions = {
  packItem: (item: Item) => void
  notNeededItem: (item: Item) => void
  restoreItem: (item: Item) => void
}
