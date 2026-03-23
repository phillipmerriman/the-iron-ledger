import { useState, useCallback, useRef, type ReactNode } from 'react'
import { ChevronUp, ChevronDown, GripVertical } from 'lucide-react'
import Card from '@/components/ui/Card'
import { cn } from '@/lib/utils'

export interface Section {
  id: string
  title: string
  render: () => ReactNode
  /** If true, section is hidden when it has no data (caller controls this) */
  hidden?: boolean
}

interface ReorderableSectionsProps {
  /** Unique key for persisting order in localStorage */
  storageKey: string
  sections: Section[]
}

function loadOrder(storageKey: string): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function saveOrder(storageKey: string, order: string[]) {
  localStorage.setItem(storageKey, JSON.stringify(order))
}

export default function ReorderableSections({ storageKey, sections }: ReorderableSectionsProps) {
  const visibleSections = sections.filter((s) => !s.hidden)
  const defaultOrder = visibleSections.map((s) => s.id)

  const [order, setOrder] = useState<string[]>(() => {
    const saved = loadOrder(storageKey)
    if (!saved) return defaultOrder
    const validIds = new Set(defaultOrder)
    const merged = saved.filter((id) => validIds.has(id))
    for (const id of defaultOrder) {
      if (!merged.includes(id)) merged.push(id)
    }
    return merged
  })

  const sorted = order
    .map((id) => visibleSections.find((s) => s.id === id))
    .filter((s): s is Section => s != null)

  const move = useCallback((id: string, direction: -1 | 1) => {
    setOrder((prev) => {
      const idx = prev.indexOf(id)
      if (idx < 0) return prev
      const newIdx = idx + direction
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      saveOrder(storageKey, next)
      return next
    })
  }, [storageKey])

  // ── Drag and drop ─────────────────────────────────────
  const dragId = useRef<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  function handleDragStart(id: string) {
    dragId.current = id
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    if (dragId.current && dragId.current !== id) {
      setDropTarget(id)
    }
  }

  function handleDragLeave() {
    setDropTarget(null)
  }

  function handleDrop(targetId: string) {
    setDropTarget(null)
    const srcId = dragId.current
    dragId.current = null
    if (!srcId || srcId === targetId) return

    setOrder((prev) => {
      const srcIdx = prev.indexOf(srcId)
      const targetIdx = prev.indexOf(targetId)
      if (srcIdx < 0 || targetIdx < 0) return prev
      const next = [...prev]
      next.splice(srcIdx, 1)
      next.splice(targetIdx, 0, srcId)
      saveOrder(storageKey, next)
      return next
    })
  }

  function handleDragEnd() {
    dragId.current = null
    setDropTarget(null)
  }

  return (
    <>
      {sorted.map((section, i) => (
        <Card
          key={section.id}
          padding={false}
          draggable
          onDragStart={() => handleDragStart(section.id)}
          onDragOver={(e) => handleDragOver(e, section.id)}
          onDragLeave={handleDragLeave}
          onDrop={() => handleDrop(section.id)}
          onDragEnd={handleDragEnd}
          className={cn(
            'transition-shadow',
            dropTarget === section.id && 'ring-2 ring-primary-500 ring-offset-2',
          )}
        >
          {/* Header with title + reorder controls */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-surface-300 active:cursor-grabbing" />
            <h2 className="flex-1 text-sm font-semibold text-surface-500">{section.title}</h2>
            <div className="flex items-center">
              <button
                onClick={() => move(section.id, -1)}
                disabled={i === 0}
                className={cn(
                  'rounded p-0.5 transition-colors',
                  i === 0 ? 'text-surface-200 cursor-default' : 'text-surface-400 hover:text-surface-600 hover:bg-surface-100',
                )}
                aria-label="Move up"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => move(section.id, 1)}
                disabled={i === sorted.length - 1}
                className={cn(
                  'rounded p-0.5 transition-colors',
                  i === sorted.length - 1 ? 'text-surface-200 cursor-default' : 'text-surface-400 hover:text-surface-600 hover:bg-surface-100',
                )}
                aria-label="Move down"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Content */}
          <div className="px-4 pb-4">
            {section.render()}
          </div>
        </Card>
      ))}
    </>
  )
}
