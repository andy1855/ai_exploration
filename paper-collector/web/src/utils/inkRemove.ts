/** 前端笔迹弱化：主要通过色度/HSV 检测蓝、红等彩笔并重绘为纸色；深色印刷保留。黑色圆珠笔与中低对比手写效果有限（界面会提示）。 */

export type InkRemoveOptions = {
  /** HSV S 阈值 (0–1)，越高越保守 */
  chromaStrength: number
  /** 视作印刷黑的上限亮度 (0–255)，越低越偏向保护细线印刷 */
  printBlackBrightnessCap: number
  /** 掩膜膨胀迭代（弱化笔迹边缘） */
  dilatePasses: number
  /** 高斯模糊的 σ（像素近似） */
  blurPx: number
  /** 与估计纸色的混合比例 0–1 */
  bleachTowardPaper: number
}

const defaultInkOptions: InkRemoveOptions = {
  chromaStrength: 0.12,
  printBlackBrightnessCap: 118,
  dilatePasses: 2,
  blurPx: 2.2,
  bleachTowardPaper: 0.55,
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

function medianSamplePaperColor(imageData: ImageData): { pr: number; pg: number; pb: number } {
  const { data, width, height } = imageData
  const coords: Array<[number, number]> = []
  const m = Math.min(32, Math.floor(Math.min(width, height) / 6) || 8)
  const corners: Array<[number, number]> = [
    [0, 0],
    [width - m, 0],
    [0, height - m],
    [width - m, height - m],
  ]
  for (const [x0, y0] of corners) {
    for (let dy = 0; dy < m; dy++) {
      for (let dx = 0; dx < m; dx++) {
        coords.push([Math.min(width - 1, x0 + dx), Math.min(height - 1, y0 + dy)])
      }
    }
  }
  const samples: Array<[number, number, number]> = []
  for (const [x, y] of coords) {
    const i = (y * width + x) * 4
    samples.push([data[i]!, data[i + 1]!, data[i + 2]!])
  }
  samples.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))
  const mid = Math.floor(samples.length / 2)
  const [pr, pg, pb] = samples[mid]!
  return { pr: pr!, pg: pg!, pb: pb! }
}

function dilateBinaryMask(mask: Uint8Array, w: number, h: number, passes: number) {
  const tmp = new Uint8Array(mask.length)
  let src = mask
  let dst = tmp
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        let mx = src[i]
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy
            const xx = x + dx
            if (yy >= 0 && yy < h && xx >= 0 && xx < w) mx = Math.max(mx!, src[yy * w + xx]!)
          }
        dst[i] = mx!
      }
    }
    const nextSrc = dst
    dst = src
    src = nextSrc
  }
  if (src !== mask) mask.set(src)
}

function blurColorCopy(source: CanvasRenderingContext2D, w: number, h: number, blurPx: number): ImageData {
  const scratch = document.createElement('canvas')
  scratch.width = w
  scratch.height = h
  const sx = scratch.getContext('2d', { willReadFrequently: true })!
  sx.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none'
  sx.drawImage(source.canvas, 0, 0)
  return sx.getImageData(0, 0, w, h)
}

/**
 * @param blob 试卷图片 Blob
 */
export async function removeInkMarks(blob: Blob, opts: Partial<InkRemoveOptions> = {}): Promise<Blob> {
  const merged: InkRemoveOptions = { ...defaultInkOptions, ...opts }

  const bitmap = await createImageBitmap(blob)

  try {
    const w = bitmap.width
    const h = bitmap.height
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bitmap, 0, 0)
    const orig = ctx.getImageData(0, 0, w, h)
    const blurred = blurColorCopy(ctx, w, h, merged.blurPx)

    const { pr: paperR, pg: paperG, pb: paperB } = medianSamplePaperColor(orig)

    const mask = new Uint8Array(w * h)

    const cap = merged.printBlackBrightnessCap
    const sMin = merged.chromaStrength

    const { data: od } = orig
    for (let i = 0; i < w * h; i++) {
      const p = i * 4
      const r = od[p]!
      const g = od[p + 1]!
      const b = od[p + 2]!
      const maxc = Math.max(r, g, b)
      if (maxc <= cap) {
        mask[i] = 0
        continue
      }
      const { s } = rgbToHsv(r, g, b)
      const strongBlue = b > r + 18 && b > g + 18
      const strongRed = r > g + 22 && r > b + 22 && r > maxc - 35
      const strongGreen = g > r + 18 && g > b + 18
      const chromish = s > sMin && maxc > cap + 6
      mask[i] = strongBlue || strongRed || strongGreen || chromish ? 255 : 0
    }

    dilateBinaryMask(mask, w, h, merged.dilatePasses)

    const { data: bd } = blurred

    const out = ctx.createImageData(w, h)
    const ot = out.data
    const k = merged.bleachTowardPaper

    for (let i = 0; i < w * h; i++) {
      const p = i * 4
      const m = mask[i] ?? 0
      if (!m) {
        ot[p] = od[p]!
        ot[p + 1] = od[p + 1]!
        ot[p + 2] = od[p + 2]!
        ot[p + 3] = od[p + 3]!
        continue
      }
      const rr = bd[p]! * (1 - k) + paperR * k
      const gg = bd[p + 1]! * (1 - k) + paperG * k
      const bb = bd[p + 2]! * (1 - k) + paperB * k
      ot[p] = Math.min(255, Math.round(rr))
      ot[p + 1] = Math.min(255, Math.round(gg))
      ot[p + 2] = Math.min(255, Math.round(bb))
      ot[p + 3] = od[p + 3]!
    }

    ctx.putImageData(out, 0, 0)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
    })
  } finally {
    bitmap.close()
  }
}

export const inkRemoveDefaults = defaultInkOptions
