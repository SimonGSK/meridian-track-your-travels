import { useEffect, useState } from 'react'

/** The time now, moving on at the start of each minute, as a clock does */
export function useMinute(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const untilNext = () => 60_000 - (Date.now() % 60_000)
    const tick = () => {
      setNow(new Date())
      timer = setTimeout(tick, untilNext())
    }
    timer = setTimeout(tick, untilNext())
    return () => clearTimeout(timer)
  }, [])
  return now
}
