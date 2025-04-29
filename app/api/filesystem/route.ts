import { NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"
import type { FileSystemItem } from "@/types/file-system"

// Function to recursively scan a directory and build the file system structure
async function scanDirectory(dirPath: string, basePath = ""): Promise<FileSystemItem[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const items: FileSystemItem[] = []

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      const relativePath = path.join(basePath, entry.name).replace(/\\/g, "/")

      // Skip hidden files and directories (starting with .)
      if (entry.name.startsWith(".")) continue

      if (entry.isDirectory()) {
        const children = await scanDirectory(fullPath, relativePath)
        items.push({
          id: relativePath,
          name: entry.name,
          type: "folder",
          path: `/${relativePath}`,
          children,
        })
      } else {
        // Only include image files
        const ext = path.extname(entry.name).toLowerCase()
        if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"].includes(ext)) {
          const stats = await fs.stat(fullPath)
          items.push({
            id: relativePath,
            name: entry.name,
            type: "image",
            path: `/${relativePath}`,
            url: `/${relativePath}`,
            size: stats.size,
          })
        }
      }
    }

    return items
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error)
    return []
  }
}

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), "public")
    const fileSystem = await scanDirectory(publicDir)

    return NextResponse.json({ fileSystem })
  } catch (error) {
    console.error("Error building file system:", error)
    return NextResponse.json({ error: "Failed to build file system" }, { status: 500 })
  }
}
