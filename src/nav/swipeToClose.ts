import { useEffect, useRef, useState } from 'react'

/** How far down to let go for the sheet to close, as a share of its height */
export const CLOSE_SHARE = 0.25
/** Or how fast a flick down closes it, in pixels a millisecond */
export const FLICK_SPEED = 0.5
/** How long it takes to slide away, in milliseconds */
export const CLOSE_MS = 180
/** How far up to lift it, as a share of the way to the top, for it to go all the way up */
export const RAISE_SHARE = 0.25
/** How long it takes to rise or settle, in milliseconds */
export const SETTLE_MS = 200
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
  /** How tall it is all the way up; without it, it doesn't go up */
  raisedHeight?: () => number
  /** Whether it's all the way up, and told when that changes */
  isRaised?: () => boolean
  onRaise?: (raised: boolean) => void
}

/**
 * A sheet swiped, as on a phone. Midway, as it opens, it goes all the way
 * up when swiped up, and closes when swiped down; all the way up, it goes
 * back to midway when swiped down, or closes when swiped far. It follows
 * the finger, and let go far enough, or flicked, it goes there; otherwise it
 * springs back. A swipe in what scrolls in it pulls the sheet down only once
 * that's scrolled to the top, and all the way up, a swipe up scrolls as usual.
 */
export function swipeToClose({
  sheet,
  scroller,
  onClose,
  isOn,
  raisedHeight = () => 0,
  isRaised = () => false,
  onRaise = () => {},
}: Options) {
  let start: { x: number; y: number; time: number; fromTop: boolean } | null = null
  /** What the swipe does: close the sheet from midway, raise it, or lower it from the top */
  let doing: 'close' | 'raise' | 'lower' | null = null
  let down = 0
  /** Its height as the swipe began, now, and midway (measured as it was raised) */
  let from = 0
  let height = 0
  let midway = 0
  const place = (y: number, slide: string) => {
    sheet.style.transition = slide
    sheet.style.transform = y > 0 ? `translateY(${y}px)` : ''
  }
  const size = (to: number | null, slide: string) => {
    sheet.style.transition = slide
    sheet.style.maxHeight = to === null ? '' : 'none'
    sheet.style.height = to === null ? '' : `${to}px`
  }
  /** Eases to a height, then leaves its height to the stylesheet */
  const settle = (to: number) => {
    size(to, `height ${SETTLE_MS}ms ease-out`)
    setTimeout(() => size(null, ''), SETTLE_MS)
  }
  const slideAway = () => {
    sheet.style.transition = `transform ${CLOSE_MS}ms ease-in`
    sheet.style.transform = 'translateY(100%)'
    setTimeout(onClose, CLOSE_MS)
  }
  return {
    start(x: number, y: number, time: number, target: Node) {
      // Not from what's dragged itself, like a grip to rearrange a list
      if (!isOn() || (target instanceof Element && target.closest('[data-no-swipe]'))) return
      // From above what scrolls (the sheet's top), or from it scrolled to the top
      const inScroller = scroller === sheet || scroller.contains(target)
      start = { x, y, time, fromTop: !inScroller || scroller.scrollTop <= 0 }
      doing = null
      down = 0
    },
    /** Moves the sheet with the finger; says whether it did, so the page doesn't scroll as well */
    move(x: number, y: number) {
      if (!start) return false
      const dy = y - start.y
      if (!doing) {
        // Across, or a tap's wobble: not a swipe
        if (Math.abs(x - start.x) > Math.max(Math.abs(dy), SLOP)) {
          start = null
          return false
        }
        if (Math.abs(dy) <= SLOP) return false
        const raised = isRaised()
        // Up: midway it rises, all the way up what's in it scrolls. Down: from the top of what's in it only
        if (dy < 0 ? raised || raisedHeight() <= 0 : !start.fromTop) {
          start = null
          return false
        }
        doing = dy < 0 ? 'raise' : raised ? 'lower' : 'close'
        from = height = sheet.offsetHeight
        if (doing === 'raise') midway = from
      }
      if (doing === 'close') {
        down = Math.max(dy, 0)
        place(down, 'none')
      } else {
        const [low, high] = doing === 'raise' ? [from, raisedHeight()] : [0, from]
        height = Math.min(Math.max(from - dy, low), high)
        size(height, 'none')
      }
      return true
    },
    end(time: number) {
      if (!start) return
      const { time: began } = start
      start = null
      const was = doing
      doing = null
      if (!was) return
      const took = Math.max(time - began, 1)
      if (was === 'close') {
        const speed = down / took
        if (down > sheet.offsetHeight * CLOSE_SHARE || (speed > FLICK_SPEED && down > 3 * SLOP)) slideAway()
        else place(0, 'transform 0.2s ease-out')
      } else if (was === 'raise') {
        const top = raisedHeight()
        const lifted = height - from
        if (lifted > (top - from) * RAISE_SHARE || (lifted / took > FLICK_SPEED && lifted > 3 * SLOP)) {
          onRaise(true)
          settle(top)
        } else {
          settle(from)
        }
      } else {
        const half = midway || from / 2
        const lowered = from - height
        if (height < half * (1 - CLOSE_SHARE)) {
          onRaise(false)
          slideAway()
        } else if (height < (half + from) / 2 || (lowered / took > FLICK_SPEED && lowered > 3 * SLOP)) {
          onRaise(false)
          settle(half)
        } else {
          settle(from)
        }
      }
    },
  }
}

const onPhone = () => !!window.matchMedia?.('(max-width: 640px)').matches

/** How tall a sheet is all the way up: from just under the top bar down to where it ends */
const raisedHeightOf = (sheet: HTMLElement) =>
  sheet.getBoundingClientRect().bottom - (document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0) - 8

/**
 * A sheet that can be swiped on a phone, all the way up, back to midway, or
 * down to close it: give `ref` to the sheet, mark what scrolls in it with
 * `data-sheet-scroll` (else the sheet itself scrolls), and style it all the
 * way up while `raised`.
 */
export function useSwipeToClose<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null)
  const close = useRef(onClose)
  const [raised, setRaised] = useState(false)
  const raisedNow = useRef(raised)
  useEffect(() => {
    close.current = onClose
    raisedNow.current = raised
  }, [onClose, raised])

  useEffect(() => {
    const sheet = ref.current
    if (!sheet) return
    const scroller = sheet.querySelector<HTMLElement>('[data-sheet-scroll]') ?? sheet
    const swipe = swipeToClose({
      sheet,
      scroller,
      onClose: () => close.current(),
      isOn: onPhone,
      raisedHeight: () => raisedHeightOf(sheet),
      isRaised: () => raisedNow.current,
      onRaise: setRaised,
    })
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
  return { ref, raised }
}
