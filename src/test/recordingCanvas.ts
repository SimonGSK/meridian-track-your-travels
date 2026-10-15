/** A stand-in 2D canvas that keeps what text and pictures it was asked to draw, measures text roughly, and ignores the rest */
export function recording() {
  const texts: { text: string; font: string; fill: string }[] = []
  const images: unknown[] = []
  /** The color of each shape filled */
  const fills: string[] = []
  const gradient = { addColorStop() {} }
  const target: Record<string | symbol, unknown> = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    fillText(this: { font: string; fillStyle: unknown }, text: string) {
      texts.push({ text, font: this.font, fill: String(this.fillStyle) })
    },
    drawImage(image: unknown) {
      images.push(image)
    },
    fill(this: { fillStyle: unknown }) {
      fills.push(String(this.fillStyle))
    },
    /** Roughly: each letter half as wide as the font is big */
    measureText(this: { font: string }, text: string) {
      return { width: text.length * Number(/(\d+)px/.exec(this.font)?.[1] ?? 10) * 0.5 }
    },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  }
  const context = new Proxy(target, {
    get: (t, key) => (key in t ? t[key] : () => {}),
    set: (t, key, value) => {
      t[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { context, texts, images, fills }
}
