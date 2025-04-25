import { put } from "@vercel/blob"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const path = formData.get("path") as string

    if (!file || !path) {
      return NextResponse.json({ error: "File and path are required" }, { status: 400 })
    }

    // Generate a unique filename to avoid collisions
    const filename = `${Date.now()}-${file.name}`
    const blobPath = `${path}/${filename}`.replace(/\/\//g, "/")

    // Upload to Vercel Blob
    const { url } = await put(blobPath, file, {
      access: "public",
      addRandomSuffix: false,
    })

    return NextResponse.json({
      success: true,
      url,
      path: blobPath,
      name: file.name,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error("Error uploading to Blob:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
