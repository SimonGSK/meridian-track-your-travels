import { useEffect, useRef, useState } from 'react'
import type { CountryFeature } from '../countries'
import { flagUrl } from '../flags'
import { CloseIcon } from '../icons'
import { CARD_FONTS, CARD_HEIGHT, CARD_WIDTH, type Ctx } from './cardDrawing'

type Props = {
  /** What the card is, its heading: "Your 2024, wrapped" */
  title: string
  /** The picture's file name, saved */
  fileName: string
  /** What it's shared as: "My 2024 in travel" */
  shareTitle: string
  /** The card in words, for screen readers */
  description: string
  /** The places whose flags it shows */
  places: readonly CountryFeature[]
  /** Draws it, once its fonts and the flags are loaded; the same function while the card is the same */
  draw: (ctx: Ctx, flags: ReadonlyMap<CountryFeature, CanvasImageSource>) => void
  onClose: () => void
}

/** The places' flags as pictures to draw, those there are */
async function loadFlags(places: readonly CountryFeature[]) {
  const loaded = await Promise.all(
    places.map(async (country) => {
      const url = flagUrl(country)
      if (!url) return null
      const image = new Image()
      image.src = url
      try {
        await image.decode()
        return [country, image] as const
      } catch {
        return null
      }
    }),
  )
  return new Map(loaded.filter((entry) => entry !== null))
}

/** Whether this browser can share a picture, to other apps (on phones mostly) */
const canSharePictures = () => {
  try {
    return !!navigator.canShare?.({ files: [new File([], 'test.png', { type: 'image/png' })] })
  } catch {
    return false
  }
}

/**
 * A card to keep or share, a year wrapped or a trip: full screen, to save
 * as a picture or share (on a phone, straight to another app). Escape, or
 * Close, puts it away.
 */
export default function ShareCard({ title, fileName, shareTitle, description, places, draw, onClose }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [drawn, setDrawn] = useState(false)
  const [shareable] = useState(canSharePictures)

  useEffect(() => {
    let gone = false
    const drawing = async () => {
      // The card's fonts, as text on a canvas doesn't wait for them
      await Promise.all(CARD_FONTS.map((font) => document.fonts?.load(font).catch(() => [])))
      const flags = await loadFlags(places)
      const context = canvas.current?.getContext('2d')
      if (gone || !context) return
      draw(context, flags)
      setDrawn(true)
    }
    void drawing()
    return () => {
      gone = true
    }
  }, [places, draw])

  const picture = () =>
    new Promise<Blob | null>((done) => (canvas.current ? canvas.current.toBlob(done, 'image/png') : done(null)))
  const save = async () => {
    const blob = await picture()
    if (!blob) return
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }
  const share = async () => {
    const blob = await picture()
    if (!blob) return
    try {
      await navigator.share({ files: [new File([blob], fileName, { type: 'image/png' })], title: shareTitle })
    } catch {
      // Not shared after all
    }
  }

  return (
    <div className="wrapped" role="dialog" aria-modal="true" aria-labelledby="share-card-title">
      <h2 id="share-card-title" className="sr-only">
        {title}
      </h2>
      <canvas ref={canvas} className="wrapped-card" width={CARD_WIDTH} height={CARD_HEIGHT} role="img" aria-label={description} />
      <div className="wrapped-actions">
        {shareable && (
          <button type="button" className="primary-button" onClick={share} disabled={!drawn}>
            Share
          </button>
        )}
        <button type="button" className={`primary-button${shareable ? ' secondary' : ''}`} onClick={save} disabled={!drawn}>
          Save image
        </button>
        <button type="button" className="close-button" onClick={onClose} aria-label="Close" autoFocus>
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
