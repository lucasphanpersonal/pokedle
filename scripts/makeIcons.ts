/**
 * Builds the site icons (browser tab, home screen, web app manifest) from the hand-drawn
 * pixel-art Poké Ball in scripts/icons/pokeball.txt (also drawn in-game by src/components/CaptureScene.tsx). Run with `npm run icons` after editing
 * the drawing; the output in public/ is committed, so the build itself never runs this.
 *
 * The drawing holds two grids separated by a blank line: a 16x16 one for small tab icons
 * and a 32x32 one for everything larger. Every icon is a whole-number scale of one of them,
 * so pixels stay sharp. No image libraries: PNG and ICO are written by hand below.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'
import { BALL_PALETTE, parseBallArt } from '../src/lib/pokeballArt.ts'

type RGBA = [number, number, number, number]

/** The shared drawing palette (src/lib/pokeballArt.ts) as RGBA, plus `.` for transparent. */
const PALETTE: Record<string, RGBA> = {
  '.': [0, 0, 0, 0],
  ...Object.fromEntries(
    Object.entries(BALL_PALETTE).map(([ch, hex]) => [ch, [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255) as RGBA]),
  ),
}

/** The page's banded sky (index.css body background), top to bottom, with each band's end as a fraction of the height. */
const SKY_TOP: RGBA = [0x78, 0xc8, 0xf0, 255]
const SKY_BOTTOM: RGBA = [0xc8, 0xec, 0xf8, 255]
const SKY_BANDS: [number, number][] = [
  [0, 0.14],
  [0.2, 0.28],
  [0.4, 0.42],
  [0.6, 0.57],
  [0.8, 0.72],
  [1, 1],
]

const root = new URL('..', import.meta.url)
const { grid16, grid32 } = parseBallArt(readFileSync(new URL('scripts/icons/pokeball.txt', root), 'utf8'))

class Canvas {
  readonly size: number
  readonly data: Uint8Array
  constructor(size: number) {
    this.size = size
    this.data = new Uint8Array(size * size * 4)
  }
  set(x: number, y: number, c: RGBA) {
    if (c[3] === 0) return
    this.data.set(c, (y * this.size + x) * 4)
  }
  sky() {
    for (let y = 0; y < this.size; y++) {
      const t = (y + 0.5) / this.size
      const mix = SKY_BANDS.find(([, end]) => t < end)?.[0] ?? 1
      const c = SKY_TOP.map((v, i) => Math.round(v + (SKY_BOTTOM[i] - v) * mix)) as RGBA
      for (let x = 0; x < this.size; x++) this.set(x, y, c)
    }
    return this
  }
  draw(grid: string[], scale: number) {
    const offset = (this.size - grid.length * scale) / 2
    if (!Number.isInteger(offset)) throw new Error('drawing does not centre on whole pixels')
    grid.forEach((row, gy) =>
      [...row].forEach((ch, gx) => {
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) this.set(offset + gx * scale + dx, offset + gy * scale + dy, PALETTE[ch])
      }),
    )
    return this
  }
  png(): Buffer {
    const chunk = (type: string, body: Buffer) => {
      const head = Buffer.alloc(8)
      head.writeUInt32BE(body.length, 0)
      head.write(type, 4, 'ascii')
      const crc = Buffer.alloc(4)
      crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0)
      return Buffer.concat([head, body, crc])
    }
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(this.size, 0)
    ihdr.writeUInt32BE(this.size, 4)
    ihdr.set([8, 6, 0, 0, 0], 8) // 8-bit RGBA, no interlace
    const rows = Buffer.alloc(this.size * (this.size * 4 + 1))
    for (let y = 0; y < this.size; y++)
      rows.set(this.data.subarray(y * this.size * 4, (y + 1) * this.size * 4), y * (this.size * 4 + 1) + 1)
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(rows, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ])
  }
}

/** An .ico holding PNG images, which every current browser reads. */
function ico(images: Canvas[]): Buffer {
  const pngs = images.map((c) => c.png())
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach((c, i) => {
    const e = 6 + 16 * i
    header.writeUInt8(c.size % 256, e)
    header.writeUInt8(c.size % 256, e + 1)
    header.writeUInt16LE(1, e + 4) // colour planes
    header.writeUInt16LE(32, e + 6) // bits per pixel
    header.writeUInt32LE(pngs[i].length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += pngs[i].length
  })
  return Buffer.concat([header, ...pngs])
}

const out = (name: string, data: Buffer) => {
  writeFileSync(new URL(`public/${name}`, root), data)
  console.log(`public/${name}  ${data.length} bytes`)
}

// Browser tab: 16 and 32 are drawn by hand, 48 (Windows taskbar, bookmarks) is the 16 at 3x.
out('favicon.ico', ico([new Canvas(16).draw(grid16, 1), new Canvas(32).draw(grid32, 1), new Canvas(48).draw(grid16, 3)]))
// iOS home screen. iOS fills transparency with black, so the ball sits on the page's sky.
out('apple-touch-icon.png', new Canvas(180).sky().draw(grid32, 4).png())
// Web app manifest (Android home screen). The maskable one keeps the ball inside the 80% safe circle.
out('icon-192.png', new Canvas(192).sky().draw(grid32, 5).png())
out('icon-512.png', new Canvas(512).sky().draw(grid32, 14).png())
out('icon-maskable-512.png', new Canvas(512).sky().draw(grid32, 11).png())
