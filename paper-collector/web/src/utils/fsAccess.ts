/** 递归收集图片文件；跳过根目录下 `cleaned/` 以避免处理输出文件夹。 */

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i

export type ImageEntry = {
  relativePath: string
  file: FileSystemFileHandle
}

function isSkippedByCleanedRelative(relativePath: string): boolean {
  const norm = relativePath.replace(/\\/g, '/')
  return norm === 'cleaned' || norm.startsWith('cleaned/')
}

export async function collectImagesRecursive(dirHandle: FileSystemDirectoryHandle): Promise<ImageEntry[]> {
  return enumerateDir(dirHandle, '')
}

async function enumerateDir(dir: FileSystemDirectoryHandle, prefix: string): Promise<ImageEntry[]> {
  const out: ImageEntry[] = []
  for await (const handle of dir.values()) {
    const name = handle.name
    const rel = prefix ? `${prefix}/${name}` : name
    if (handle.kind === 'directory') {
      if (isSkippedByCleanedRelative(rel)) continue
      const sub = await enumerateDir(handle as FileSystemDirectoryHandle, rel)
      out.push(...sub)
    } else if (IMAGE_EXT.test(name)) {
      out.push({ relativePath: rel, file: handle as FileSystemFileHandle })
    }
  }
  return out.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

async function resolveOrCreateDirectories(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<FileSystemDirectoryHandle> {
  const normalized = relativePath.replace(/\\/g, '/').split('/').filter(Boolean)
  let current = root
  for (const segment of normalized) {
    current = await current.getDirectoryHandle(segment, { create: true })
  }
  return current
}

export async function ensureCleanedWritable(
  root: FileSystemDirectoryHandle,
  relativePathInsideCleaned: string,
): Promise<{ file: FileSystemFileHandle; writable: FileSystemWritableFileStream }> {
  const normalized = relativePathInsideCleaned.replace(/^\/+/, '')
  const lastSlash = normalized.lastIndexOf('/')
  const parentRel = lastSlash >= 0 ? normalized.slice(0, lastSlash) : ''
  const fileName = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized
  const cleaned = await resolveOrCreateDirectories(root, 'cleaned')
  const dir = parentRel ? await resolveOrCreateDirectories(cleaned, parentRel) : cleaned
  const file = await dir.getFileHandle(fileName, { create: true })
  const writable = await file.createWritable()
  return { file, writable }
}
