import {
  ClipboardList,
  Eraser,
  FolderOpen,
  Loader2,
  RefreshCw,
  Save,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import type { InkRemoveOptions } from './utils/inkRemove.ts'
import { inkRemoveDefaults, removeInkMarks } from './utils/inkRemove.ts'
import { buildDocxBlob, buildPdfBlob } from './utils/exportDoc.ts'
import type { ImageEntry } from './utils/fsAccess.ts'
import { collectImagesRecursive, ensureCleanedWritable } from './utils/fsAccess.ts'

function supportsFsAccess(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

async function verifyDirReadable(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    for await (const _ of handle.values()) {
      break
    }
    return true
  } catch {
    return false
  }
}

async function syncPickerSave(
  blob: Blob,
  suggestedName: string,
  kind: 'pdf' | 'docx',
): Promise<'saved' | 'cancelled' | 'unsupported'> {
  if (!('showSaveFilePicker' in window) || typeof window.showSaveFilePicker !== 'function') return 'unsupported'
  const types =
    kind === 'pdf'
      ? ([{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }] satisfies FilePickerAcceptType[])
      : ([
          {
            description: 'Word',
            accept: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            },
          },
        ] satisfies FilePickerAcceptType[])
  try {
    const handle = await window.showSaveFilePicker({ suggestedName, types })
    const w = await handle.createWritable()
    await w.write(blob)
    await w.close()
    return 'saved'
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'cancelled'
    throw e
  }
}

function moveWithin<T>(items: T[], index: number, delta: number): T[] {
  const j = index + delta
  if (j < 0 || j >= items.length) return items
  const copy = [...items]
  ;[copy[index], copy[j]] = [copy[j]!, copy[index]!]
  return copy
}

export function App() {
  const [folderName, setFolderName] = useState<string | null>(null)
  const [dir, setDir] = useState<FileSystemDirectoryHandle | null>(null)
  const [entries, setEntries] = useState<ImageEntry[]>([])
  const [cleanSet, setCleanSet] = useState(() => new Set<string>())
  const [asmOrder, setAsmOrder] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [statusText, setStatusText] = useState('')
  const [errorText, setErrorText] = useState('')

  const [chromaStrength, setChromaStrength] = useState(Math.round(inkRemoveDefaults.chromaStrength * 100))
  const [printCap, setPrintCap] = useState(inkRemoveDefaults.printBlackBrightnessCap)
  const [dilatePasses, setDilatePasses] = useState(inkRemoveDefaults.dilatePasses)
  const [blurPx, setBlurPx] = useState(Math.round(inkRemoveDefaults.blurPx * 10) / 10)
  const [bleach, setBleach] = useState(Math.round(inkRemoveDefaults.bleachTowardPaper * 100))

  const inkOpts: InkRemoveOptions = useMemo(
    () => ({
      chromaStrength: chromaStrength / 100,
      printBlackBrightnessCap: printCap,
      dilatePasses,
      blurPx,
      bleachTowardPaper: bleach / 100,
    }),
    [bleach, blurPx, chromaStrength, dilatePasses, printCap],
  )

  const pickFolder = useCallback(async () => {
    setErrorText('')
    if (!supportsFsAccess()) {
      setErrorText(
        '当前浏览器不支持本地目录访问，请使用最新版 Chromium 内核浏览器（Chrome / Edge）。',
      )
      return
    }

    try {
      const dirPicker = window.showDirectoryPicker
      if (typeof dirPicker !== 'function') return
      const picked = await dirPicker()
      const readable = await verifyDirReadable(picked)
      if (!readable) {
        setErrorText('未取得读取所选目录的权限。')
        return
      }

      const list = await collectImagesRecursive(picked)
      setFolderName(picked.name)
      setDir(picked)
      setEntries(list)
      setCleanSet(new Set())
      setAsmOrder([])
      setStatusText(list.length === 0 ? '目录里没有找到常见图片格式。' : `已载入 ${list.length} 张图片。`)
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      setErrorText((e as Error)?.message ?? '选取目录时出现错误。')
    }
  }, [])

  const refreshList = useCallback(async () => {
    if (!dir) return
    setErrorText('')
    try {
      const list = await collectImagesRecursive(dir)
      setEntries(list)
      setStatusText(list.length === 0 ? '目录里没有找到常见图片格式。' : `已刷新，共 ${list.length} 张图片。`)

      const keep = new Set(list.map((e) => e.relativePath))
      setCleanSet((prev) => {
        const nx = new Set<string>()
        for (const id of prev) if (keep.has(id)) nx.add(id)
        return nx
      })
      setAsmOrder((prev) => prev.filter((id) => keep.has(id)))
    } catch (e) {
      setErrorText((e as Error)?.message ?? '刷新失败。')
    }
  }, [dir])

  const toggleClean = (rel: string) => {
    setCleanSet((prev) => {
      const nx = new Set(prev)
      if (nx.has(rel)) nx.delete(rel)
      else nx.add(rel)
      return nx
    })
  }

  const toggleAsm = (rel: string) => {
    setAsmOrder((order) => {
      const asm = new Set(order)
      const on = asm.has(rel)
      if (on) {
        asm.delete(rel)
        return order.filter((p) => p !== rel)
      }
      asm.add(rel)
      return [...order, rel]
    })
  }

  const runCleaning = async () => {
    if (!dir || cleanSet.size === 0) {
      setErrorText('请先在表格中勾选要「笔迹擦除」的图片。')
      return
    }
    setBusy('clean')
    setErrorText('')
    setStatusText('')
    try {
      const targets = entries.filter((e) => cleanSet.has(e.relativePath))
      let done = 0
      let failed = 0
      for (const row of targets) {
        try {
          const fh = row.file
          const fileObj = await fh.getFile()
          const output = await removeInkMarks(fileObj, inkOpts)

          const { writable } = await ensureCleanedWritable(dir, row.relativePath)
          await writable.write(output)
          await writable.close()

          done += 1
          setStatusText(`已写入 cleaned/ … ${done}/${targets.length}`)
        } catch {
          failed += 1
        }
      }
      const tail = failed > 0 ? `，${failed} 张写入失败（可能不是有效图片或被占用）。` : ''
      setStatusText(`已完成：${done}/${targets.length} 张写入到「cleaned」子目录${tail}`)
    } catch (e) {
      setErrorText((e as Error)?.message ?? '写入 cleaned 时出现错误（请保留目录授权）。')
    } finally {
      setBusy(null)
    }
  }

  const blobsForAsm = useCallback(async (): Promise<{ blob: Blob; path: string }[]> => {
    const rels = asmOrder.filter((rel) => entries.some((r) => r.relativePath === rel))
    if (rels.length === 0)
      throw new Error('请先勾选「编入错题」，或调整汇编顺序中包含至少一页图片。')

    const out: { blob: Blob; path: string }[] = []
    for (const rel of rels) {
      const entry = entries.find((e) => e.relativePath === rel)
      if (!entry) continue
      const f = await entry.file.getFile()
      out.push({ blob: f, path: rel })
    }
    return out
  }, [asmOrder, entries])

  const exportPdf = async () => {
    setBusy('pdf')
    setErrorText('')
    try {
      const rows = await blobsForAsm()
      const { blob, filename } = await buildPdfBlob(rows.map((r) => r.blob))
      const res = await syncPickerSave(blob, filename, 'pdf')
      setStatusText(
        res === 'saved'
          ? '已导出 PDF（通过系统对话框选择保存路径）。'
          : res === 'cancelled'
            ? '取消保存。'
            : '当前环境不支持 Save File 对话框。',
      )
    } catch (e) {
      setErrorText((e as Error)?.message ?? '导出 PDF 失败。')
    } finally {
      setBusy(null)
    }
  }

  const exportDocx = async () => {
    setBusy('docx')
    setErrorText('')
    try {
      const rows = await blobsForAsm()
      const docTitle =
        rows.length <= 8
          ? `错题汇编 · ${rows.map((r) => r.path.split('/').slice(-1)[0]).join(' · ')}`
          : `错题汇编（${rows.length} 页）`
      const shortTitle = rows.length <= 16 ? docTitle.slice(0, 120) : '错题汇编'

      const { blob, filename } = await buildDocxBlob(rows.map((r) => r.blob), shortTitle)

      const res = await syncPickerSave(blob, filename, 'docx')
      setStatusText(
        res === 'saved'
          ? '已导出 Word（.docx，通过对话框选择保存路径）。'
          : res === 'cancelled'
            ? '取消保存。'
            : '当前环境不支持 Save File 对话框。',
      )
    } catch (e) {
      setErrorText((e as Error)?.message ?? '导出 Word 失败。')
    } finally {
      setBusy(null)
    }
  }

  const reorderAsm = (index: number, delta: number) => {
    setAsmOrder((o) => moveWithin(o, index, delta))
  }

  const removeAsm = (rel: string) => {
    setAsmOrder((o) => o.filter((p) => p !== rel))
  }

  return (
    <div className="app-shell">
      <div className="title-row">
        <div>
          <h1>Paper Collector · 试卷图片工具</h1>
          <p className="subtitle">本地文件夹 → 勾选图片 → 「笔迹擦除」写入 cleaned/ ，或编入错题汇编并导出 PDF / Word。</p>
        </div>
        {!supportsFsAccess() ? <span className="pill-note">需要 File System Access（Chrome / Edge）</span> : null}
      </div>

      <div className="btn-row">
        <button type="button" className="btn-primary" onClick={pickFolder}>
          <FolderOpen size={16} />
          {folderName ? '重新选择文件夹' : '选择本地目录'}
        </button>
        <button type="button" className="btn-soft" disabled={!dir || !!busy} onClick={refreshList}>
          <RefreshCw size={16} />
          刷新列表
        </button>
        <span className="slug">{folderName ? `当前文件夹：${folderName}` : '尚未选择文件夹'}</span>
      </div>

      {!supportsFsAccess() ? (
        <div className="banner">
          Safari/Firefox 等浏览器无法在网页里获得稳定的「读整个目录」与「在用户目录里创建子文件夹」权限，请使用 Chromium
          系浏览器以获得完整体验。
        </div>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: '28%' }}>相对路径</th>
              <th style={{ width: '12%', textAlign: 'center' }}>笔迹擦除</th>
              <th style={{ width: '12%', textAlign: 'center' }}>编入错题</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => {
              const ck = cleanSet.has(row.relativePath)
              const ak = asmOrder.includes(row.relativePath)
              return (
                <tr key={row.relativePath}>
                  <td className="path-cell">{row.relativePath}</td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      aria-label={`笔迹擦除：${row.relativePath}`}
                      checked={ck}
                      onChange={() => toggleClean(row.relativePath)}
                      disabled={!dir || !!busy}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      aria-label={`编入错题：${row.relativePath}`}
                      checked={ak}
                      onChange={() => toggleAsm(row.relativePath)}
                      disabled={!dir || !!busy}
                    />
                  </td>
                </tr>
              )
            })}
            {entries.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ color: 'var(--muted)' }}>
                  {folderName ? '未发现图片或无读取权限；也确认未把图片放在顶层 cleaned 子目录（该目录不会在列表中枚举）。' : '请先选择本地目录'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="panel-grid">
        <section className="panel">
          <h2>
            <Eraser size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: '6px' }} />
            笔迹擦除 → cleaned/
          </h2>
          <p className="hint">
            对已勾选的每张图尝试弱化彩色笔迹，并<strong>在原目录新建或复用 「cleaned」</strong>
            ，按相同相对路径保存 PNG。纯浏览器算法对<strong>深色圆珠笔</strong>
            与印刷字重叠的区域效果有限，彩色水笔/Marker 类通常更明显。
          </p>

          <div className="controls">
            <div className="controls-row">
              <label title="调高更保守">
                <span>彩度阈值 {chromaStrength}%</span>
                <input
                  type="range"
                  min={4}
                  max={40}
                  value={chromaStrength}
                  onChange={(ev) => setChromaStrength(Number(ev.target.value))}
                  disabled={!!busy}
                />
              </label>
              <label title="压低可保护细长印刷字迹">
                <span>印刷黑亮度上限 {printCap}</span>
                <input
                  type="range"
                  min={80}
                  max={200}
                  value={printCap}
                  onChange={(ev) => setPrintCap(Number(ev.target.value))}
                  disabled={!!busy}
                />
              </label>
            </div>
            <div className="controls-row">
              <label>
                <span>掩膜膨胀 {dilatePasses}</span>
                <input
                  type="range"
                  min={0}
                  max={6}
                  value={dilatePasses}
                  onChange={(ev) => setDilatePasses(Number(ev.target.value))}
                  disabled={!!busy}
                />
              </label>
              <label>
                <span>弱化模糊 {blurPx}px</span>
                <input
                  type="range"
                  step={0.2}
                  min={0}
                  max={12}
                  value={blurPx}
                  onChange={(ev) => setBlurPx(Number(ev.target.value))}
                  disabled={!!busy}
                />
              </label>
              <label>
                <span>漂白纸色 {bleach}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={bleach}
                  onChange={(ev) => setBleach(Number(ev.target.value))}
                  disabled={!!busy}
                />
              </label>
            </div>
          </div>

          <div className="btn-row">
            <button type="button" className="btn-primary" disabled={!dir || cleanSet.size === 0 || !!busy} onClick={runCleaning}>
              {busy === 'clean' ? <Loader2 className="spinner" size={16} /> : <Eraser size={16} />}
              {busy === 'clean' ? `处理 ${cleanSet.size} 张 …` : '写入所选到 cleaned/' }
            </button>
          </div>
        </section>

        <section className="panel">
          <h2>
            <ClipboardList size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: '6px' }} />
            错题整理 → PDF / Word
          </h2>
          <p className="hint">勾选表格中的「编入错题」后在本区调整顺序（自上而下即导出顺序），最后使用系统对话框选择保存文件名与目录。</p>

          <ul className="queue-list">
            {asmOrder.length === 0 ? (
              <li className="queue-item">
                <div className="queue-path slug">暂未选择任何编入页；在上方表格勾选「编入错题」即可加入。</div>
                <span />
              </li>
            ) : (
              asmOrder.map((rel, idx) => (
                <li key={`${rel}-${idx}`} className="queue-item">
                  <div className="queue-path">{idx + 1}. {rel}</div>
                  <div className="queue-controls">
                    <button type="button" disabled={!!busy || idx === 0} onClick={() => reorderAsm(idx, -1)}>
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={!!busy || idx === asmOrder.length - 1}
                      onClick={() => reorderAsm(idx, +1)}
                    >
                      ↓
                    </button>
                    <button type="button" disabled={!!busy} onClick={() => removeAsm(rel)}>
                      ✕
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>

          <div className="btn-row" style={{ marginTop: '16px' }}>
            <button type="button" className="btn-primary" disabled={!!busy || asmOrder.length === 0} onClick={exportPdf}>
              {busy === 'pdf' ? <Loader2 className="spinner" size={16} /> : <Save size={16} />}
              导出 PDF
            </button>
            <button type="button" className="btn-soft" disabled={!!busy || asmOrder.length === 0} onClick={exportDocx}>
              {busy === 'docx' ? <Loader2 className="spinner" size={16} /> : <Save size={16} />}
              导出 Word（docx）
            </button>
          </div>
        </section>
      </div>

      <div className="status-line">
        <span>{statusText}</span>{' '}
        {busy ? (
          <>
            {' '}
            <strong>进行中…</strong>
          </>
        ) : null}
      </div>
      {errorText ? <div className="status-line error">{errorText}</div> : null}
    </div>
  )
}
