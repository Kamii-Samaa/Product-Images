"use client"

import React from "react"
import { useState, useEffect, useMemo } from "react"
import {
  Folder,
  ImageIcon,
  Loader2,
  ExternalLink,
  RefreshCw,
  Grid,
  List,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import type { FileSystemItem } from "@/types/file-system"
import Image from "next/image"

type SortOrder = "name-asc" | "name-desc" | "type-asc" | "size-desc"

export function FileExplorer() {
  const [fileSystem, setFileSystem] = useState<FileSystemItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [selectedItem, setSelectedItem] = useState<FileSystemItem | null>(null)
  const [currentPath, setCurrentPath] = useState<string>("/")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [sortOrder, setSortOrder] = useState<SortOrder>("type-asc")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [expandedSidebarFolders, setExpandedSidebarFolders] = useState<Set<string>>(new Set())

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

  const findItemByPath = (path: string, items: FileSystemItem[] = fileSystem): FileSystemItem | null => {
    if (path === "/") return null // Root is handled separately

    for (const item of items) {
      if (item.path === path) return item
      if (item.children) {
        const found = findItemByPath(path, item.children)
        if (found) return found
      }
    }
    return null
  }

  // Helper to get all items recursively for global search
  const getAllItemsRecursive = (items: FileSystemItem[], all: FileSystemItem[] = []): FileSystemItem[] => {
    items.forEach((item) => {
      all.push(item)
      if (item.type === "folder" && item.children) {
        getAllItemsRecursive(item.children, all)
      }
    })
    return all
  }

  // Helper to get contents of the current folder
  const getCurrentFolderContents = (path: string): FileSystemItem[] => {
    if (path === "/") {
      return fileSystem // Return top-level items for root path
    }
    const currentItem = findItemByPath(path)
    return currentItem ? currentItem.children || [] : []
  }

  const getFilteredAndSortedContents = useMemo(() => {
    const sourceItems = searchTerm ? getAllItemsRecursive(fileSystem) : getCurrentFolderContents(currentPath)

    let contents = sourceItems

    // Filter by search term
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase()
      contents = contents.filter((item) => item.name.toLowerCase().includes(lowerCaseSearchTerm))
    }

    // Sort
    contents.sort((a, b) => {
      // Always sort folders first
      if (sortOrder === "type-asc") {
        if (a.type === "folder" && b.type !== "folder") return -1
        if (a.type !== "folder" && b.type === "folder") return 1
      }

      // Then sort by name
      if (sortOrder === "name-asc") {
        return a.name.localeCompare(b.name)
      }
      if (sortOrder === "name-desc") {
        return b.name.localeCompare(a.name)
      }

      // Sort by size (only for images, folders have no size)
      if (sortOrder === "size-desc") {
        if (a.type === "image" && b.type === "image") {
          return (b.size || 0) - (a.size || 0)
        }
        // Keep folders at the top if type-asc is implied, otherwise no specific order for mixed types
        if (a.type === "folder" && b.type !== "folder") return -1
        if (a.type !== "folder" && b.type === "folder") return 1
      }

      return 0 // No change
    })

    return contents
  }, [fileSystem, currentPath, searchTerm, sortOrder])

  const handleItemClick = (e: React.MouseEvent, item: FileSystemItem) => {
    try {
      // If searching, clicking an item should navigate to its parent folder
      if (searchTerm) {
        const parentPath = item.path.substring(0, item.path.lastIndexOf("/")) || "/"
        setCurrentPath(parentPath)
        setSearchTerm("") // Clear search after navigating
        setSelectedItem(item) // Select the item in its new context
        return
      }

      // Handle double-click to navigate into folders (only when not searching)
      if (e.detail === 2 && item.type === "folder") {
        setCurrentPath(item.path)
        setSelectedItem(null) // Clear selection when navigating
        setSearchTerm("") // Clear search when navigating
        return
      }

      // Single click - select this item
      setSelectedItem(item)
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
      setSelectedItem(null) // Clear selection when navigating
      setSearchTerm("") // Clear search when navigating
    } catch (error) {
      console.error("Error navigating back:", error)
      // Reset to root as a fallback
      setCurrentPath("/")
      setSelectedItem(null)
      setSearchTerm("")
      toast({
        title: "Navigation Error",
        description: "There was a problem navigating back. Returned to root directory.",
        variant: "destructive",
      })
    }
  }

  const getBreadcrumbs = () => {
    const paths = currentPath.split("/").filter(Boolean)
    let current = ""
    return [
      { name: "Root", path: "/" },
      ...paths.map((part) => {
        current += `/${part}`
        return { name: part, path: current }
      }),
    ]
  }

  const handleBreadcrumbClick = (path: string) => {
    setCurrentPath(path)
    setSelectedItem(null)
    setSearchTerm("") // Clear search when navigating via breadcrumbs
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

  const handleDownloadClick = (item: FileSystemItem) => {
    if (item.url) {
      const link = document.createElement("a")
      link.href = item.url
      link.download = item.name // Suggest original filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      toast({
        title: "Download Error",
        description: "Could not find a URL for this item to download.",
        variant: "destructive",
      })
    }
  }

  const renderFileSystem = (items: FileSystemItem[], depth = 0) => {
    return items.map((item) => (
      <div key={item.id}>
        <div
          className={cn(
            "flex items-center gap-2 p-2 cursor-pointer hover:bg-accent rounded-md",
            selectedItem?.id === item.id && "bg-accent",
          )}
          onClick={(e) => handleItemClick(e, item)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {item.type === "folder" ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0"
                onClick={(e) => {
                  e.stopPropagation() // Prevent folder navigation on toggle click
                  setExpandedSidebarFolders((prev) => {
                    const newSet = new Set(prev)
                    if (newSet.has(item.id)) {
                      newSet.delete(item.id)
                    } else {
                      newSet.add(item.id)
                    }
                    return newSet
                  })
                }}
              >
                {expandedSidebarFolders.has(item.id) ? (
                  <ChevronDown className="h-4 w-4 text-blue-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-blue-500" />
                )}
              </Button>
              <Folder className="h-4 w-4 text-blue-500" />
            </>
          ) : (
            <ImageIcon className="h-4 w-4 text-green-500" />
          )}
          <span className="text-sm truncate">{item.name}</span>
        </div>
        {item.type === "folder" && item.children && expandedSidebarFolders.has(item.id) && (
          <div className="ml-4">{renderFileSystem(item.children, depth + 1)}</div>
        )}
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
    <div className="flex h-full w-full">
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
          <div className="p-2">
            {fileSystem.length === 0 && !isLoading ? (
              <div className="text-center text-muted-foreground py-4">No files found.</div>
            ) : (
              renderFileSystem(fileSystem)
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={handleBackClick} disabled={currentPath === "/"}>
            Back
          </Button>
          <div className="flex-1 flex items-center gap-1 text-sm bg-muted px-3 py-1 rounded-md overflow-hidden">
            {getBreadcrumbs().map((crumb, index, arr) => (
              <React.Fragment key={crumb.path}>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => handleBreadcrumbClick(crumb.path)}
                  className="p-0 h-auto text-sm"
                >
                  {crumb.name}
                </Button>
                {index < arr.length - 1 && <span className="mx-1">/</span>}
              </React.Fragment>
            ))}
          </div>
          <Input
            placeholder="Search all folders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <Select value={sortOrder} onValueChange={(value: SortOrder) => setSortOrder(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="type-asc">Type (Folders First)</SelectItem>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="size-desc">Size (Largest First)</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>
            {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>
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
                {selectedItem.width && selectedItem.height && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Dimensions: {selectedItem.width}x{selectedItem.height} px
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
                  <Button className="mt-4 w-full" onClick={() => handleDownloadClick(selectedItem)}>
                    <Download className="h-4 w-4 mr-2" /> Download Image
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "gap-4",
                viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "flex flex-col",
              )}
            >
              {getFilteredAndSortedContents.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Folder className="h-12 w-12 mb-2 opacity-20" />
                  <p>
                    {searchTerm
                      ? "No items match your search."
                      : "This folder is empty. Add images to this folder in your GitHub repository."}
                  </p>
                </div>
              ) : (
                getFilteredAndSortedContents.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "border rounded-md p-4 flex items-center cursor-pointer hover:bg-accent/50 transition-colors",
                      selectedItem?.id === item.id && "bg-accent/80 border border-primary/30",
                      viewMode === "grid" ? "flex-col" : "flex-row justify-between",
                    )}
                    onClick={(e) => handleItemClick(e, item)}
                  >
                    {item.type === "folder" ? (
                      <Folder
                        className={cn("text-blue-500", viewMode === "grid" ? "h-12 w-12 mb-2" : "h-6 w-6 mr-2")}
                      />
                    ) : (
                      <div className={cn("relative", viewMode === "grid" ? "h-24 w-24 mb-2" : "h-12 w-12 mr-2")}>
                        <Image
                          src={item.url || "/placeholder.svg?height=100&width=100"}
                          alt={item.name}
                          fill
                          className="object-cover rounded-md"
                        />
                      </div>
                    )}
                    <span className="text-sm font-medium truncate">{item.name}</span>
                    {viewMode === "list" && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {item.type === "folder"
                          ? "Folder"
                          : item.size
                            ? `${(item.size / 1024 / 1024).toFixed(2)} MB`
                            : "Image"}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* GitHub Integration Guide */}
        <div className="mt-4 p-4 border rounded-md bg-muted/20">
          <h3 className="text-sm font-medium mb-2">GitHub Integration Guide</h3>
          <p className="text-sm text-muted-foreground">
            Images added to your GitHub repository's <code className="bg-muted px-1 rounded">public</code> directory
            will automatically appear here.
          </p>
          <p className="text-sm text-muted-foreground mt-2">To add new images:</p>
          <ol className="text-sm text-muted-foreground mt-1 list-decimal pl-5">
            <li>
              Add image files to your repository's <code className="bg-muted px-1 rounded">public</code> directory
            </li>
            <li>
              Create folders in the <code className="bg-muted px-1 rounded">public</code> directory to organize your
              images
            </li>
            <li>Commit and push your changes to GitHub</li>
            <li>Click the refresh button in this app to see your changes</li>
          </ol>
          <p className="text-sm text-muted-foreground mt-2">
            You can share direct links to any image by selecting it and copying the direct link.
          </p>
        </div>
      </div>
    </div>
  )
}
