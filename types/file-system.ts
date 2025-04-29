export type FileSystemItem = {
  id: string
  name: string
  type: "folder" | "image"
  path: string
  children?: FileSystemItem[]
  url?: string
  size?: number
}
