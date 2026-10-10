import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLOSE_MS, swipeToClose } from './swipeToClose'

/** A sheet 400 pixels high (700 all the way up, if it goes up), its header, and a body that scrolls */
function setup({ isOn = true, raisable = false, raised = false } = {}) {
  const sheet = document.createElement('section')
  const header = document.createElement('header')
  const body = document.createElement('div')
  sheet.append(header, body)
  Object.defineProperty(sheet, 'offsetHeight', { value: raised ? 700 : 400 })
  const onClose = vi.fn()
  const onRaise = vi.fn()
  const swipe = swipeToClose({
    sheet,
    scroller: body,
    onClose,
    isOn: () => isOn,
    ...(raisable && { raisedHeight: () => 700, isRaised: () => raised, onRaise }),
  })
  /** A finger from y 100 down to `to`, over `ms` */
  const drag = (from: Node, to: number, ms = 500, x = 0) => {
    swipe.start(0, 100, 0, from)
    const moved = [swipe.move(x / 2, (100 + to) / 2), swipe.move(x, to)]
    swipe.end(ms)
    return moved
  }
  return { sheet, header, body, onClose, onRaise, swipe, drag }
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

  it('goes all the way up when swiped up from midway, from its top or what scrolls in it', () => {
    const { sheet, header, body, onRaise, swipe, drag } = setup({ raisable: true })
    swipe.start(0, 300, 0, header)
    expect(swipe.move(0, 200)).toBe(true)
    expect(sheet.style.height).toBe('500px') // following the finger up
    expect(swipe.move(0, -500)).toBe(true)
    expect(sheet.style.height).toBe('700px') // no higher than the top
    swipe.end(1000)
    expect(onRaise).toHaveBeenCalledWith(true)
    vi.runAllTimers()
    expect(sheet.style.height).toBe('') // the stylesheet's, all the way up
    body.scrollTop = 120
    drag(body, -150, 100) // a flick up from what's scrolled
    expect(onRaise).toHaveBeenCalledTimes(2)
  })

  it('springs back to midway when lifted only a little, slowly', () => {
    const { onRaise, drag, sheet } = setup({ raisable: true })
    drag(sheet, 50, 1000) // up 50 of the 300 to the top
    vi.runAllTimers()
    expect(onRaise).not.toHaveBeenCalled()
    expect(sheet.style.height).toBe('')
  })

  it('all the way up, goes back to midway when swiped down, or closes when swiped far, and scrolls when swiped up', () => {
    const top = setup({ raisable: true, raised: true })
    expect(top.drag(top.header, -100)).toEqual([false, false]) // up: what's in it scrolls
    expect(top.onRaise).not.toHaveBeenCalled()
    top.drag(top.header, 400, 1000) // down to 400 of 700: nearer midway
    expect(top.onRaise).toHaveBeenLastCalledWith(false)
    vi.runAllTimers()
    expect(top.onClose).not.toHaveBeenCalled()

    const far = setup({ raisable: true, raised: true })
    far.drag(far.header, 700, 1000) // down to nothing
    vi.runAllTimers()
    expect(far.onClose).toHaveBeenCalledOnce()
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
