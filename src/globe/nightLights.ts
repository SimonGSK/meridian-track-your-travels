import { useEffect, useRef, useState } from 'react'
import { RepeatWrapping, TextureLoader, type Texture } from 'three'
import earthLights from '../assets/earth-lights.jpg'

/** The picture of the Earth's lights at night, once loaded, or whether it couldn't be (offline before it was kept) */
export type NightLights = { picture: Texture | null; failed: boolean }

const NOT_YET: NightLights = { picture: null, failed: false }

/**
 * NASA's picture of the Earth's lights at night, on black (made by
 * scripts/make-night-lights.mjs), for the side the sun has set on in every
 * design: loaded the first time it's `wanted`, and kept from then on.
 */
export function useNightLights(wanted: boolean): NightLights {
  const [loaded, setLoaded] = useState(NOT_YET)
  const started = useRef(false)

  useEffect(() => {
    if (!wanted || started.current) return
    started.current = true
    new TextureLoader()
      .loadAsync(earthLights)
      .then((texture) => {
        // Drawn as it is, by the night's own shader (no color space to convert from), and read around past its edges,
        // at the date line
        texture.wrapS = RepeatWrapping
        setLoaded({ picture: texture, failed: false })
      })
      .catch(() => setLoaded({ picture: null, failed: true }))
  }, [wanted])

  useEffect(() => () => loaded.picture?.dispose(), [loaded])

  return wanted ? loaded : NOT_YET
}
