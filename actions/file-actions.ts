"use server"

import { createClient } from "@/lib/supabase/server"
import { put, del } from "@vercel/blob"
import { nanoid } from "nanoid"
import type { FileSystemItem } from "@/types/file-system"
import sharp from "sharp"

// Helper to get user session and check roles
async function getUserSessionAndRoles() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error("Unauthorized: No active session.")
  }

  const { data: rolesData, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)

  if (rolesError) {
    console.error("Error fetching user roles:", rolesError.message)
    throw new Error("Failed to fetch user roles.")
  }

  const roles = rolesData ? rolesData.map((r) => r.role) : []
  return { session, roles }
}

// Recursive function to build file system tree from flat list
function buildTree(items: FileSystemItem[], parentId: string | null = null): FileSystemItem[] {
  return items
    .filter((item) => item.parent_id === parentId)
    .map((item) => ({
      ...item,
      children: item.type === "folder" ? buildTree(items, item.id) : undefined,
    }))
    .sort((a, b) => {
      // Sort folders first, then by name
      if (a.type === "folder" && b.type !== "folder") return -1
      if (a.type !== "folder" && b.type === "folder") return 1
      return a.name.localeCompare(b.name)
    })
}

export async function getFileSystem(): Promise<{ success: boolean; fileSystem?: FileSystemItem[]; error?: string }> {
  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: "Unauthorized: Please log in." }
    }

    const { data, error } = await supabase.from("files").select("*").order("name", { ascending: true })

    if (error) {
      console.error("Error fetching file system:", error.message)
      return { success: false, error: "Failed to load file system." }
    }

    const fileSystemTree = buildTree(data as FileSystemItem[])
    return { success: true, fileSystem: fileSystemTree }
  } catch (e: any) {
    console.error("Server action error (getFileSystem):", e.message)
    return { success: false, error: e.message || "An unexpected error occurred." }
  }
}

export async function createFolder(
  name: string,
  parentPath: string,
): Promise<{ success: boolean; folder?: FileSystemItem; error?: string }> {
  try {
    const { roles } = await getUserSessionAndRoles()
    if (!roles.includes("admin")) {
      return { success: false, error: "Forbidden: Only admins can create folders." }
    }

    const supabase = createClient()

    // Determine parent_id
    let parentId: string | null = null
    if (parentPath !== "/") {
      const { data: parentFolder, error: parentError } = await supabase
        .from("files")
        .select("id")
        .eq("path", parentPath)
        .single()

      if (parentError || !parentFolder) {
        return { success: false, error: "Parent folder not found or accessible." }
      }
      parentId = parentFolder.id
    }

    const newPath = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`

    // Check for existing item at path
    const { data: existingItem, error: existingError } = await supabase
      .from("files")
      .select("id")
      .eq("path", newPath)
      .single()

    if (existingItem) {
      return { success: false, error: "A folder or file with this name already exists at this path." }
    }

    const { data, error } = await supabase
      .from("files")
      .insert({ name, type: "folder", path: newPath, parent_id: parentId })
      .select()
      .single()

    if (error) {
      console.error("Error creating folder:", error.message)
      return { success: false, error: "Failed to create folder." }
    }

    return { success: true, folder: data as FileSystemItem }
  } catch (e: any) {
    console.error("Server action error (createFolder):", e.message)
    return { success: false, error: e.message || "An unexpected error occurred." }
  }
}

export async function uploadFile(
  formData: FormData,
): Promise<{ success: boolean; file?: FileSystemItem; error?: string }> {
  try {
    const { roles } = await getUserSessionAndRoles()
    if (!roles.includes("admin") && !roles.includes("uploader")) {
      return { success: false, error: "Forbidden: Only admins and uploaders can upload files." }
    }

    const file = formData.get("file") as File
    const uploadPath = formData.get("path") as string

    if (!file || !uploadPath) {
      return { success: false, error: "File and upload path are required." }
    }

    const supabase = createClient()

    // Determine parent_id
    let parentId: string | null = null
    if (uploadPath !== "/") {
      const { data: parentFolder, error: parentError } = await supabase
        .from("files")
        .select("id")
        .eq("path", uploadPath)
        .single()

      if (parentError || !parentFolder) {
        return { success: false, error: "Parent folder not found or accessible." }
      }
      parentId = parentFolder.id
    }

    // Upload to Vercel Blob
    const filename = `${nanoid()}-${file.name}`
    const blobPath = `${uploadPath === "/" ? "" : uploadPath}/${filename}`.replace(/\/\//g, "/")
    const { url: blobUrl } = await put(blobPath, file, {
      access: "public",
      addRandomSuffix: false,
    })

    let width: number | undefined
    let height: number | undefined
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()

    // Get image dimensions for non-SVG files
    if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"].includes(ext)) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const metadata = await sharp(buffer).metadata()
        width = metadata.width
        height = metadata.height
      } catch (imgError) {
        console.warn(`Could not get dimensions for ${file.name}:`, imgError)
      }
    }

    const newFilePath = `${uploadPath === "/" ? "" : uploadPath}/${file.name}`.replace(/\/\//g, "/")

    // Check for existing item at path
    const { data: existingItem, error: existingError } = await supabase
      .from("files")
      .select("id")
      .eq("path", newFilePath)
      .single()

    if (existingItem) {
      // If item exists, update it (e.g., replace file)
      // For simplicity, we'll just return an error for now.
      // In a real app, you might want to offer to replace or rename.
      await del(blobUrl) // Delete the newly uploaded blob if path already exists
      return {
        success: false,
        error: "A file with this name already exists at this path. Please rename or delete the existing file.",
      }
    }

    // Record in Supabase
    const { data, error } = await supabase
      .from("files")
      .insert({
        name: file.name,
        type: "image",
        path: newFilePath,
        url: blobUrl,
        size: file.size,
        width,
        height,
        parent_id: parentId,
      })
      .select()
      .single()

    if (error) {
      console.error("Error recording file in DB:", error.message)
      await del(blobUrl) // Clean up blob if DB insert fails
      return { success: false, error: "Failed to record file in database." }
    }

    return { success: true, file: data as FileSystemItem }
  } catch (e: any) {
    console.error("Server action error (uploadFile):", e.message)
    return { success: false, error: e.message || "An unexpected error occurred." }
  }
}

export async function renameItem(id: string, newName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { roles } = await getUserSessionAndRoles()
    if (!roles.includes("admin")) {
      return { success: false, error: "Forbidden: Only admins can rename files." }
    }

    const supabase = createClient()

    const { data: item, error: fetchError } = await supabase
      .from("files")
      .select("path, type, parent_id")
      .eq("id", id)
      .single()

    if (fetchError || !item) {
      return { success: false, error: "Item not found." }
    }

    const parentPath = item.parent_id
      ? (await supabase.from("files").select("path").eq("id", item.parent_id).single()).data?.path || "/"
      : "/"

    const newPath = parentPath === "/" ? `/${newName}` : `${parentPath}/${newName}`

    // Check for existing item at new path
    const { data: existingItem, error: existingError } = await supabase
      .from("files")
      .select("id")
      .eq("path", newPath)
      .single()

    if (existingItem && existingItem.id !== id) {
      return { success: false, error: "An item with this name already exists at the new path." }
    }

    const { error } = await supabase.from("files").update({ name: newName, path: newPath }).eq("id", id)

    if (error) {
      console.error("Error renaming item:", error.message)
      return { success: false, error: "Failed to rename item." }
    }

    // If it's a folder, update paths of all its children recursively
    if (item.type === "folder") {
      const { data: children, error: childrenError } = await supabase
        .from("files")
        .select("id, path, name, type")
        .like("path", `${item.path}/%`)

      if (childrenError) {
        console.error("Error fetching children for path update:", childrenError.message)
        // Continue, but warn about potential inconsistencies
      } else if (children) {
        for (const child of children) {
          const newChildPath = child.path.replace(item.path, newPath)
          await supabase.from("files").update({ path: newChildPath }).eq("id", child.id)
        }
      }
    }

    return { success: true }
  } catch (e: any) {
    console.error("Server action error (renameItem):", e.message)
    return { success: false, error: e.message || "An unexpected error occurred." }
  }
}

export async function moveItem(id: string, newParentPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { roles } = await getUserSessionAndRoles()
    if (!roles.includes("admin")) {
      return { success: false, error: "Forbidden: Only admins can move files." }
    }

    const supabase = createClient()

    const { data: item, error: fetchError } = await supabase
      .from("files")
      .select("name, path, type")
      .eq("id", id)
      .single()

    if (fetchError || !item) {
      return { success: false, error: "Item not found." }
    }

    // Determine new parent_id
    let newParentId: string | null = null
    if (newParentPath !== "/") {
      const { data: targetFolder, error: targetError } = await supabase
        .from("files")
        .select("id")
        .eq("path", newParentPath)
        .single()

      if (targetError || !targetFolder) {
        return { success: false, error: "Target folder not found or accessible." }
      }
      newParentId = targetFolder.id
    }

    const newPath = newParentPath === "/" ? `/${item.name}` : `${newParentPath}/${item.name}`

    // Check for circular reference (moving a folder into its own child)
    if (item.type === "folder" && newParentPath.startsWith(item.path + "/")) {
      return { success: false, error: "Cannot move a folder into its own subfolder." }
    }

    // Check for existing item at new path
    const { data: existingItem, error: existingError } = await supabase
      .from("files")
      .select("id")
      .eq("path", newPath)
      .single()

    if (existingItem && existingItem.id !== id) {
      return { success: false, error: "An item with the same name already exists at the destination." }
    }

    const { error } = await supabase.from("files").update({ parent_id: newParentId, path: newPath }).eq("id", id)

    if (error) {
      console.error("Error moving item:", error.message)
      return { success: false, error: "Failed to move item." }
    }

    // If it's a folder, update paths of all its children recursively
    if (item.type === "folder") {
      const { data: children, error: childrenError } = await supabase
        .from("files")
        .select("id, path, name, type")
        .like("path", `${item.path}/%`)

      if (childrenError) {
        console.error("Error fetching children for path update:", childrenError.message)
        // Continue, but warn about potential inconsistencies
      } else if (children) {
        for (const child of children) {
          const newChildPath = child.path.replace(item.path, newPath)
          await supabase.from("files").update({ path: newChildPath }).eq("id", child.id)
        }
      }
    }

    return { success: true }
  } catch (e: any) {
    console.error("Server action error (moveItem):", e.message)
    return { success: false, error: e.message || "An unexpected error occurred." }
  }
}

export async function deleteItem(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { roles } = await getUserSessionAndRoles()
    if (!roles.includes("admin")) {
      return { success: false, error: "Forbidden: Only admins can delete files." }
    }

    const supabase = createClient()

    const { data: itemToDelete, error: fetchError } = await supabase
      .from("files")
      .select("path, type, url")
      .eq("id", id)
      .single()

    if (fetchError || !itemToDelete) {
      return { success: false, error: "Item not found." }
    }

    // If it's a folder, recursively delete its children first
    if (itemToDelete.type === "folder") {
      const { data: children, error: childrenError } = await supabase
        .from("files")
        .select("id, type, url")
        .like("path", `${itemToDelete.path}/%`)

      if (childrenError) {
        console.error("Error fetching children for deletion:", childrenError.message)
        return { success: false, error: "Failed to fetch children for deletion." }
      }

      for (const child of children) {
        if (child.type === "image" && child.url) {
          await del(child.url) // Delete from Vercel Blob
        }
        await supabase.from("files").delete().eq("id", child.id) // Delete from DB
      }
    } else if (itemToDelete.type === "image" && itemToDelete.url) {
      await del(itemToDelete.url) // Delete from Vercel Blob
    }

    // Finally, delete the item itself from DB
    const { error } = await supabase.from("files").delete().eq("id", id)

    if (error) {
      console.error("Error deleting item from DB:", error.message)
      return { success: false, error: "Failed to delete item from database." }
    }

    return { success: true }
  } catch (e: any) {
    console.error("Server action error (deleteItem):", e.message)
    return { success: false, error: e.message || "An unexpected error occurred." }
  }
}
