import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLOSE_MS, swipeToClose } from './swipeToClose'

/** A sheet 400 pixels high, its header, and a body that scrolls */
function setup({ isOn = true } = {}) {
  const sheet = document.createElement('section')
  const header = document.createElement('header')
  const body = document.createElement('div')
  sheet.append(header, body)
  Object.defineProperty(sheet, 'offsetHeight', { value: 400 })
  const onClose = vi.fn()
  const swipe = swipeToClose({ sheet, scroller: body, onClose, isOn: () => isOn })
  /** A finger from y 100 down to `to`, over `ms` */
  const drag = (from: Node, to: number, ms = 500, x = 0) => {
    swipe.start(0, 100, 0, from)
    const moved = [swipe.move(x / 2, (100 + to) / 2), swipe.move(x, to)]
    swipe.end(ms)
    return moved
  }
  return { sheet, header, body, onClose, swipe, drag }
}

describe('swipeToClose', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('follows the finger down, and closes once let go far enough down', () => {
    const { sheet, header, onClose, swipe } = setup()
    swipe.start(0, 100, 0, header)
    expect(swipe.move(0, 104)).toBe(false) // a tap's wobble
    expect(swipe.move(0, 180)).toBe(true)
    expect(sheet.style.transform).toBe('translateY(80px)')
    expect(swipe.move(0, 250)).toBe(true)
    swipe.end(1000)
    expect(sheet.style.transform).toBe('translateY(100%)')
    expect(onClose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(CLOSE_MS)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('springs back when let go not far enough, slowly', () => {
    const { sheet, header, onClose, drag } = setup()
    drag(header, 160, 1000)
    expect(sheet.style.transform).toBe('')
    vi.runAllTimers()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on a quick flick down, however short', () => {
    const { header, onClose, drag } = setup()
    drag(header, 160, 60)
    vi.runAllTimers()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('pulls the sheet from its content only when that is scrolled to the top', () => {
    const { body, onClose, drag } = setup()
    body.scrollTop = 120
    expect(drag(body, 300)).toEqual([false, false]) // scrolls the content instead
    body.scrollTop = 0
    drag(body, 300)
    vi.runAllTimers()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('leaves swipes up and across alone', () => {
    const { header, onClose, drag } = setup()
    expect(drag(header, 20)).toEqual([false, false])
    expect(drag(header, 130, 500, 200)).toEqual([false, false])
    vi.runAllTimers()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("leaves alone what's dragged itself, like a grip to rearrange a list", () => {
    const { body, onClose, drag } = setup()
    const grip = document.createElement('button')
    grip.dataset.noSwipe = ''
    body.append(grip)
    expect(drag(grip, 300)).toEqual([false, false])
    vi.runAllTimers()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does nothing where sheets are not swiped (not a phone)', () => {
    const { header, onClose, drag } = setup({ isOn: false })
    expect(drag(header, 300)).toEqual([false, false])
    vi.runAllTimers()
    expect(onClose).not.toHaveBeenCalled()
  })
})
