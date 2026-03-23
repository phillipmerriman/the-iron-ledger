import { useState, useCallback, useRef, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { ArrowBigUpDash, ArrowBigDownDash, GripVertical, EyeOff, Component } from 'lucide-react'
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

// ── Section visibility store ────────────────────────────
const VISIBILITY_SUFFIX = '-visible'
const visListeners = new Map<string, Set<() => void>>()
const visCache = new Map<string, Set<string>>()

function getVisListeners(key: string) {
  let set = visListeners.get(key)
  if (!set) { set = new Set(); visListeners.set(key, set) }
  return set
}

function readVisibility(storageKey: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(storageKey + VISIBILITY_SUFFIX)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch { /* ignore */ }
  return null
}

function getVisSnapshot(storageKey: string): Set<string> | null {
  if (!visCache.has(storageKey)) {
    visCache.set(storageKey, readVisibility(storageKey)!)
  }
  return visCache.get(storageKey) ?? null
}

function setVisibility(storageKey: string, next: Set<string>) {
  localStorage.setItem(storageKey + VISIBILITY_SUFFIX, JSON.stringify([...next]))
  visCache.set(storageKey, next)
  getVisListeners(storageKey).forEach((cb) => cb())
}

function useSectionVisibility(storageKey: string, allIds: string[]) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const ls = getVisListeners(storageKey)
      ls.add(cb)
      return () => { ls.delete(cb) }
    },
    [storageKey],
  )
  const snap = useSyncExternalStore(subscribe, () => getVisSnapshot(storageKey))
  // null means "show all" (first-time user)
  const visible = snap ?? new Set(allIds)

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(visible)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setVisibility(storageKey, next)
    },
    [storageKey, visible],
  )

  const hide = useCallback(
    (id: string) => {
      const next = new Set(visible)
      next.delete(id)
      setVisibility(storageKey, next)
    },
    [storageKey, visible],
  )

  return { visible, toggle, hide }
}

/** Gear button + dropdown for toggling dashboard sections. Place in the page header. */
export function SectionSettings({ storageKey, sections }: { storageKey: string; sections: Section[] }) {
  const allIds = sections.filter((s) => !s.hidden).map((s) => s.id)
  const { visible, toggle } = useSectionVisibility(storageKey, allIds)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const items = sections.filter((s) => !s.hidden)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'rounded-lg p-1.5 transition-colors',
          open ? 'bg-surface-100 text-surface-700' : 'text-surface-400 hover:text-surface-600',
        )}
        aria-label="Configure dashboard sections"
      >
        <Component className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 rounded-lg border border-border bg-card p-2 shadow-lg z-20">
          <p className="px-2 pb-1 text-xs font-medium text-surface-400">Sections</p>
          {items.map((section) => (
            <label
              key={section.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-surface-700 hover:bg-surface-50"
            >
              <input
                type="checkbox"
                checked={visible.has(section.id)}
                onChange={() => toggle(section.id)}
                className="accent-primary-600"
              />
              {section.title}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ReorderableSections({ storageKey, sections }: ReorderableSectionsProps) {
  const dataSections = sections.filter((s) => !s.hidden)
  const allIds = dataSections.map((s) => s.id)
  const { visible, hide } = useSectionVisibility(storageKey, allIds)
  const visibleSections = dataSections.filter((s) => visible.has(s.id))
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

  // Keep order in sync when visibility changes
  const visibleIds = visibleSections.map((s) => s.id)
  const syncedOrder = (() => {
    const visSet = new Set(visibleIds)
    const filtered = order.filter((id) => visSet.has(id))
    for (const id of visibleIds) {
      if (!filtered.includes(id)) filtered.push(id)
    }
    return filtered
  })()

  const sorted = syncedOrder
    .map((id) => visibleSections.find((s) => s.id === id))
    .filter((s): s is Section => s != null)

  const move = useCallback((id: string, direction: -1 | 1) => {
    setOrder(() => {
      const idx = syncedOrder.indexOf(id)
      if (idx < 0) return syncedOrder
      const newIdx = idx + direction
      if (newIdx < 0 || newIdx >= syncedOrder.length) return syncedOrder
      const next = [...syncedOrder]
      ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      saveOrder(storageKey, next)
      return next
    })
  }, [storageKey, syncedOrder])

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

    setOrder(() => {
      const srcIdx = syncedOrder.indexOf(srcId)
      const targetIdx = syncedOrder.indexOf(targetId)
      if (srcIdx < 0 || targetIdx < 0) return syncedOrder
      const next = [...syncedOrder]
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
                onClick={() => hide(section.id)}
                className="rounded p-0.5 text-surface-300 transition-colors hover:text-surface-500 hover:bg-surface-100"
                aria-label="Hide section"
                title="Hide section"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => move(section.id, -1)}
                disabled={i === 0}
                className={cn(
                  'rounded p-0.5 transition-colors',
                  i === 0 ? 'text-surface-200 cursor-default' : 'text-surface-400 hover:text-surface-600 hover:bg-surface-100',
                )}
                aria-label="Move up"
              >
                <ArrowBigUpDash className="h-4 w-4" />
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
                <ArrowBigDownDash className="h-4 w-4" />
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
