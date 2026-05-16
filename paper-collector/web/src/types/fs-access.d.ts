/** Chromium File System Access 等 typings 的补充（对齐 TS DOM.lib）。 */

export {}

declare global {
  type FilePickerAcceptType = {
    description?: string
    accept: Record<string, string | readonly string[]>
  }

  interface FileSystemDirectoryHandle {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>
    keys(): AsyncIterableIterator<string>
    values(): AsyncIterableIterator<FileSystemHandle>
  }

  interface Window {
    showDirectoryPicker?(options?: {
      id?: string
      mode?: 'read'
      startIn?: FileSystemHandle | WellKnownDirectory
    }): Promise<FileSystemDirectoryHandle>

    showSaveFilePicker?(options?: {
      suggestedName?: string
      types?: FilePickerAcceptType[]
      excludeAcceptAllOption?: boolean
    }): Promise<FileSystemFileHandle>
  }

  type WellKnownDirectory = 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
}
