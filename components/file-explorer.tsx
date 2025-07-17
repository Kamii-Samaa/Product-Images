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
  FolderPlus,
  Upload,
  Trash2,
  Move,
  Pencil,
  Users,
  Plus,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import type { FileSystemItem, UserRole } from "@/types/file-system"
import Image from "next/image"
import { useSession, signOut } from "next-auth/react"
import { getFileSystem, createFolder, uploadFile, renameItem, moveItem, deleteItem } from "@/actions/file-actions"
import { addUser, getUsers, updateUserRole, deleteUser } from "@/actions/user-actions"

type SortOrder = "name-asc" | "name-desc" | "type-asc" | "size-desc"

interface UserData {
  id: string
  email: string
  roles: string[]
}

export function FileExplorer() {
  const { data: session, status } = useSession()
  const isAdmin = session?.user?.roles?.includes("admin")
  const isUploader = session?.user?.roles?.includes("uploader") || isAdmin

  const [fileSystem, setFileSystem] = useState<FileSystemItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [selectedItem, setSelectedItem] = useState<FileSystemItem | null>(null)
  const [currentPath, setCurrentPath] = useState<string>("/")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [sortOrder, setSortOrder] = useState<SortOrder>("type-asc")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [expandedSidebarFolders, setExpandedSidebarFolders] = useState<Set<string>>(new Set())

  // Dialog states
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [newFolderPath, setNewFolderPath] = useState<string>("/")

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [totalFilesToUpload, setTotalFilesToUpload] = useState(0)
  const [filesUploaded, setFilesUploaded] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [newRenameName, setNewRenameName] = useState("")

  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false)
  const [moveToPath, setMoveToPath] = useState<string>("/")

  const [isUserManagementDialogOpen, setIsUserManagementDialogOpen] = useState(false)
  const [users, setUsers] = useState<UserData[]>([])
  const [newUserName, setNewUserName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserRole, setNewUserRole] = useState<UserRole>("uploader")
  const [isAddingUser, setIsAddingUser] = useState(false)
  const [isFetchingUsers, setIsFetchingUsers] = useState(false)

  // Fetch file system from API on component mount
  useEffect(() => {
    if (status === "authenticated") {
      fetchFileSystemData()
    } else if (status === "unauthenticated") {
      // Redirect to login if not authenticated
      window.location.href = "/login"
    }
  }, [status])

  const fetchFileSystemData = async () => {
    try {
      setIsLoading(true)
      const result = await getFileSystem()
      if (result.success && result.fileSystem) {
        setFileSystem(result.fileSystem)
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to load file system.",
          variant: "destructive",
        })
        setFileSystem([])
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const refreshFileSystem = () => {
    setIsRefreshing(true)
    fetchFileSystemData()
  }

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

  const getAllItemsRecursive = (items: FileSystemItem[], all: FileSystemItem[] = []): FileSystemItem[] => {
    items.forEach((item) => {
      all.push(item)
      if (item.type === "folder" && item.children) {
        getAllItemsRecursive(item.children, all)
      }
    })
    return all
  }

  const getCurrentFolderContents = (path: string): FileSystemItem[] => {
    if (path === "/") {
      return fileSystem
    }
    const currentItem = findItemByPath(path)
    return currentItem ? currentItem.children || [] : []
  }

  const getFilteredAndSortedContents = useMemo(() => {
    const sourceItems = searchTerm ? getAllItemsRecursive(fileSystem) : getCurrentFolderContents(currentPath)

    let contents = sourceItems

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase()
      contents = contents.filter((item) => item.name.toLowerCase().includes(lowerCaseSearchTerm))
    }

    contents.sort((a, b) => {
      if (sortOrder === "type-asc") {
        if (a.type === "folder" && b.type !== "folder") return -1
        if (a.type !== "folder" && b.type === "folder") return 1
      }

      if (sortOrder === "name-asc") {
        return a.name.localeCompare(b.name)
      }
      if (sortOrder === "name-desc") {
        return b.name.localeCompare(a.name)
      }

      if (sortOrder === "size-desc") {
        if (a.type === "image" && b.type === "image") {
          return (b.size || 0) - (a.size || 0)
        }
        if (a.type === "folder" && b.type !== "folder") return -1
        if (a.type !== "folder" && b.type === "folder") return 1
      }

      return 0
    })

    return contents
  }, [fileSystem, currentPath, searchTerm, sortOrder])

  const handleItemClick = (e: React.MouseEvent, item: FileSystemItem) => {
    try {
      if (searchTerm) {
        const parentPath = item.path.substring(0, item.path.lastIndexOf("/")) || "/"
        setCurrentPath(parentPath)
        setSearchTerm("")
        setSelectedItem(item)
        return
      }

      if (e.detail === 2 && item.type === "folder") {
        setCurrentPath(item.path)
        setSelectedItem(null)
        setSearchTerm("")
        return
      }

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
      setSelectedItem(null)
      setSearchTerm("")
    } catch (error) {
      console.error("Error navigating back:", error)
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
    setSearchTerm("")
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
      link.download = item.name
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

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast({ title: "Error", description: "Folder name cannot be empty", variant: "destructive" })
      return
    }
    const result = await createFolder(newFolderName, newFolderPath)
    if (result.success) {
      toast({ title: "Success", description: `Folder "${newFolderName}" created.` })
      setIsNewFolderDialogOpen(false)
      setNewFolderName("")
      refreshFileSystem()
    } else {
      toast({ title: "Error", description: result.error || "Failed to create folder.", variant: "destructive" })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const fileArray = Array.from(files)
      setSelectedFiles(fileArray)
      if (fileArray.length === 1 && fileArray[0].type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onloadend = () => setImagePreview(reader.result as string)
        reader.readAsDataURL(fileArray[0])
      } else {
        setImagePreview(null)
      }
    }
  }

  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0) {
      toast({ title: "Error", description: "Please select files to upload.", variant: "destructive" })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setTotalFilesToUpload(selectedFiles.length)
    setFilesUploaded(0)

    let successfulUploads = 0
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      const formData = new FormData()
      formData.append("file", file)
      formData.append("path", currentPath) // Upload to current path

      const result = await uploadFile(formData)
      if (result.success) {
        successfulUploads++
      } else {
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}: ${result.error}`,
          variant: "destructive",
        })
      }
      setFilesUploaded(i + 1)
      setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100))
    }

    setIsUploading(false)
    setIsUploadDialogOpen(false)
    setSelectedFiles([])
    setImagePreview(null)
    if (successfulUploads > 0) {
      toast({ title: "Success", description: `Uploaded ${successfulUploads} file(s).` })
      refreshFileSystem()
    } else {
      toast({ title: "No Files Uploaded", description: "No files were successfully uploaded.", variant: "info" })
    }
  }

  const handleRename = async () => {
    if (!selectedItem || !newRenameName.trim()) {
      toast({ title: "Error", description: "Invalid selection or name.", variant: "destructive" })
      return
    }
    const result = await renameItem(selectedItem.id, newRenameName)
    if (result.success) {
      toast({ title: "Success", description: `Renamed "${selectedItem.name}" to "${newRenameName}".` })
      setIsRenameDialogOpen(false)
      setSelectedItem(null)
      refreshFileSystem()
    } else {
      toast({ title: "Error", description: result.error || "Failed to rename item.", variant: "destructive" })
    }
  }

  const handleMove = async () => {
    if (!selectedItem || !moveToPath) {
      toast({ title: "Error", description: "Invalid selection or destination.", variant: "destructive" })
      return
    }
    const result = await moveItem(selectedItem.id, moveToPath)
    if (result.success) {
      toast({ title: "Success", description: `Moved "${selectedItem.name}" to "${moveToPath}".` })
      setIsMoveDialogOpen(false)
      setSelectedItem(null)
      refreshFileSystem()
    } else {
      toast({ title: "Error", description: result.error || "Failed to move item.", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!selectedItem) return
    const result = await deleteItem(selectedItem.id)
    if (result.success) {
      toast({ title: "Success", description: `Deleted "${selectedItem.name}".` })
      setSelectedItem(null)
      refreshFileSystem()
    } else {
      toast({ title: "Error", description: result.error || "Failed to delete item.", variant: "destructive" })
    }
  }

  const fetchUsers = async () => {
    setIsFetchingUsers(true)
    const result = await getUsers()
    if (result.success && result.users) {
      setUsers(result.users)
    } else {
      toast({ title: "Error", description: result.error || "Failed to fetch users.", variant: "destructive" })
    }
    setIsFetchingUsers(false)
  }

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) {
      toast({ title: "Error", description: "Email cannot be empty.", variant: "destructive" })
      return
    }
    setIsAddingUser(true)
    const result = await addUser(newUserEmail, newUserRole)
    if (result.success) {
      toast({ title: "Success", description: `User ${newUserEmail} added as ${newUserRole}.` })
      setNewUserEmail("")
      setNewUserRole("uploader")
      fetchUsers() // Refresh user list
    } else {
      toast({ title: "Error", description: result.error || "Failed to add user.", variant: "destructive" })
    }
    setIsAddingUser(false)
  }

  const handleUpdateUserRole = async (userId: string, role: UserRole) => {
    const result = await updateUserRole(userId, role)
    if (result.success) {
      toast({ title: "Success", description: "User role updated." })
      fetchUsers()
    } else {
      toast({ title: "Error", description: result.error || "Failed to update role.", variant: "destructive" })
    }
  }

  const handleDeleteUser = async (userId: string) => {
    const result = await deleteUser(userId)
    if (result.success) {
      toast({ title: "Success", description: "User deleted." })
      fetchUsers()
    } else {
      toast({ title: "Error", description: result.error || "Failed to delete user.", variant: "destructive" })
    }
  }

  const renderFileSystemTree = (items: FileSystemItem[], depth = 0) => {
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
                  e.stopPropagation()
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
          <div className="ml-4">{renderFileSystemTree(item.children, depth + 1)}</div>
        )}
      </div>
    ))
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading brand library...</span>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return null // Should be redirected by useEffect
  }

  return (
    <div className="flex h-full w-full">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/40 flex flex-col">
        <div className="p-4 font-semibold flex justify-between items-center">
          <span>Brand Library</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={refreshFileSystem}
            disabled={isRefreshing}
            title="Refresh assets"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
        <Separator />
        <div className="flex flex-col gap-2 p-2">
          {isUploader && (
            <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-transparent"
                  onClick={() => setNewFolderPath(currentPath)}
                >
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
                    <Label htmlFor="path" className="text-sm font-medium">
                      Parent Path
                    </Label>
                    <Select value={newFolderPath} onValueChange={setNewFolderPath}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select parent folder" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="/">/ (Root)</SelectItem>
                        {getAllItemsRecursive(fileSystem)
                          .filter((item) => item.type === "folder")
                          .map((folder) => (
                            <SelectItem key={folder.id} value={folder.path}>
                              {folder.path}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Folder Name
                    </Label>
                    <Input
                      id="name"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Enter folder name"
                    />
                  </div>
                  <Button onClick={handleCreateFolder}>Create Folder</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {isUploader && (
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full bg-transparent">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Files
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Files</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="upload-path" className="text-sm font-medium">
                      Upload Path
                    </Label>
                    <Select value={currentPath} onValueChange={setCurrentPath}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select upload folder" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="/">/ (Root)</SelectItem>
                        {getAllItemsRecursive(fileSystem)
                          .filter((item) => item.type === "folder")
                          .map((folder) => (
                            <SelectItem key={folder.id} value={folder.path}>
                              {folder.path}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="files" className="text-sm font-medium">
                      Select Files
                    </Label>
                    <Input
                      id="files"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                    />
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
                      <div className="h-2 w-full rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <Button onClick={handleUploadFiles} disabled={selectedFiles.length === 0 || isUploading}>
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Upload"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {isAdmin && (
            <Dialog open={isUserManagementDialogOpen} onOpenChange={setIsUserManagementDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full bg-transparent" onClick={fetchUsers}>
                  <Users className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>User Management</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <h4 className="font-semibold">Add New User</h4>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="newUserEmail">Email</Label>
                    <Input
                      id="newUserEmail"
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="col-span-2"
                      disabled={isAddingUser}
                    />
                    <Label htmlFor="newUserRole">Role</Label>
                    <Select
                      value={newUserRole}
                      onValueChange={(value: UserRole) => setNewUserRole(value)}
                      disabled={isAddingUser}
                    >
                      <SelectTrigger className="col-span-2">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="uploader">Uploader</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddUser} className="col-span-3" disabled={isAddingUser}>
                      {isAddingUser ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" /> Add User
                        </>
                      )}
                    </Button>
                  </div>

                  <Separator className="my-4" />

                  <h4 className="font-semibold">Existing Users</h4>
                  {isFetchingUsers ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading users...
                    </div>
                  ) : users.length === 0 ? (
                    <p className="text-center text-muted-foreground">No users found.</p>
                  ) : (
                    <ScrollArea className="h-64">
                      <div className="grid gap-2">
                        {users.map((user) => (
                          <div key={user.id} className="flex items-center justify-between border rounded-md p-2">
                            <div className="flex flex-col">
                              <span className="font-medium">{user.email}</span>
                              <span className="text-sm text-muted-foreground">
                                Roles: {user.roles.join(", ") || "None"}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <Select
                                value={user.roles[0] || "viewer"} // Assuming single primary role for simplicity
                                onValueChange={(value: UserRole) => handleUpdateUserRole(user.id, value)}
                              >
                                <SelectTrigger className="w-[120px]">
                                  <SelectValue placeholder="Change role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="uploader">Uploader</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(user.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          <div className="p-2">
            {fileSystem.length === 0 && !isLoading ? (
              <div className="text-center text-muted-foreground py-4">No files found.</div>
            ) : (
              renderFileSystemTree(fileSystem)
            )}
          </div>
        </ScrollArea>
        <div className="p-2">
          <Button variant="outline" className="w-full bg-transparent" onClick={() => signOut()}>
            <User className="h-4 w-4 mr-2" /> Log Out
          </Button>
        </div>
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
            placeholder="Search all assets..."
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

        {/* Selected Item Actions */}
        {selectedItem && (
          <div className="flex items-center gap-2 mb-4 p-2 bg-muted rounded-md">
            <span className="text-sm font-medium">Selected: {selectedItem.name}</span>
            <div className="ml-auto flex gap-2">
              {isAdmin && (
                <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setNewRenameName(selectedItem.name)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Rename
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Rename {selectedItem.name}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="rename-name">New Name</Label>
                        <Input
                          id="rename-name"
                          value={newRenameName}
                          onChange={(e) => setNewRenameName(e.target.value)}
                          placeholder="Enter new name"
                        />
                      </div>
                      <Button onClick={handleRename}>Rename</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {isAdmin && (
                <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setMoveToPath(selectedItem.path.substring(0, selectedItem.path.lastIndexOf("/")) || "/")
                      }
                    >
                      <Move className="h-4 w-4 mr-2" />
                      Move
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Move {selectedItem.name}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="move-path">Destination Path</Label>
                        <Select value={moveToPath} onValueChange={setMoveToPath}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select destination folder" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="/">/ (Root)</SelectItem>
                            {getAllItemsRecursive(fileSystem)
                              .filter(
                                (item) =>
                                  item.type === "folder" &&
                                  item.id !== selectedItem.id &&
                                  !item.path.startsWith(selectedItem.path + "/"),
                              )
                              .map((folder) => (
                                <SelectItem key={folder.id} value={folder.path}>
                                  {folder.path}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleMove}>Move</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {isAdmin && (
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
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
                      : "This folder is empty. Use the 'New Folder' or 'Upload Files' buttons to add content."}
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
      </div>
    </div>
  )
}
