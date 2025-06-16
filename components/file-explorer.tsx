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
  // State for the entire file system structure, fetched from the API.
  const [fileSystem, setFileSystem] = useState<FileSystemItem[]>([]);
  // State to indicate if the initial file system data is being loaded.
  const [isLoading, setIsLoading] = useState(true);
  // State to indicate if the file system is currently being refreshed by user action.
  const [isRefreshing, setIsRefreshing] = useState(false);

  // State for the currently selected single item, primarily used for displaying its preview.
  const [selectedItem, setSelectedItem] = useState<FileSystemItem | null>(null);
  // State for all currently selected items, supporting multi-select functionality.
  const [selectedItems, setSelectedItems] = useState<FileSystemItem[]>([]);
  // Stores the ID of the last item clicked without the Shift key, used as an anchor for range selection.
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  // Represents the current directory path being viewed by the user (e.g., "/", "/folderA", "/folderA/folderB").
  const [currentPath, setCurrentPath] = useState<string>("/");
  // State to track if there's an error loading the image in the preview pane.
  const [imageError, setImageError] = useState(false);

  // Fetches the file system structure from the API when the component initially mounts.
  useEffect(() => {
    fetchFileSystem();
  }, []); // Empty dependency array ensures this runs only once on mount.

  /**
   * Fetches the file system data from the `/api/filesystem` endpoint.
   * It updates the component's state with the fetched data or handles errors by displaying toasts.
   */
  const fetchFileSystem = async () => {
    try {
      setIsLoading(true); // Set loading state for initial fetch or if not already refreshing.
      const response = await fetch("/api/filesystem");

      if (!response.ok) {
        // Handle HTTP errors (e.g., 404 Not Found, 500 Internal Server Error).
        throw new Error(`Failed to fetch file system: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.fileSystem) {
        setFileSystem(data.fileSystem); // Update state with the new file system structure.
      } else {
        // Handle cases where the API returns a valid response but no fileSystem data.
        setFileSystem([]);
        toast({
          title: "No files found",
          description: "No image files were found in the public directory.", // User-friendly message.
        });
      }
    } catch (error) {
      // Handle network errors or errors thrown from the try block.
      console.error("Error fetching file system:", error);
      toast({
        title: "Error",
        description: "Failed to load files from the repository. Please try again later.",
        variant: "destructive", // Indicates an error toast.
      });
      setFileSystem([]); // Ensure fileSystem is in a consistent empty state on error.
    } finally {
      // Reset loading states regardless of success or failure.
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  /**
   * Initiates a manual refresh of the file system data.
   * Sets the `isRefreshing` state to provide visual feedback (e.g., spinner on refresh button).
   */
  const refreshFileSystem = () => {
    setIsRefreshing(true);
    fetchFileSystem();
  };

  /**
   * Retrieves the contents (children) of the current folder being viewed.
   * @param path The path of the folder whose contents are to be retrieved. Defaults to `currentPath` state.
   * @returns An array of FileSystemItem objects representing the folder's children,
   *          or an empty array if the folder is not found or is empty.
   */
  const getCurrentFolderContents = (path: string = currentPath): FileSystemItem[] => {
    if (path === "/") {
      // If viewing the root directory, its contents are the top-level items of the fileSystem state.
      return fileSystem;
    }
    // For subdirectories, find the folder item by its path in the fileSystem structure.
    const folder = findItemByPath(path);
    // Return its children, or an empty array if the folder doesn't exist or has no children.
    return folder?.children || [];
  };

  // `currentFolderItems` stores the items currently visible in the main content grid.
  // This could be memoized with `useMemo` if performance issues arise with large directories,
  // but direct calculation is often sufficient.
  const currentFolderItems = getCurrentFolderContents();

  // Effect to clear item selections when the current path (folder) changes.
  // This ensures that selections from a previous folder aren't carried over.
  useEffect(() => {
    setSelectedItems([]); // Clear multi-selection.
    setLastSelectedId(null); // Reset anchor for Shift+click.
    setSelectedItem(null); // Clear single selected item (and its preview).
  }, [currentPath]); // Dependency: runs when `currentPath` changes.

  // Effect to reset the `imageError` state when a new image is selected for preview.
  // This ensures that an error from a previous image doesn't persist for a new one.
  useEffect(() => {
    if (selectedItem?.type === "image") {
      setImageError(false);
    }
  }, [selectedItem]); // Dependency: runs when `selectedItem` changes.

  /**
   * Recursively searches for a FileSystemItem within the `fileSystem` structure by its path.
   * @param path The path of the item to find (e.g., "/folderA/image.png").
   * @param items The array of FileSystemItem to search within. Defaults to the entire `fileSystem` state.
   * @returns The found FileSystemItem, or `null` if not found.
   */
  const findItemByPath = (path: string, items: FileSystemItem[] = fileSystem): FileSystemItem | null => {
    // A special case for the root path, can return a virtual root item if needed for consistency.
    if (path === "/") return { id: "/", name: "Root", type: "folder", path: "/", children: fileSystem };

    for (const item of items) {
      if (item.path === path) return item;
      // If the item is a folder and has children, search recursively within its children.
      if (item.children) {
        const found = findItemByPath(path, item.children);
        if (found) return found;
      }
    }
    return null; // Item not found.
  };

  /**
   * Recursively searches for a FileSystemItem within the `fileSystem` structure by its ID.
   * @param id The ID of the item to find.
   * @param items The array of FileSystemItem to search within. Defaults to the entire `fileSystem` state.
   * @returns The found FileSystemItem, or `null` if not found.
   */
  const findItemById = (id: string, items: FileSystemItem[] = fileSystem): FileSystemItem | null => {
    for (const item of items) {
      if (item.id === id) return item;
      // If the item is a folder and has children, search recursively.
      if (item.children) {
        const found = findItemById(id, item.children);
        if (found) return found;
      }
    }
    return null; // Item not found.
  };

  /**
   * Handles item click events for selection and navigation. This is a core interaction function.
   * - Double-click on a folder: Navigates into the folder.
   * - Single click (no modifiers): Selects only the clicked item.
   * - Ctrl/Cmd+click: Toggles selection of the clicked item, preserving other selections.
   * - Shift+click: Selects a range of items from the `lastSelectedId` to the current item.
   * @param e The React mouse event.
   * @param item The `FileSystemItem` that was clicked.
   */
  const handleItemClick = (e: React.MouseEvent, item: FileSystemItem) => {
    try {
      // Double-click behavior (e.detail counts clicks)
      if (e.detail === 2 && item.type === "folder") {
        setCurrentPath(item.path); // Navigate to the folder's path.
        setSelectedItem(item);     // Set the folder as the selected item (for context, not preview).
        setSelectedItems([]);      // Clear multi-selection when navigating.
        return;
      }

      // Single click without modifier keys (Ctrl, Cmd, Shift)
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        setSelectedItem(item);      // Set as the single selected item for preview.
        setSelectedItems([item]);   // Update multi-select state to only this item.
        setLastSelectedId(item.id); // Record this item's ID as the anchor for future Shift+clicks.
        return;
      }

      // Ctrl/Cmd+click (multi-select toggle)
      if (e.ctrlKey || e.metaKey) {
        const isSelected = selectedItems.some((selected) => selected.id === item.id);
        if (isSelected) {
          // If already selected, remove it from the selection.
          setSelectedItems(selectedItems.filter((selected) => selected.id !== item.id));
        } else {
          // If not selected, add it to the selection.
          setSelectedItems([...selectedItems, item]);
        }
        setSelectedItem(item);      // Also set as the "active" or last focused item.
        setLastSelectedId(item.id); // Update anchor for Shift+click.
        return;
      }

      // Shift+click (range selection)
      if (e.shiftKey && lastSelectedId) {
        const currentItemsInView = getCurrentFolderContents(); // Get items visible in the current folder.
        const lastSelectedIndex = currentItemsInView.findIndex((i) => i.id === lastSelectedId);
        const currentIndex = currentItemsInView.findIndex((i) => i.id === item.id);

        if (lastSelectedIndex !== -1 && currentIndex !== -1) {
          // Determine the start and end indices of the range.
          const start = Math.min(lastSelectedIndex, currentIndex);
          const end = Math.max(lastSelectedIndex, currentIndex);
          const itemsInRange = currentItemsInView.slice(start, end + 1);
          setSelectedItems(itemsInRange); // Select all items within this range.
          setSelectedItem(item);        // Set the clicked item as the active one.
        }
      }
    } catch (error) {
      console.error("Error handling item click:", error);
      toast({
        title: "Selection Error",
        description: "There was a problem selecting this item. Please try again.",
        variant: "destructive",
      });
    }
  };

  /**
   * Handles the click event for the "Back" button, allowing navigation to the parent directory.
   */
  const handleBackClick = () => {
    try {
      if (currentPath === "/") return; // Already at the root directory.

      // Manipulate the current path string to find the parent path.
      const pathParts = currentPath.split("/").filter(Boolean); // Remove empty parts from slashes.
      if (pathParts.length === 0) return; // Should not happen if not at root.

      pathParts.pop(); // Remove the last segment to go up one level.
      const parentPath = pathParts.length === 0 ? "/" : `/${pathParts.join("/")}`; // Reconstruct the parent path.

      setCurrentPath(parentPath);
      const parentItem = findItemByPath(parentPath); // Find the parent folder item for context.
      setSelectedItem(parentItem); // Select the parent folder.
      setSelectedItems([]);        // Clear multi-selection.
    } catch (error) {
      console.error("Error navigating back:", error);
      // Fallback to root directory if navigation fails unexpectedly.
      setCurrentPath("/");
      setSelectedItem(null);
      setSelectedItems([]);
      toast({
        title: "Navigation Error",
        description: "There was a problem navigating back. Returned to root directory.",
        variant: "destructive",
      });
    }
  };

  /**
   * Handles keyboard events for implementing shortcuts.
   * - Ctrl+A (or Cmd+A on Mac): Selects all items in the current folder view.
   * - Escape: Clears the current selection.
   * @param e The React keyboard event.
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Select all items with Ctrl+A or Cmd+A.
    if ((e.ctrlKey || e.metaKey) && e.key === "a") {
      e.preventDefault(); // Prevent default browser select-all behavior (e.g., selecting page text).
      setSelectedItems(getCurrentFolderContents());
    }

    // Escape key to clear selection.
    if (e.key === "Escape") {
      e.preventDefault(); // Prevent default browser behavior (e.g., exiting full screen mode).
      setSelectedItems([]);
      setSelectedItem(null); // Also clear single selected item preview.
    }
  };

  /**
   * Recursively renders the file system items for the sidebar tree view.
   * Each level of depth in the tree is indented further to the right.
   * @param items The array of `FileSystemItem` to render.
   * @param depth The current depth of recursion, used for calculating indentation.
   */
  const renderFileSystem = (items: FileSystemItem[], depth = 0): JSX.Element[] => {
    return items.map((item) => (
      <div key={item.id}> {/* Unique key for each item in the list */}
        <div
          className={cn(
            "flex items-center gap-2 p-2 cursor-pointer hover:bg-accent rounded-md",
            // Apply 'bg-accent' if this item is the single selected item for preview.
            selectedItem?.id === item.id && "bg-accent",
            // Apply different styling if this item is part of a multi-selection.
            selectedItems.some((selected) => selected.id === item.id) && "bg-accent/80 border border-primary/30",
          )}
          onClick={(e) => handleItemClick(e, item)}
          // Indentation increases with depth in the tree structure.
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          title={item.name} // Show full name on hover, useful for truncated names.
        >
          {item.type === "folder" ? (
            <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
          ) : (
            <ImageIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
          )}
          <span className="text-sm truncate">{item.name}</span>
        </div>
        {/* If the item is a folder and has children, recursively render them at an increased depth. */}
        {item.type === "folder" && item.children && renderFileSystem(item.children, depth + 1)}
      </div>
    ));
  };

  /**
   * Copies the full image path (including origin) to the clipboard.
   * Uses the browser's Clipboard API. Provides feedback via toasts.
   * @param path The relative path of the image (e.g., "/folder/image.png").
   */
  const copyImagePath = (path: string) => {
    // Check if Clipboard API is available (requires HTTPS or localhost).
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(window.location.origin + path)
        .then(() => {
          toast({
            title: "Copied!",
            description: "Image path copied to clipboard.",
          });
        })
        .catch((err) => {
          console.error("Failed to copy path:", err);
          toast({
            title: "Copy Error",
            description: "Failed to copy path to clipboard. Check browser permissions.",
            variant: "destructive",
          });
        });
    } else {
      // Fallback for environments where clipboard API is not available or fails.
      toast({
        title: "Copy Not Supported",
        description: "Clipboard API is not available in this environment (e.g., HTTP).",
        variant: "destructive",
      });
    }
  };

  // Display a loading indicator while the initial file system data is being fetched.
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
              {imageError ? (
                <div className="h-80 w-full flex flex-col items-center justify-center bg-muted text-destructive-foreground">
                  <ImageIcon className="h-16 w-16 mb-4 opacity-50" />
                  <p>Error loading image.</p>
                  <p className="text-sm text-muted-foreground">{selectedItem.name}</p>
                </div>
              ) : (
                <div className="relative h-80 w-full">
                  <Image
                    src={selectedItem.url || "/placeholder.svg?height=300&width=400"}
                    alt={selectedItem.name}
                    fill
                    className="object-contain"
                    onError={() => setImageError(true)}
                  />
                </div>
              )}
              <div className="mt-4 text-center"> {/* Container for image details below the preview */}
                <h3 className="font-medium" title={selectedItem.name}>{selectedItem.name}</h3>
                <p className="text-sm text-muted-foreground mt-1" title={selectedItem.path}>Path: {selectedItem.path}</p>
                {typeof selectedItem.size === 'number' && ( // Check if size is a valid number before displaying.
                  <p className="text-sm text-muted-foreground mt-1">
                    Size: {(selectedItem.size / (1024 * 1024)).toFixed(2)} MB {/* Convert bytes to MB. */}
                  </p>
                )}
                {/* Section for copying image references (HTML embed code and direct link) */}
                <div className="mt-4 p-3 bg-muted rounded-md w-full max-w-md"> {/* Added max-width for better layout */}
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-mono">Reference HTML:</p>
                    <Button variant="ghost" size="sm" onClick={() => {
                      if (selectedItem?.path && navigator.clipboard) { // Ensure selectedItem, path, and clipboard are available.
                           navigator.clipboard.writeText(`<img src="${selectedItem.path}" alt="${selectedItem.name}" />`);
                           toast({ title: "Copied!", description: "HTML embed code copied to clipboard."});
                      } else if (!navigator.clipboard) {
                        toast({ title: "Copy Not Supported", description: "Clipboard API not available.", variant: "destructive"});
                      }
                    }} className="h-7"> {/* Slightly larger button */}
                      Copy
                    </Button>
                  </div>
                  <code className="text-xs bg-background p-1.5 rounded mt-1 block overflow-hidden text-ellipsis" title={`<img src="${selectedItem.path}" alt="${selectedItem.name}" />`}>
                    {`<img src="${selectedItem.path}" alt="${selectedItem.name}" />`}
                  </code>
                  <div className="mt-3 flex justify-between items-center mb-1"> {/* Consistent spacing */}
                    <p className="text-sm font-mono">Direct link:</p>
                    {/* Button to open the direct link in a new tab */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7" // Slightly larger button
                      onClick={() => {
                        if (typeof window !== "undefined" && selectedItem?.path) { // Ensure window and path exist.
                           window.open(window.location.origin + selectedItem.path, "_blank");
                        }
                      }}
                      title="Open image in new tab"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> {/* Slightly larger icon */}
                      Open
                    </Button>
                  </div>
                  {/* Display the full direct link, can be copied using the copyImagePath function */}
                  <code
                    className="text-xs bg-background p-1.5 rounded mt-1 block overflow-hidden text-ellipsis cursor-pointer"
                    title="Click to copy direct link"
                    onClick={() => selectedItem?.path && copyImagePath(selectedItem.path)} // Use copyImagePath for direct link
                  >
                    {typeof window !== "undefined" ? window.location.origin + selectedItem.path : selectedItem.path}
                  </code>
                </div>
              </div>
            </div>
          ) : (
            // Grid view for the current folder's contents when no specific image is selected for preview.
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {currentFolderItems.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Folder className="h-12 w-12 mb-2 opacity-20" />
                  <p>No image files found in this folder.</p>
                  <p className="text-sm">
                    You can add supported image files to this location in your repository, or upload them if an upload
                    feature is configured for this path.
                  </p>
                </div>
              ) : (
                getCurrentFolderContents().map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "border rounded-md p-3 flex flex-col items-center cursor-pointer hover:bg-accent/50 transition-colors aspect-[4/5]",
                      // Enhanced styling for selected items in the grid.
                      selectedItems.some((selected) => selected.id === item.id) &&
                        "bg-accent/80 border-2 border-primary/40 shadow-md",
                    )}
                    onClick={(e) => handleItemClick(e, item)}
                    title={item.name} // Show full name on hover.
                  >
                    {item.type === "folder" ? (
                      // Display for folder items.
                      <div className="flex flex-col items-center justify-center h-full w-full">
                        <Folder className="h-16 w-16 text-blue-500 mb-2" /> {/* Larger folder icon. */}
                      </div>
                    ) : (
                      // Display for image files.
                      <div className="relative h-3/5 w-full mb-2"> {/* Image container takes more space. */}
                        <Image
                          src={item.url || "/placeholder.svg?height=100&width=100"} // Fallback placeholder.
                          alt={item.name}
                          fill
                          className="object-cover rounded-md" // `object-cover` for better filling of the container.
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" // `sizes` attribute for responsive images.
                          onError={(e) => {
                            // Handle image load errors directly on grid items if needed, e.g., show placeholder.
                            // For now, relies on browser's default broken image icon.
                            (e.target as HTMLImageElement).src = "/placeholder.svg?height=100&width=100&text=Error";
                          }}
                        />
                      </div>
                    )}
                    {/* Text section for item name and optional size. */}
                    <div className="text-center w-full mt-auto pt-1"> {/* Pushes text to bottom, centers it. */}
                      <span className="text-sm font-medium truncate block w-full">{item.name}</span>
                      {/* Path is hidden in grid view for cleaner look, can be re-added if necessary. */}
                      {/* <span className="text-xs text-muted-foreground mt-1 truncate block w-full">{item.path}</span> */}
                      {typeof item.size === 'number' && item.type === "image" && ( // Display size for images if available.
                        <span className="text-xs text-muted-foreground mt-0.5">
                          {(item.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Static Information / Guide Section at the bottom of the explorer. */}
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
