import defaultListRaw from '../default-list.txt?raw'
import type { Item } from '../types'

// Parse text with arbitrary nesting (2 spaces per level). Each non-empty line becomes an item.
export function itemsFromText(text: string): Item[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const items: Item[] = []
  const stack: string[] = [] // stack of item ids by depth
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
    while (stack.length > depth) stack.pop() // shrink stack to current depth
    const parentId = depth === 0 ? null : stack[stack.length - 1] ?? null
    const id = `n:${++seq}`
    items.push({ id, name, parentId })
    stack.push(id) // push this item as current parent for deeper levels
  }
  return items
}

// Return default list text (same format as user import)
export function defaultListText(): string {
  return (defaultListRaw || '').replace(/\r/g, '').trim() + '\n'
}
