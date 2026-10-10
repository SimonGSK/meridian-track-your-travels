import { useEffect, useRef } from 'react'

/** How far down to let go for the sheet to close, as a share of its height */
export const CLOSE_SHARE = 0.25
/** Or how fast a flick down closes it, in pixels a millisecond */
export const FLICK_SPEED = 0.5
/** How long it takes to slide away, in milliseconds */
export const CLOSE_MS = 180
/** How far a finger goes before it counts as a swipe rather than a tap */
const SLOP = 8

type Options = {
  /** The sheet, which moves with the finger */
  sheet: HTMLElement
  /** What scrolls in it: a swipe down from there pulls the sheet only once it's scrolled to the top */
  scroller: HTMLElement
  onClose: () => void
  /** Whether sheets can be swiped away (phones) */
  isOn: () => boolean
}

/**
 * A sheet swiped down to close it, as on a phone: it follows the finger down
 * and closes once let go far enough down, or flicked; otherwise it springs
 * back. A swipe in what scrolls in it pulls the sheet only once that's
 * scrolled to the top, and a swipe up scrolls as usual.
 */
export function swipeToClose({ sheet, scroller, onClose, isOn }: Options) {
  let start: { x: number; y: number; time: number; fromTop: boolean } | null = null
  let dragging = false
  let down = 0
  const place = (y: number, slide: string) => {
    sheet.style.transition = slide
    sheet.style.transform = y > 0 ? `translateY(${y}px)` : ''
  }
  return {
    start(x: number, y: number, time: number, target: Node) {
      // Not from what's dragged itself, like a grip to rearrange a list
      if (!isOn() || (target instanceof Element && target.closest('[data-no-swipe]'))) return
      // From above what scrolls (the sheet's top), or from it scrolled to the top
      const inScroller = scroller === sheet || scroller.contains(target)
      start = { x, y, time, fromTop: !inScroller || scroller.scrollTop <= 0 }
      dragging = false
      down = 0
    },
    /** Moves the sheet with the finger; says whether it did, so the page doesn't scroll as well */
    move(x: number, y: number) {
      if (!start) return false
      const dy = y - start.y
      if (!dragging) {
        // Scrolling the content, or across: not a swipe down
        if (!start.fromTop || dy < -SLOP || Math.abs(x - start.x) > Math.max(dy, SLOP)) {
          start = null
          return false
        }
        if (dy <= SLOP) return false
        dragging = true
      }
      down = Math.max(dy, 0)
      place(down, 'none')
      return true
    },
    end(time: number) {
      if (!start) return
      const { time: began } = start
      start = null
      if (!dragging) return
      dragging = false
      const speed = down / Math.max(time - began, 1)
      if (down > sheet.offsetHeight * CLOSE_SHARE || (speed > FLICK_SPEED && down > 3 * SLOP)) {
        sheet.style.transition = `transform ${CLOSE_MS}ms ease-in`
        sheet.style.transform = 'translateY(100%)'
        setTimeout(onClose, CLOSE_MS)
      } else {
        place(0, 'transform 0.2s ease-out')
      }
    },
  }
}

const onPhone = () => !!window.matchMedia?.('(max-width: 640px)').matches

/**
 * A sheet that can be swiped down to close it on a phone: give the ref to
 * the sheet, and mark what scrolls in it with `data-sheet-scroll` (else the
 * sheet itself scrolls).
 */
export function useSwipeToClose<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])

  useEffect(() => {
    const sheet = ref.current
    if (!sheet) return
    const scroller = sheet.querySelector<HTMLElement>('[data-sheet-scroll]') ?? sheet
    const swipe = swipeToClose({ sheet, scroller, onClose: () => close.current(), isOn: onPhone })
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      swipe.start(e.touches[0].clientX, e.touches[0].clientY, e.timeStamp, e.target as Node)
    }
    // Not passive: a swipe that moves the sheet doesn't scroll the page too
    const onMove = (e: TouchEvent) => {
      if (swipe.move(e.touches[0].clientX, e.touches[0].clientY)) e.preventDefault()
    }
    const onEnd = (e: TouchEvent) => swipe.end(e.timeStamp)
    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', onEnd)
    sheet.addEventListener('touchcancel', onEnd)
    return () => {
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', onEnd)
      sheet.removeEventListener('touchcancel', onEnd)
    }
  }, [])
  return ref
}
