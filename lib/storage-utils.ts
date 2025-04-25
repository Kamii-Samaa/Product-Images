import type { FileSystemItem } from "@/types/file-system"

const FILE_SYSTEM_KEY = "file-explorer-system"

export function saveFileSystem(fileSystem: FileSystemItem[]): void {
  try {
    localStorage.setItem(FILE_SYSTEM_KEY, JSON.stringify(fileSystem))
  } catch (error) {
    console.error("Error saving file system:", error)
  }
}

export function loadFileSystem(): FileSystemItem[] | null {
  try {
    const savedFileSystem = localStorage.getItem(FILE_SYSTEM_KEY)
    return savedFileSystem ? JSON.parse(savedFileSystem) : null
  } catch (error) {
    console.error("Error loading file system:", error)
    return null
  }
}
