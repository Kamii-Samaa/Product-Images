import { put } from "@vercel/blob"
import { nanoid } from "nanoid"

export async function uploadToBlob(file: File, path: string) {
  try {
    // Generate a unique filename to avoid collisions
    const filename = `${nanoid()}-${file.name}`
    const blobPath = `${path}/${filename}`.replace(/\/\//g, "/")

    // Upload to Vercel Blob
    const { url } = await put(blobPath, file, {
      access: "public",
      addRandomSuffix: false,
    })

    return {
      success: true,
      url,
      path: blobPath,
      name: file.name,
      size: file.size,
      type: file.type,
    }
  } catch (error) {
    console.error("Error uploading to Blob:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
