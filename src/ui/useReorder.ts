import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'

type Drag = { from: number; to: number; dy: number; height: number }

/**
 * Rearranging a list by its grips: dragged with a mouse or a finger, the
 * item follows the pointer and the others make room; let go, it moves there.
 * The arrow keys on a grip move its item up or down one.
 */
export function useReorder<T extends HTMLElement>(onMove: (from: number, to: number) => void) {
  const list = useRef<T>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const started = useRef<{ from: number; y: number; middles: number[]; pointer: number } | null>(null)

  const end = (move: boolean) => {
    if (move && drag && drag.to !== drag.from) onMove(drag.from, drag.to)
    started.current = null
    setDrag(null)
  }

  /** What a grip needs, for the item at `index` of `count` */
  const grip = (index: number, count: number) => ({
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button !== 0 || !list.current) return
      const items = [...list.current.children] as HTMLElement[]
      const boxes = items.map((item) => item.getBoundingClientRect())
      started.current = { from: index, y: e.clientY, middles: boxes.map((box) => box.top + box.height / 2), pointer: e.pointerId }
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setDrag({ from: index, to: index, dy: 0, height: boxes[index]?.height ?? 0 })
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const start = started.current
      if (!start || e.pointerId !== start.pointer) return
      const dy = e.clientY - start.y
      // Its place: after every other item whose middle it's past
      const middle = start.middles[start.from] + dy
      const to = start.middles.filter((other, i) => i !== start.from && other < middle).length
      setDrag((prev) => (prev ? { ...prev, dy, to } : prev))
    },
    onPointerUp: () => end(true),
    onPointerCancel: () => end(false),
    onKeyDown(e: KeyboardEvent<HTMLElement>) {
      const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : null
      if (to === null) return
      e.preventDefault()
      if (to >= 0 && to < count) onMove(index, to)
    },
  })

  /** How the item at `index` stands while one is dragged: that one with the pointer, those it passes out of its way */
  const styleOf = (index: number): CSSProperties | undefined => {
    if (!drag) return undefined
    const { from, to, dy, height } = drag
    // Lifted off the list, over what it passes
    if (index === from) {
      return {
        transform: `translateY(${dy}px)`,
        transition: 'none',
        position: 'relative',
        zIndex: 1,
        background: 'var(--panel-strong)',
        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
      }
    }
    if (from < to && index > from && index <= to) return { transform: `translateY(${-height}px)` }
    if (to < from && index >= to && index < from) return { transform: `translateY(${height}px)` }
    return undefined
  }

  return { list, grip, styleOf, dragging: drag !== null, draggedIndex: drag?.from ?? null }
}
