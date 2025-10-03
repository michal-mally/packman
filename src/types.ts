export type ItemStatus = 'default' | 'packed' | 'not-needed'

export type Node = {
  id: string
  name: string
  status: ItemStatus
  parentId: string | null
}
