"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Folder, ImageIcon, Loader2, ExternalLink, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import type { FileSystemItem } from "@/types/file-system"
import Image from "next/image"

export function FileExplorer() {
  const [fileSystem, setFileSystem] = useState<FileSystemItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [selectedItem, setSelectedItem] = useState<FileSystemItem | null>(null)
  const [selectedItems, setSelectedItems] = useState<FileSystemItem[]>([])
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState<string>("/")

  const [draggedItem, setDraggedItem] = useState<FileSystemItem | null>(null)
  const [dragOverItem, setDragOverItem] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isMultiDragging, setIsMultiDragging] = useState(false)

  // Fetch file system from API on component mount
  useEffect(() => {
    fetchFileSystem()
  }, [])

  const fetchFileSystem = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/filesystem")

      if (!response.ok) {
        throw new Error(`Failed to fetch file system: ${response.status}`)
      }

      const data = await response.json()

      if (data.fileSystem) {
        setFileSystem(data.fileSystem)
      } else {
        setFileSystem([])
        toast({
          title: "No files found",
          description: "No image files were found in the public directory",
        })
      }
    } catch (error) {
      console.error("Error fetching file system:", error)
      toast({
        title: "Error",
        description: "Failed to load files from the repository",
        variant: "destructive",
      })
      setFileSystem([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const refreshFileSystem = () => {
    setIsRefreshing(true)
    fetchFileSystem()
  }

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
    try {
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
    } catch (error) {
      console.error("Error handling item click:", error)
      toast({
        title: "Error",
        description: "There was a problem selecting this item",
        variant: "destructive",
      })
    }
  }

  const handleBackClick = () => {
    try {
      if (currentPath === "/") return

      const pathParts = currentPath.split("/").filter(Boolean)
      if (pathParts.length === 0) return

      pathParts.pop()
      const parentPath = pathParts.length === 0 ? "/" : `/${pathParts.join("/")}`

      setCurrentPath(parentPath)
      const parentItem = findItemByPath(parentPath)
      setSelectedItem(parentItem)
      setSelectedItems([])
    } catch (error) {
      console.error("Error navigating back:", error)
      // Reset to root as a fallback
      setCurrentPath("/")
      setSelectedItem(null)
      setSelectedItems([])
      toast({
        title: "Navigation Error",
        description: "There was a problem navigating back. Returned to root directory.",
        variant: "destructive",
      })
    }
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Select all items with Ctrl+A
    if ((e.ctrlKey || e.metaKey) && e.key === "a") {
      e.preventDefault()
      setSelectedItems(getCurrentFolderContents())
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

  const copyImagePath = (path: string) => {
    navigator.clipboard
      .writeText(window.location.origin + path)
      .then(() => {
        toast({
          title: "Copied!",
          description: "Image path copied to clipboard",
        })
      })
      .catch((err) => {
        console.error("Failed to copy path:", err)
        toast({
          title: "Error",
          description: "Failed to copy path to clipboard",
          variant: "destructive",
        })
      })
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
        <div className="p-4 font-semibold flex justify-between items-center">
          <span>File Explorer</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={refreshFileSystem}
            disabled={isRefreshing}
            title="Refresh file system"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          <div className="p-2">{renderFileSystem(fileSystem)}</div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={handleBackClick} disabled={currentPath === "/"}>
            Back
          </Button>
          <div className="text-sm bg-muted px-3 py-1 rounded-md flex-1">
            {currentPath === "/" ? "/ (Root)" : currentPath}
          </div>
        </div>

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
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-mono">Reference this image using:</p>
                    <Button variant="ghost" size="sm" onClick={() => copyImagePath(selectedItem.path)} className="h-6">
                      Copy
                    </Button>
                  </div>
                  <code className="text-xs bg-background p-1 rounded mt-1 block">
                    {`<img src="${selectedItem.path}" alt="${selectedItem.name}" />`}
                  </code>
                  <div className="mt-2 flex justify-between items-center">
                    <p className="text-sm font-mono">Direct link:</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6"
                      onClick={() => window.open(window.location.origin + selectedItem.path, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open
                    </Button>
                  </div>
                  <code className="text-xs bg-background p-1 rounded mt-1 block overflow-hidden text-ellipsis">
                    {window.location.origin + selectedItem.path}
                  </code>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getCurrentFolderContents().length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Folder className="h-12 w-12 mb-2 opacity-20" />
                  <p>This folder is empty</p>
                  <p className="text-sm">Add images to this folder in your GitHub repository</p>
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
          <h3 className="text-sm font-medium mb-2">Product Upload Guide</h3>
          <p className="text-sm text-muted-foreground">
            Images added to the GitHub repository's <code className="bg-muted px-1 rounded">public</code> directory
            will automatically appear here.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            You can share direct links to any image by selecting it and copying the direct link.
          </p>
        </div>
      </div>
    </div>
  )
}
