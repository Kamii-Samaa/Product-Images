export type FileSystemItem = {
  id: string // UUID from DB
  name: string
  type: "folder" | "image"
  path: string // Full path like /folder/image.jpg
  url?: string // Vercel Blob URL for images
  size?: number // File size in bytes
  width?: number // Image width
  height?: number // Image height
  parent_id?: string | null // UUID of parent folder
  children?: FileSystemItem[] // For tree structure in frontend
  created_at?: string
  created_by?: string
}

export type UserRole = "admin" | "uploader" | "viewer" // Define roles
