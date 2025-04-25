import type { FileSystemItem } from "@/types/file-system"

const FILE_SYSTEM_KEY = "file-explorer-system"

export function saveFileSystem(fileSystem: FileSystemItem[]): void {
  try {
    // Make sure fileSystem is an array
    if (!Array.isArray(fileSystem)) {
      console.error("Invalid file system format, expected an array")
      return
    }

    const serializedData = JSON.stringify(fileSystem)
    localStorage.setItem(FILE_SYSTEM_KEY, serializedData)
    console.log("File system saved successfully")
  } catch (error) {
    console.error("Error saving file system:", error)
  }
}

export function loadFileSystem(): FileSystemItem[] | null {
  try {
    const savedFileSystem = localStorage.getItem(FILE_SYSTEM_KEY)

    if (!savedFileSystem) {
      console.log("No saved file system found")
      return null
    }

    const parsedData = JSON.parse(savedFileSystem) as FileSystemItem[]

    // Validate that we have an array
    if (!Array.isArray(parsedData)) {
      console.error("Invalid saved file system format")
      return null
    }

    console.log("File system loaded successfully")
    return parsedData
  } catch (error) {
    console.error("Error loading file system:", error)
    // Clear potentially corrupted data
    try {
      localStorage.removeItem(FILE_SYSTEM_KEY)
    } catch (e) {
      console.error("Failed to remove corrupted file system data:", e)
    }
    return null
  }
}
