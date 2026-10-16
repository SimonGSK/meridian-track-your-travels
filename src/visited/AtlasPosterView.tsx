import { useCallback, useMemo } from 'react'
import type { CountryFeature } from '../countries'
import { describeAtlasPoster, type AtlasPoster } from './atlasPoster'
import type { Ctx } from './cardDrawing'
import { drawAtlasPoster } from './drawAtlasPoster'
import ShareCard from './ShareCard'

/** Your atlas as a poster: full screen, to save as a picture or share */
export default function AtlasPosterView({ poster, onClose }: { poster: AtlasPoster; onClose: () => void }) {
  const places = useMemo(() => poster.places.map((place) => place.country), [poster])
  const draw = useCallback((ctx: Ctx, flags: ReadonlyMap<CountryFeature, CanvasImageSource>) => drawAtlasPoster(ctx, poster, flags), [poster])
  return (
    <ShareCard
      title="Your atlas"
      fileName="meridian-atlas.png"
      shareTitle="My atlas"
      description={describeAtlasPoster(poster)}
      places={places}
      draw={draw}
      onClose={onClose}
    />
  )
}
