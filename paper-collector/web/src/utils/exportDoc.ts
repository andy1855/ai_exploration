import { Document, ImageRun, Packer, Paragraph, TextRun } from 'docx'

/** 将多张图片按比例嵌入 A4 竖版 PDF（每图一页，保持比例留白）。 */

export async function buildPdfBlob(
  blobs: Blob[],
): Promise<{ blob: Blob; filename: string }> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 8
  const innerW = pageW - margin * 2
  const innerH = pageH - margin * 2

  let first = true
  for (const blob of blobs) {
    if (!first) pdf.addPage()
    first = false

    const { dataUrl, wpx, hpx } = await blobToPortraitData(blob)
    const scale = Math.min(innerW / wpx, innerH / hpx)
    const drawW = wpx * scale
    const drawH = hpx * scale
    const ox = margin + (innerW - drawW) / 2
    const oy = margin + (innerH - drawH) / 2

    pdf.addImage(dataUrl, 'JPEG', ox, oy, drawW, drawH)
  }

  const outBlob = pdf.output('blob')
  return { blob: outBlob as Blob, filename: `错题整理_${timestamp()}.pdf` }
}

async function blobToPortraitData(blob: Blob): Promise<{ dataUrl: string; wpx: number; hpx: number }> {
  const bmp = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bmp.width
    canvas.height = bmp.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bmp, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    return { dataUrl, wpx: bmp.width, hpx: bmp.height }
  } finally {
    bmp.close()
  }
}

async function blobToJpegBlob(blob: Blob, quality = 0.92): Promise<{ jpeg: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bmp.width
    canvas.height = bmp.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bmp, 0, 0)
    const jpeg = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG 导出失败'))), 'image/jpeg', quality)
    })
    return { jpeg, width: bmp.width, height: bmp.height }
  } finally {
    bmp.close()
  }
}

/** Word：自上而下每段一图（JPEG 以确保 Word 兼容性）。 */

export async function buildDocxBlob(
  blobs: Blob[],
  title?: string,
): Promise<{ blob: Blob; filename: string }> {
  const paragraphs: Paragraph[] = []
  if (title?.trim()) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun({ text: title.trim(), bold: true })],
      }),
    )
  }

  const docxImgMaxWPx = 640

  for (let i = 0; i < blobs.length; i++) {
    const blob = blobs[i]!
    const { jpeg, width, height } = await blobToJpegBlob(blob)
    const bytes = new Uint8Array(await jpeg.arrayBuffer())
    const scale = Math.min(1, docxImgMaxWPx / width)
    const tw = Math.round(width * scale)
    const th = Math.round(height * scale)

    paragraphs.push(
      new Paragraph({
        spacing: {
          before: i === 0 && !title?.trim() ? 0 : 120,
        },
        children: [
          new ImageRun({
            type: 'jpg',
            data: bytes,
            transformation: { width: tw, height: th },
          }),
        ],
      }),
    )
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  })

  const out = await Packer.toBlob(doc)
  return { blob: out, filename: `错题整理_${timestamp()}.docx` }
}

function timestamp() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}
