export type ItemState = null | 'packed' | 'not-needed'

export type Item = {
  id: string
  name: string
  parentId: string | null
}
