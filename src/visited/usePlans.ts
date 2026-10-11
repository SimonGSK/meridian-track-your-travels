import { useCallback, useEffect, useState } from 'react'
import { dayOf, isDay, type Day } from '../data/plans'
import { usePersistentState } from '../storage'

export const PLANS_KEY = 'countries-app.plans'

/** Visits planned, by place: the day you're going */
type Plans = Record<string, Day>

export const isPlans = (value: unknown): value is Plans =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every(isDay)

/**
 * Visits planned, one per place, as they were saved before trips to come
 * could be made: they become trips (see tripsOfPlans), and are let go
 */
export function usePlans() {
  const [plans, setPlans] = usePersistentState<Plans>(PLANS_KEY, {}, isPlans)
  /** Plans a visit for a day, or with null, no longer */
  const setPlan = useCallback(
    (name: string, day: Day | null) =>
      setPlans((prev) => {
        if (day) return { ...prev, [name]: day }
        const { [name]: _, ...rest } = prev
        return rest
      }),
    [setPlans],
  )
  /** Lets them all go, once they're trips */
  const clear = useCallback(() => setPlans({}), [setPlans])
  return { plans, setPlan, clear }
}

/** How often to look whether the day has changed: a sleeping computer's timers don't run */
export const TODAY_CHECK_MS = 60_000

/** Today, here, as a day, changing at midnight */
export function useToday(): Day {
  const [today, setToday] = useState(() => dayOf(new Date()))
  useEffect(() => {
    const timer = setInterval(() => setToday(dayOf(new Date())), TODAY_CHECK_MS)
    return () => clearInterval(timer)
  }, [])
  return today
}
