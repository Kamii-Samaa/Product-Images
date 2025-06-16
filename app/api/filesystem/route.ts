import { NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"
import type { FileSystemItem } from "@/types/file-system";

/**
 * Recursively scans a directory and builds a structured list of its contents,
 * focusing on image files and folders.
 * @param dirPath The absolute path to the directory to scan.
 * @param basePath The base path relative to the initial public directory, used to construct user-facing paths.
 * @returns A promise that resolves to an array of FileSystemItem objects.
 */
async function scanDirectory(dirPath: string, basePath = ""): Promise<FileSystemItem[]> {
  try {
    // Read all entries (files and directories) in the current directory path
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items: FileSystemItem[] = [];

    for (const entry of entries) {
      try {
        const fullPath = path.join(dirPath, entry.name);
        // Construct the relative path for client-side display and identification.
        // basePath accumulates the path as we go deeper into directories.
        // Ensures consistent use of forward slashes for web paths.
        const relativePath = path.join(basePath, entry.name).replace(/\\/g, "/");

        // Skip hidden files and directories (e.g., .git, .DS_Store)
        // These are generally not intended for public display.
        if (entry.name.startsWith(".")) {
          continue;
        }

        // Check if the entry is a directory
        if (entry.isDirectory()) {
          // If it's a directory, recursively call scanDirectory to process its contents.
          // The current relativePath becomes the basePath for its children.
          const children = await scanDirectory(fullPath, relativePath);
          items.push({
            id: relativePath, // Use relativePath as a unique ID
            name: entry.name,
            type: "folder",
            path: `/${relativePath}`, // Prepend slash for URL-like path
            children,
          });
        } else {
          // If it's a file, check if it's a supported image type.
          const ext = path.extname(entry.name).toLowerCase();
          // Filter for common web image formats.
          if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"].includes(ext)) {
            let stats;
            try {
              // Attempt to get file statistics (like size)
              stats = await fs.stat(fullPath);
            } catch (statError) {
              // Log error if fs.stat fails (e.g. permissions, broken symlink) and skip this file.
              console.error(`Error getting stats for file ${fullPath}:`, statError);
              continue;
            }
            items.push({
              id: relativePath,
              name: entry.name,
              type: "image",
              path: `/${relativePath}`,
              url: `/${relativePath}`, // URL is the same as the path for local serving
              size: stats.size,
            });
          }
          // Other file types are ignored.
        }
      } catch (entryError) {
        // Catch errors related to processing a specific entry (e.g., unexpected issues).
        // This ensures that one problematic entry doesn't halt the entire directory scan.
        console.error(`Error processing directory entry ${entry.name} in ${dirPath}:`, entryError);
        // Continue to the next entry.
      }
    }
    return items;
  } catch (error) {
    // This outer catch handles errors from the initial fs.readdir call itself (e.g., if dirPath doesn't exist or is inaccessible).
    console.error(`Error reading directory ${dirPath}:`, error);
    return []; // Return an empty array to indicate failure for this path.
  }
}

/**
 * API endpoint (GET) to retrieve the file system structure of the 'public' directory.
 * It scans the 'public' directory and returns a JSON representation of its image files and folders.
 */
export async function GET() {
  try {
    // Construct the absolute path to the 'public' directory.
    const publicDir = path.join(process.cwd(), "public");
    // Scan the directory starting from its root (basePath is empty).
    const fileSystem = await scanDirectory(publicDir);

    return NextResponse.json({ fileSystem });
  } catch (error) {
    console.error("Error building file system:", error);
    return NextResponse.json({ error: "Failed to build file system" }, { status: 500 });
  }
}
