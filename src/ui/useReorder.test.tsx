import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useReorder } from './useReorder'

// The test browser has no pointer events of its own
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class PointerEvent extends MouseEvent {
      pointerId: number
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 1
      }
    }
    Object.assign(window, { PointerEvent })
  }
})

/** Three items 40 pixels high, one under the other, each with its grip */
function List({ onMove }: { onMove: (from: number, to: number) => void }) {
  const { list, grip, styleOf } = useReorder<HTMLUListElement>(onMove)
  return (
    <ul ref={list}>
      {['a', 'b', 'c'].map((name, i) => (
        <li key={name} data-testid={name} style={styleOf(i)}>
          <button type="button" aria-label={`Move ${name}`} {...grip(i, 3)} />
        </li>
      ))}
    </ul>
  )
}

function setup() {
  const onMove = vi.fn()
  render(<List onMove={onMove} />)
  for (const [i, name] of ['a', 'b', 'c'].entries()) {
    screen.getByTestId(name).getBoundingClientRect = () => ({ top: i * 40, height: 40 }) as DOMRect
  }
  return onMove
}

describe('useReorder', () => {
  it('drags an item past others, which make room, and moves it there when let go', () => {
    const onMove = setup()
    const grip = screen.getByRole('button', { name: 'Move a' })
    fireEvent.pointerDown(grip, { button: 0, clientY: 20, pointerId: 1 })
    fireEvent.pointerMove(grip, { clientY: 105, pointerId: 1 })
    expect(screen.getByTestId('a').style.transform).toBe('translateY(85px)')
    expect(screen.getByTestId('b').style.transform).toBe('translateY(-40px)')
    expect(screen.getByTestId('c').style.transform).toBe('translateY(-40px)')
    fireEvent.pointerUp(grip, { pointerId: 1 })
    expect(onMove).toHaveBeenCalledWith(0, 2)
    expect(screen.getByTestId('a').style.transform).toBe('')
  })

  it("doesn't move what's let go where it was, or dropped by the browser", () => {
    const onMove = setup()
    const grip = screen.getByRole('button', { name: 'Move b' })
    fireEvent.pointerDown(grip, { button: 0, clientY: 60, pointerId: 1 })
    fireEvent.pointerMove(grip, { clientY: 70, pointerId: 1 })
    fireEvent.pointerUp(grip, { pointerId: 1 })
    fireEvent.pointerDown(grip, { button: 0, clientY: 60, pointerId: 1 })
    fireEvent.pointerMove(grip, { clientY: 0, pointerId: 1 })
    fireEvent.pointerCancel(grip, { pointerId: 1 })
    expect(onMove).not.toHaveBeenCalled()
  })

  it('moves with the arrow keys, but not past the ends', () => {
    const onMove = setup()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move b' }), { key: 'ArrowUp' })
    expect(onMove).toHaveBeenLastCalledWith(1, 0)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move c' }), { key: 'ArrowDown' })
    expect(onMove).toHaveBeenCalledTimes(1)
  })
})
