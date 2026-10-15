import { useCallback, useMemo } from 'react'
import type { CountryFeature } from '../countries'
import type { Ctx } from './cardDrawing'
import { drawWrapped } from './drawWrapped'
import ShareCard from './ShareCard'
import { describeWrapped, wrappedOf } from './wrapped'
import type { YearReview } from './yearInReview'

type Props = {
  review: YearReview
  onClose: () => void
}

/** A year, wrapped: its card full screen, to save as a picture or share */
export default function WrappedView({ review, onClose }: Props) {
  const wrapped = useMemo(() => wrappedOf(review), [review])
  const places = useMemo(() => wrapped.places.map((p) => p.country), [wrapped])
  const draw = useCallback(
    (ctx: Ctx, flags: ReadonlyMap<CountryFeature, CanvasImageSource>) => drawWrapped(ctx, wrapped, flags),
    [wrapped],
  )
  return (
    <ShareCard
      title={`Your ${wrapped.year}, wrapped`}
      fileName={`meridian-${wrapped.year}-wrapped.png`}
      shareTitle={`My ${wrapped.year} in travel`}
      description={describeWrapped(wrapped)}
      places={places}
      draw={draw}
      onClose={onClose}
    />
  )
}
