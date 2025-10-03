import defaultListRaw from '../default-list.txt?raw'
import type { Node } from '../types'

// Parse text with arbitrary nesting (2 spaces per level). Each non-empty line becomes a node.
export function nodesFromText(text: string): Node[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const nodes: Node[] = []
  const stack: string[] = [] // stack of node ids by depth
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
    nodes.push({ id, name, status: 'default', parentId })
    stack.push(id) // push this node as current parent for deeper levels
  }
  return nodes
}

// Return default list text (same format as user import)
export function defaultListText(): string {
  return (defaultListRaw || '').replace(/\r/g, '').trim() + '\n'
}
