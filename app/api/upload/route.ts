import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    // The 'path' from FormData determines the subdirectory within 'public/' where the file will be saved.
    // Examples: "Puma Ship 25-02 Images", or "/" for the root of 'public/'.
    const relativePathFromPayload = formData.get("path") as string;

    // Basic validation for the presence of file and path data.
    if (!file || typeof relativePathFromPayload === 'undefined') {
      return NextResponse.json({ error: "File and path are required" }, { status: 400 });
    }

    // --- BEGIN VALIDATIONS ---
    // File Type Validation: Only allow specific image MIME types.
    const allowedFileTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/avif"];
    if (!allowedFileTypes.includes(file.type)) {
      return NextResponse.json({ error: `Invalid file type. Allowed types: ${allowedFileTypes.join(", ")}` }, { status: 400 });
    }

    // File Size Validation: Set a maximum file size (e.g., 10MB).
    const maxFileSizeMB = 10;
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024; // 10 MB in bytes
    if (file.size > maxFileSizeBytes) {
      return NextResponse.json({ error: `File too large. Maximum size is ${maxFileSizeMB}MB.` }, { status: 400 });
    }
    // --- END VALIDATIONS ---

    // Sanitize the user-provided relative path to prevent directory traversal attacks (e.g., '../../etc/passwd').
    // path.normalize resolves '..' segments. The replace regex removes any leading '..' segments
    // to ensure the path stays within the intended scope.
    const sanitizedRelativePath = path.normalize(relativePathFromPayload).replace(/^(\.\.(\/|\|$))+/, '');

    // Construct the full target directory path where the file will be saved.
    // All uploads are placed within the `public` directory of the project.
    // If sanitizedRelativePath is empty or just '/', files will be saved in 'public' root.
    // Otherwise, they will be saved in 'public/sanitizedRelativePath'.
    const targetDirectory = path.join(process.cwd(), "public", sanitizedRelativePath);

    // Generate a unique filename to prevent overwriting existing files.
    // Using a timestamp prefix is a common simple strategy.
    // For more robustness, consider UUIDs or content hashing if collisions are a major concern.
    const filename = `${Date.now()}-${file.name}`;
    const finalFilePath = path.join(targetDirectory, filename);

    // Construct the public URL that can be used to access the file via the web.
    // This path is relative to the 'public' directory and uses forward slashes.
    const publicAccessUrl = path.join("/", sanitizedRelativePath, filename).replace(/\\/g, "/");


    // Ensure the target directory exists. If not, create it recursively.
    // For example, if targetDirectory is 'public/new-folder/sub-folder', mkdir will create them all.
    await fs.mkdir(targetDirectory, { recursive: true });

    // Convert the file data to a Buffer and write it to the filesystem.
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(finalFilePath, fileBuffer);

    // Return a success response with details about the uploaded file.
    return NextResponse.json({
      success: true,
      url: publicAccessUrl,      // URL to access the file via web (e.g., /uploads/image.png)
      path: publicAccessUrl,     // Path for display/reference, same as URL in this local setup
      name: file.name,           // Original name of the file
      size: file.size,           // Size of the file in bytes
      type: file.type,           // MIME type of the file
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    // Return a generic error response to the client.
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error during upload" }, { status: 500 });
  }
}
