"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Folder, ImageIcon, Upload, FolderPlus, Trash2, Move, FolderUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { uploadToBlob } from "@/lib/blob-utils"
import { saveFileSystem, loadFileSystem } from "@/lib/storage-utils"
import { Progress } from "@/components/ui/progress"
import type { FileSystemItem } from "@/types/file-system"
import Image from "next/image"

type FileType = globalThis.File

// Initial file system structure
const initialFileSystem: FileSystemItem[] = [
  {
    id: "1",
    name: "Products",
    type: "folder",
    path: "/Products",
    children: [
      {
        id: "2",
        name: "Electronics",
        type: "folder",
        path: "/Products/Electronics",
        children: [
          {
            id: "3",
            name: "laptop.jpg",
            type: "image",
            path: "/Products/Electronics/laptop.jpg",
            url: "/placeholder.svg?height=300&width=400",
          },
        ],
      },
      {
        id: "4",
        name: "Clothing",
        type: "folder",
        path: "/Products/Clothing",
        children: [],
      },
    ],
  },
]

export function FileExplorer() {
  const [fileSystem, setFileSystem] = useState<FileSystemItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [selectedItem, setSelectedItem] = useState<FileSystemItem | null>(null)
  const [selectedItems, setSelectedItems] = useState<FileSystemItem[]>([])
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState("")
  const [currentPath, setCurrentPath] = useState<string>("/")
  const [newFolderPath, setNewFolderPath] = useState<string>("/")
  const [uploadPath, setUploadPath] = useState<string>("/")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<FileType[]>([])
  const [imageName, setImageName] = useState("")
  const [moveToPath, setMoveToPath] = useState<string>("/")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [totalFilesToUpload, setTotalFilesToUpload] = useState(0)
  const [filesUploaded, setFilesUploaded] = useState(0)

  const [draggedItem, setDraggedItem] = useState<FileSystemItem | null>(null)
  const [dragOverItem, setDragOverItem] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isMultiDragging, setIsMultiDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Load file system from localStorage on component mount
  useEffect(() => {
    const loadSavedFileSystem = async () => {
      try {
        const savedFileSystem = loadFileSystem()
        if (savedFileSystem && savedFileSystem.length > 0) {
          setFileSystem(savedFileSystem)
        } else {
          setFileSystem(initialFileSystem)
          saveFileSystem(initialFileSystem)
        }
      } catch (error) {
        console.error("Error loading file system:", error)
        setFileSystem(initialFileSystem)
      } finally {
        setIsLoading(false)
      }
    }

    loadSavedFileSystem()
  }, [])

  // Save file system to localStorage whenever it changes
  useEffect(() => {
    if (!isLoading) {
      saveFileSystem(fileSystem)
    }
  }, [fileSystem, isLoading])

  const getCurrentFolderContents = (path: string = currentPath): FileSystemItem[] => {
    if (path === "/") return fileSystem

    const folder = findItemByPath(path)
    return folder?.children || []
  }

  // Get all items in the current folder for selection purposes
  const currentFolderItems = getCurrentFolderContents()

  // Effect to clear selection when changing folders
  useEffect(() => {
    setSelectedItems([])
    setLastSelectedId(null)
  }, [currentPath])

  const findItemByPath = (path: string, items: FileSystemItem[] = fileSystem): FileSystemItem | null => {
    if (path === "/") return null

    for (const item of items) {
      if (item.path === path) return item
      if (item.children) {
        const found = findItemByPath(path, item.children)
        if (found) return found
      }
    }
    return null
  }

  const findItemById = (id: string, items: FileSystemItem[] = fileSystem): FileSystemItem | null => {
    for (const item of items) {
      if (item.id === id) return item
      if (item.children) {
        const found = findItemById(id, item.children)
        if (found) return found
      }
    }
    return null
  }

  const handleItemClick = (e: React.MouseEvent, item: FileSystemItem) => {
    // Handle double-click to navigate into folders
    if (e.detail === 2 && item.type === "folder") {
      setCurrentPath(item.path)
      setSelectedItem(item)
      setSelectedItems([])
      return
    }

    // Single click with no modifier keys - select only this item
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      setSelectedItem(item)
      setSelectedItems([item])
      setLastSelectedId(item.id)
      return
    }

    // Ctrl/Cmd+click - toggle selection of this item
    if (e.ctrlKey || e.metaKey) {
      const isSelected = selectedItems.some((selected) => selected.id === item.id)

      if (isSelected) {
        setSelectedItems(selectedItems.filter((selected) => selected.id !== item.id))
      } else {
        setSelectedItems([...selectedItems, item])
      }

      setSelectedItem(item)
      setLastSelectedId(item.id)
      return
    }

    // Shift+click - select range
    if (e.shiftKey && lastSelectedId) {
      const currentItems = getCurrentFolderContents()
      const lastSelectedIndex = currentItems.findIndex((i) => i.id === lastSelectedId)
      const currentIndex = currentItems.findIndex((i) => i.id === item.id)

      if (lastSelectedIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastSelectedIndex, currentIndex)
        const end = Math.max(lastSelectedIndex, currentIndex)
        const itemsInRange = currentItems.slice(start, end + 1)

        setSelectedItems(itemsInRange)
        setSelectedItem(item)
      }
    }
  }

  const handleBackClick = () => {
    if (currentPath === "/") return

    const pathParts = currentPath.split("/")
    pathParts.pop()
    const parentPath = pathParts.join("/") || "/"
    setCurrentPath(parentPath)
    setSelectedItem(findItemByPath(parentPath))
    setSelectedItems([])
  }

  const addFolder = () => {
    if (!newFolderName.trim()) {
      toast({
        title: "Error",
        description: "Folder name cannot be empty",
        variant: "destructive",
      })
      return
    }

    const newFolder: FileSystemItem = {
      id: Date.now().toString(),
      name: newFolderName,
      type: "folder",
      path: newFolderPath === "/" ? `/${newFolderName}` : `${newFolderPath}/${newFolderName}`,
      children: [],
    }

    const updatedFileSystem = [...fileSystem]

    if (newFolderPath === "/") {
      updatedFileSystem.push(newFolder)
    } else {
      const addFolderToPath = (items: FileSystemItem[]): boolean => {
        for (const item of items) {
          if (item.path === newFolderPath && item.type === "folder") {
            item.children = [...(item.children || []), newFolder]
            return true
          }
          if (item.children && addFolderToPath(item.children)) {
            return true
          }
        }
        return false
      }

      addFolderToPath(updatedFileSystem)
    }

    setFileSystem(updatedFileSystem)
    setNewFolderName("")
    toast({
      title: "Success",
      description: `Folder "${newFolderName}" created successfully`,
    })
  }

  const uploadImages = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please select files to upload",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setTotalFilesToUpload(selectedFiles.length)
    setFilesUploaded(0)

    const updatedFileSystem = [...fileSystem]
    const newImages: FileSystemItem[] = []

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      try {
        // Upload to Vercel Blob
        const result = await uploadToBlob(file, uploadPath)

        if (result.success) {
          const newImage: FileSystemItem = {
            id: Date.now().toString() + i,
            name: file.name,
            type: "image",
            path: `${uploadPath === "/" ? "" : uploadPath}/${file.name}`.replace(/\/\//g, "/"),
            url: result.url,
            size: file.size,
            blobPath: result.path,
          }

          newImages.push(newImage)
        } else {
          toast({
            title: "Upload Error",
            description: `Failed to upload ${file.name}: ${result.error}`,
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error uploading file:", error)
        toast({
          title: "Upload Error",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        })
      }

      // Update progress
      setFilesUploaded(i + 1)
      setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100))
    }

    // Add all successfully uploaded images to the file system
    if (newImages.length > 0) {
      if (uploadPath === "/") {
        updatedFileSystem.push(...newImages)
      } else {
        const addImagesToPath = (items: FileSystemItem[]): boolean => {
          for (const item of items) {
            if (item.path === uploadPath && item.type === "folder") {
              item.children = [...(item.children || []), ...newImages]
              return true
            }
            if (item.children && addImagesToPath(item.children)) {
              return true
            }
          }
          return false
        }

        addImagesToPath(updatedFileSystem)
      }

      setFileSystem(updatedFileSystem)
      toast({
        title: "Success",
        description: `Uploaded ${newImages.length} image${newImages.length > 1 ? "s" : ""} successfully`,
      })
    }

    setSelectedFiles([])
    setImagePreview(null)
    setImageName("")
    setIsUploading(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const fileArray = Array.from(files)
      setSelectedFiles(fileArray)

      // If only one file is selected, show preview
      if (fileArray.length === 1) {
        setImageName(fileArray[0].name)
        const reader = new FileReader()
        reader.onloadend = () => {
          setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(fileArray[0])
      } else {
        setImagePreview(null)
        setImageName(`${fileArray.length} files selected`)
      }
    }
  }

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      // Process folder structure
      const fileArray = Array.from(files)
      processFolder(fileArray)
    }
  }

  const processFolder = async (files: FileType[]) => {
    if (files.length === 0) return

    setIsUploading(true)
    setUploadProgress(0)
    setTotalFilesToUpload(files.length)
    setFilesUploaded(0)

    // Group files by folder structure
    const folderStructure: Record<string, FileType[]> = {}

    files.forEach((file) => {
      // webkitRelativePath gives us the folder structure
      const path = file.webkitRelativePath
      const folderPath = path.substring(0, path.lastIndexOf("/"))

      if (!folderStructure[folderPath]) {
        folderStructure[folderPath] = []
      }

      folderStructure[folderPath].push(file)
    })

    // Create folder structure in our file system
    const updatedFileSystem = [...fileSystem]
    let filesUploaded = 0

    for (const [folderPath, folderFiles] of Object.entries(folderStructure)) {
      // Create folders as needed
      const fullPath = `${uploadPath === "/" ? "" : uploadPath}/${folderPath}`.replace(/\/\//g, "/")
      const folderParts = folderPath.split("/")

      let currentPath = uploadPath
      let currentFileSystem = updatedFileSystem

      // Create each folder in the path if it doesn't exist
      for (const folderName of folderParts) {
        if (!folderName) continue

        const nextPath = `${currentPath === "/" ? "" : currentPath}/${folderName}`.replace(/\/\//g, "/")

        // Check if folder exists
        let folderExists = false
        let existingFolder: FileSystemItem | null = null

        if (currentPath === "/") {
          existingFolder = currentFileSystem.find((item) => item.type === "folder" && item.name === folderName) || null
        } else {
          const parentFolder = findItemByPath(currentPath, updatedFileSystem)
          if (parentFolder && parentFolder.children) {
            existingFolder =
              parentFolder.children.find((item) => item.type === "folder" && item.name === folderName) || null
          }
        }

        if (existingFolder) {
          folderExists = true
          currentPath = nextPath
          currentFileSystem = existingFolder.children || []
        } else {
          // Create new folder
          const newFolder: FileSystemItem = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            name: folderName,
            type: "folder",
            path: nextPath,
            children: [],
          }

          if (currentPath === "/") {
            currentFileSystem.push(newFolder)
          } else {
            const parentFolder = findItemByPath(currentPath, updatedFileSystem)
            if (parentFolder) {
              parentFolder.children = [...(parentFolder.children || []), newFolder]
            }
          }

          currentPath = nextPath
          currentFileSystem = newFolder.children || []
        }
      }

      // Upload files to this folder
      for (const file of folderFiles) {
        try {
          const result = await uploadToBlob(file, fullPath)

          if (result.success) {
            const fileName = file.name
            const filePath = `${fullPath}/${fileName}`.replace(/\/\//g, "/")

            const newImage: FileSystemItem = {
              id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
              name: fileName,
              type: "image",
              path: filePath,
              url: result.url,
              size: file.size,
              blobPath: result.path,
            }

            const parentFolder = findItemByPath(fullPath, updatedFileSystem)
            if (parentFolder) {
              parentFolder.children = [...(parentFolder.children || []), newImage]
            }
          }
        } catch (error) {
          console.error("Error uploading file:", error)
        }

        // Update progress
        filesUploaded++
        setFilesUploaded(filesUploaded)
        setUploadProgress(Math.round((filesUploaded / files.length) * 100))
      }
    }

    setFileSystem(updatedFileSystem)
    setIsUploading(false)

    toast({
      title: "Success",
      description: `Uploaded folder with ${files.length} files successfully`,
    })
  }

  const getAllPaths = (items: FileSystemItem[] = fileSystem, paths: string[] = ["/"]): string[] => {
    items.forEach((item) => {
      if (item.type === "folder") {
        paths.push(item.path)
        if (item.children) {
          getAllPaths(item.children, paths)
        }
      }
    })
    return paths
  }

  const handleDragStart = (e: React.DragEvent, item: FileSystemItem) => {
    e.stopPropagation()

    // If the item being dragged is not in the selection, make it the only selected item
    if (!selectedItems.some((selected) => selected.id === item.id)) {
      setSelectedItems([item])
      setSelectedItem(item)
    }

    setDraggedItem(item)
    setIsMultiDragging(selectedItems.length > 1)

    // Set data for the drag operation
    e.dataTransfer.setData("text/plain", JSON.stringify(selectedItems.map((item) => item.path)))
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault()
    e.stopPropagation()

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set a timeout to update the dragOverItem state
    timeoutRef.current = setTimeout(() => {
      setDragOverItem(targetPath)
    }, 100)

    e.dataTransfer.dropEffect = "move"
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set a timeout to clear the dragOverItem state
    timeoutRef.current = setTimeout(() => {
      setDragOverItem(null)
    }, 100)
  }

  const handleDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverItem(null)

    // If no items are selected or being dragged, do nothing
    if (selectedItems.length === 0) return

    // Don't allow dropping onto any of the selected items
    if (selectedItems.some((item) => item.path === targetPath)) {
      toast({
        title: "Invalid operation",
        description: "Cannot move items into themselves",
        variant: "destructive",
      })
      return
    }

    // Don't allow dropping a folder into its own child (would create circular reference)
    const hasCircularReference = selectedItems.some((item) => {
      return item.type === "folder" && targetPath.startsWith(item.path + "/")
    })

    if (hasCircularReference) {
      toast({
        title: "Invalid operation",
        description: "Cannot move a folder into its own subfolder",
        variant: "destructive",
      })
      return
    }

    // Create a deep copy of the file system
    const newFileSystem = JSON.parse(JSON.stringify(fileSystem))

    // Process each selected item
    const movedItems: FileSystemItem[] = []

    for (const selectedItem of selectedItems) {
      // Find and remove the item from its original location
      const removeItem = (items: FileSystemItem[]): [FileSystemItem[], FileSystemItem | null] => {
        let removedItem: FileSystemItem | null = null

        const newItems = items.filter((item) => {
          if (item.path === selectedItem.path) {
            removedItem = { ...item }
            return false
          }
          return true
        })

        for (let i = 0; i < newItems.length; i++) {
          if (newItems[i].children) {
            const [newChildren, removed] = removeItem(newItems[i].children!)
            if (removed) {
              removedItem = removed
              newItems[i].children = newChildren
            }
          }
        }

        return [newItems, removedItem]
      }

      const [updatedFileSystem, removedItem] = removeItem(newFileSystem)

      if (removedItem) {
        // Update the file system with the item removed
        Object.assign(newFileSystem, updatedFileSystem)

        // Update the path of the moved item and its children if it's a folder
        const updatePaths = (item: FileSystemItem, newParentPath: string): FileSystemItem => {
          const oldPath = item.path
          const itemName = item.name
          const newPath = newParentPath === "/" ? `/${itemName}` : `${newParentPath}/${itemName}`

          const updatedItem = {
            ...item,
            path: newPath,
          }

          if (item.type === "folder" && item.children) {
            updatedItem.children = item.children.map((child) => {
              return updatePaths(child, newPath)
            })
          }

          return updatedItem
        }

        const updatedItem = updatePaths(removedItem, targetPath)
        movedItems.push(updatedItem)
      }
    }

    // Add all moved items to the target location
    if (movedItems.length > 0) {
      // Add the items to their new location
      const addItemsToTarget = (items: FileSystemItem[]): boolean => {
        for (let i = 0; i < items.length; i++) {
          if (items[i].path === targetPath && items[i].type === "folder") {
            items[i].children = items[i].children || []
            items[i].children.push(...movedItems)
            return true
          }

          if (items[i].children && addItemsToTarget(items[i].children)) {
            return true
          }
        }

        return false
      }

      // If target is root, add directly to the file system
      if (targetPath === "/") {
        newFileSystem.push(...movedItems)
      } else {
        addItemsToTarget(newFileSystem)
      }

      setFileSystem(newFileSystem)
      setSelectedItems([])

      toast({
        title: "Success",
        description: `Moved ${movedItems.length} item${movedItems.length > 1 ? "s" : ""} to ${targetPath === "/" ? "root" : targetPath}`,
      })
    }
  }

  const moveSelectedItems = () => {
    if (selectedItems.length === 0) {
      toast({
        title: "Error",
        description: "No items selected",
        variant: "destructive",
      })
      return
    }

    // Don't allow moving a folder into its own child (would create circular reference)
    const hasCircularReference = selectedItems.some((item) => {
      return item.type === "folder" && moveToPath.startsWith(item.path + "/")
    })

    if (hasCircularReference) {
      toast({
        title: "Invalid operation",
        description: "Cannot move a folder into its own subfolder",
        variant: "destructive",
      })
      return
    }

    // Create a deep copy of the file system
    const newFileSystem = JSON.parse(JSON.stringify(fileSystem))

    // Process each selected item
    const movedItems: FileSystemItem[] = []

    for (const selectedItem of selectedItems) {
      // Find and remove the item from its original location
      const removeItem = (items: FileSystemItem[]): [FileSystemItem[], FileSystemItem | null] => {
        let removedItem: FileSystemItem | null = null

        const newItems = items.filter((item) => {
          if (item.path === selectedItem.path) {
            removedItem = { ...item }
            return false
          }
          return true
        })

        for (let i = 0; i < newItems.length; i++) {
          if (newItems[i].children) {
            const [newChildren, removed] = removeItem(newItems[i].children!)
            if (removed) {
              removedItem = removed
              newItems[i].children = newChildren
            }
          }
        }

        return [newItems, removedItem]
      }

      const [updatedFileSystem, removedItem] = removeItem(newFileSystem)

      if (removedItem) {
        // Update the file system with the item removed
        Object.assign(newFileSystem, updatedFileSystem)

        // Update the path of the moved item and its children if it's a folder
        const updatePaths = (item: FileSystemItem, newParentPath: string): FileSystemItem => {
          const oldPath = item.path
          const itemName = item.name
          const newPath = newParentPath === "/" ? `/${itemName}` : `${newParentPath}/${itemName}`

          const updatedItem = {
            ...item,
            path: newPath,
          }

          if (item.type === "folder" && item.children) {
            updatedItem.children = item.children.map((child) => {
              return updatePaths(child, newPath)
            })
          }

          return updatedItem
        }

        const updatedItem = updatePaths(removedItem, moveToPath)
        movedItems.push(updatedItem)
      }
    }

    // Add all moved items to the target location
    if (movedItems.length > 0) {
      // Add the items to their new location
      const addItemsToTarget = (items: FileSystemItem[]): boolean => {
        for (let i = 0; i < items.length; i++) {
          if (items[i].path === moveToPath && items[i].type === "folder") {
            items[i].children = items[i].children || []
            items[i].children.push(...movedItems)
            return true
          }

          if (items[i].children && addItemsToTarget(items[i].children)) {
            return true
          }
        }

        return false
      }

      // If target is root, add directly to the file system
      if (moveToPath === "/") {
        newFileSystem.push(...movedItems)
      } else {
        addItemsToTarget(newFileSystem)
      }

      setFileSystem(newFileSystem)
      setSelectedItems([])

      toast({
        title: "Success",
        description: `Moved ${movedItems.length} item${movedItems.length > 1 ? "s" : ""} to ${moveToPath === "/" ? "root" : moveToPath}`,
      })
    }
  }

  const deleteSelectedItems = () => {
    if (selectedItems.length === 0) return

    // Create a deep copy of the file system
    const newFileSystem = JSON.parse(JSON.stringify(fileSystem))

    // Process each selected item
    let deletedCount = 0

    for (const selectedItem of selectedItems) {
      // Find and remove the item from its location
      const removeItem = (items: FileSystemItem[]): FileSystemItem[] => {
        const newItems = items.filter((item) => {
          if (item.path === selectedItem.path) {
            deletedCount++
            return false
          }
          return true
        })

        for (let i = 0; i < newItems.length; i++) {
          if (newItems[i].children) {
            newItems[i].children = removeItem(newItems[i].children!)
          }
        }

        return newItems
      }

      Object.assign(newFileSystem, removeItem(newFileSystem))
    }

    setFileSystem(newFileSystem)
    setSelectedItems([])

    toast({
      title: "Success",
      description: `Deleted ${deletedCount} item${deletedCount > 1 ? "s" : ""}`,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Select all items with Ctrl+A
    if ((e.ctrlKey || e.metaKey) && e.key === "a") {
      e.preventDefault()
      setSelectedItems(getCurrentFolderContents())
    }

    // Delete selected items with Delete key
    if (e.key === "Delete" && selectedItems.length > 0) {
      e.preventDefault()
      deleteSelectedItems()
    }

    // Escape key to clear selection
    if (e.key === "Escape") {
      e.preventDefault()
      setSelectedItems([])
    }
  }

  const renderFileSystem = (items: FileSystemItem[], depth = 0) => {
    return items.map((item) => (
      <div key={item.id}>
        <div
          className={cn(
            "flex items-center gap-2 p-2 cursor-pointer hover:bg-accent rounded-md",
            selectedItem?.id === item.id && "bg-accent",
            selectedItems.some((selected) => selected.id === item.id) && "bg-accent/80 border border-primary/30",
            dragOverItem === item.path &&
              item.type === "folder" &&
              "bg-accent/50 border-2 border-dashed border-primary",
          )}
          onClick={(e) => handleItemClick(e, item)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          draggable
          onDragStart={(e) => handleDragStart(e, item)}
          onDragOver={(e) => item.type === "folder" && handleDragOver(e, item.path)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => item.type === "folder" && handleDrop(e, item.path)}
        >
          {item.type === "folder" ? (
            <Folder className="h-4 w-4 text-blue-500" />
          ) : (
            <ImageIcon className="h-4 w-4 text-green-500" />
          )}
          <span className="text-sm truncate">{item.name}</span>
        </div>
        {item.type === "folder" && item.children && renderFileSystem(item.children, depth + 1)}
      </div>
    ))
  }

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading file system...</span>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/40 flex flex-col">
        <div className="p-4 font-semibold">File Explorer</div>
        <Separator />
        <div className="flex gap-2 p-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setNewFolderPath(currentPath)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="path" className="text-sm font-medium">
                    Parent Path
                  </label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newFolderPath}
                    onChange={(e) => setNewFolderPath(e.target.value)}
                  >
                    {getAllPaths().map((path) => (
                      <option key={path} value={path}>
                        {path === "/" ? "/ (Root)" : path}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Folder Name
                  </label>
                  <Input
                    id="name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Enter folder name"
                  />
                </div>
                <Button onClick={addFolder}>Create Folder</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setUploadPath(currentPath)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Files</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="upload-path" className="text-sm font-medium">
                    Upload Path
                  </label>
                  <select
                    id="upload-path"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={uploadPath}
                    onChange={(e) => setUploadPath(e.target.value)}
                  >
                    {getAllPaths().map((path) => (
                      <option key={path} value={path}>
                        {path === "/" ? "/ (Root)" : path}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Upload Options</label>
                  <div className="flex flex-col gap-4">
                    <div>
                      <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Select Multiple Images
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>

                    <div>
                      <Button variant="outline" className="w-full" onClick={() => folderInputRef.current?.click()}>
                        <FolderUp className="h-4 w-4 mr-2" />
                        Upload Folder
                      </Button>
                      <input
                        ref={folderInputRef}
                        type="file"
                        webkitdirectory="true"
                        directory=""
                        multiple
                        className="hidden"
                        onChange={handleFolderSelect}
                      />
                    </div>
                  </div>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium mb-2">
                      {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} selected
                    </p>
                    {imagePreview && selectedFiles.length === 1 && (
                      <div className="relative h-40 w-full">
                        <Image
                          src={imagePreview || "/placeholder.svg"}
                          alt="Preview"
                          fill
                          className="object-contain rounded-md"
                        />
                      </div>
                    )}
                  </div>
                )}

                {isUploading && (
                  <div className="mt-2">
                    <p className="text-sm font-medium mb-2">
                      Uploading {filesUploaded} of {totalFilesToUpload}...
                    </p>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}

                <Button onClick={uploadImages} disabled={selectedFiles.length === 0 || isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Upload Files"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          <div className="p-2">{renderFileSystem(fileSystem)}</div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div
        className="flex-1 p-4 flex flex-col"
        onDragOver={(e) => currentPath === "/" && handleDragOver(e, "/")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => currentPath === "/" && handleDrop(e, "/")}
      >
        <div className="flex items-center gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={handleBackClick} disabled={currentPath === "/"}>
            Back
          </Button>
          <div className="text-sm bg-muted px-3 py-1 rounded-md flex-1">
            {currentPath === "/" ? "/ (Root)" : currentPath}
          </div>
        </div>

        {/* Selection Toolbar */}
        {selectedItems.length > 0 && (
          <div className="flex items-center gap-2 mb-4 p-2 bg-muted rounded-md">
            <span className="text-sm font-medium">
              {selectedItems.length} item{selectedItems.length > 1 ? "s" : ""} selected
            </span>
            <div className="ml-auto flex gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Move className="h-4 w-4 mr-2" />
                    Move
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      Move {selectedItems.length} item{selectedItems.length > 1 ? "s" : ""}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <label htmlFor="move-path" className="text-sm font-medium">
                        Destination Path
                      </label>
                      <select
                        id="move-path"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={moveToPath}
                        onChange={(e) => setMoveToPath(e.target.value)}
                      >
                        {getAllPaths().map((path) => (
                          <option key={path} value={path}>
                            {path === "/" ? "/ (Root)" : path}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button onClick={moveSelectedItems}>Move Items</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={deleteSelectedItems}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 border rounded-md p-4 bg-muted/20">
          {selectedItem && selectedItem.type === "image" ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="relative h-80 w-full">
                <Image
                  src={selectedItem.url || "/placeholder.svg?height=300&width=400"}
                  alt={selectedItem.name}
                  fill
                  className="object-contain"
                />
              </div>
              <div className="mt-4 text-center">
                <h3 className="font-medium">{selectedItem.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">Path: {selectedItem.path}</p>
                {selectedItem.size && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Size: {(selectedItem.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
                <div className="mt-4 p-2 bg-muted rounded-md">
                  <p className="text-sm font-mono">Reference this image using:</p>
                  <code className="text-xs bg-background p-1 rounded mt-1 block">
                    {`<img src="${selectedItem.path}" alt="${selectedItem.name}" />`}
                  </code>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getCurrentFolderContents().length === 0 ? (
                <div
                  className={cn(
                    "col-span-full flex flex-col items-center justify-center h-64 text-muted-foreground",
                    dragOverItem === currentPath && "bg-accent/50 border-2 border-dashed border-primary rounded-md",
                  )}
                  onDragOver={(e) => handleDragOver(e, currentPath)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, currentPath)}
                >
                  <Folder className="h-12 w-12 mb-2 opacity-20" />
                  <p>This folder is empty</p>
                  <p className="text-sm">Use the buttons above to add content or drag files here</p>
                </div>
              ) : (
                getCurrentFolderContents().map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "border rounded-md p-4 flex flex-col items-center cursor-pointer hover:bg-accent/50 transition-colors",
                      selectedItems.some((selected) => selected.id === item.id) &&
                        "bg-accent/80 border border-primary/30",
                      dragOverItem === item.path &&
                        item.type === "folder" &&
                        "bg-accent/50 border-2 border-dashed border-primary",
                    )}
                    onClick={(e) => handleItemClick(e, item)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    onDragOver={(e) => item.type === "folder" && handleDragOver(e, item.path)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => item.type === "folder" && handleDrop(e, item.path)}
                  >
                    {item.type === "folder" ? (
                      <Folder className="h-12 w-12 text-blue-500 mb-2" />
                    ) : (
                      <div className="relative h-24 w-24 mb-2">
                        <Image
                          src={item.url || "/placeholder.svg?height=100&width=100"}
                          alt={item.name}
                          fill
                          className="object-cover rounded-md"
                        />
                      </div>
                    )}
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground mt-1">{item.path}</span>
                    {item.size && item.type === "image" && (
                      <span className="text-xs text-muted-foreground mt-1">
                        {(item.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Path Reference */}
        <div className="mt-4 p-4 border rounded-md bg-muted/20">
          <h3 className="text-sm font-medium mb-2">Path Reference Guide</h3>
          <p className="text-sm text-muted-foreground">You can reference any image using its full path. For example:</p>
          <code className="text-xs bg-muted p-2 rounded mt-2 block">
            {`<img src="/Products/Electronics/laptop.jpg" alt="Laptop" />`}
          </code>
          <p className="text-sm text-muted-foreground mt-2">
            In your code, you can also use these paths with Next.js Image component:
          </p>
          <code className="text-xs bg-muted p-2 rounded mt-2 block">
            {`<Image src="/Products/Electronics/laptop.jpg" alt="Laptop" width={300} height={200} />`}
          </code>
        </div>
      </div>
    </div>
  )
}
