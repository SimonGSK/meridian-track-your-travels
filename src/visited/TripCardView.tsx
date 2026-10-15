import { useCallback, useMemo } from 'react'
import type { CountryFeature } from '../countries'
import type { TripView } from '../data/savedTrips'
import type { VisitDate } from '../data/visitDates'
import type { Ctx } from './cardDrawing'
import { drawTripCard } from './drawTripCard'
import ShareCard from './ShareCard'
import { describeTripCard, tripCardOf } from './tripCard'

type Props = {
  view: TripView
  /** When a place was first been to, of all your visits, for the places new on the trip */
  firstVisitOf: (place: string) => VisitDate | null
  onClose: () => void
}

/** "Japan & South Korea" as "japan-south-korea", for the picture's name */
const slugOf = (title: string) =>
  title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'trip'

/** A trip, as a card: full screen, to save as a picture or share */
export default function TripCardView({ view, firstVisitOf, onClose }: Props) {
  const card = useMemo(() => tripCardOf(view, firstVisitOf), [view, firstVisitOf])
  const places = useMemo(() => card.places.map((place) => place.country), [card])
  const draw = useCallback((ctx: Ctx, flags: ReadonlyMap<CountryFeature, CanvasImageSource>) => drawTripCard(ctx, card, flags), [card])
  return (
    <ShareCard
      title={`Your trip: ${card.title}`}
      fileName={`meridian-${slugOf(card.title)}.png`}
      shareTitle={[card.title, card.when].filter(Boolean).join(', ')}
      description={describeTripCard(card)}
      places={places}
      draw={draw}
      onClose={onClose}
    />
  )
}
