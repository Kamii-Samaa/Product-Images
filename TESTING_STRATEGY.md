# Testing Strategy Recommendations

This document outlines recommended testing strategies for the file explorer application to ensure its robustness and reliability.

## I. API Route Testing (`app/api/`)

It's crucial to test the API routes as they handle core logic like file system scanning and file uploads.

### 1. Filesystem API (`/api/filesystem`)

*   **Test Scenarios:**
    *   **Empty `public` directory:** Verify it returns an empty `fileSystem` array.
    *   **`public` directory with various items:**
        *   Include nested folders, supported image files, non-image files (should be ignored), and hidden files (should be ignored).
        *   Verify the structure of the returned `FileSystemItem[]` is correct (paths, names, types, URLs, sizes).
    *   **Directory with problematic items:**
        *   Include a file that might cause `fs.stat` to fail (e.g., due to permissions, if possible to simulate, or a broken symlink). Verify the API handles this gracefully (logs error, skips item, continues processing others) due to the recent error handling improvements.
    *   **Path normalization:** Ensure paths are correctly normalized (e.g., backslashes to forward slashes).
*   **Tools/Frameworks:** Node.js built-in `assert` or testing frameworks like Jest or Mocha, using a library like `supertest` or Node's `fetch` to make requests to the API endpoint during tests. Mocking `fs` module operations can be useful for fine-grained control over test scenarios.

### 2. Upload API (`/api/upload`)

*   **Test Scenarios:**
    *   **Successful image upload:**
        *   Verify a 200 status code and correct JSON response (url, path, name, size, type).
        *   Verify the file is actually created in the `public/{path}` directory.
        *   Test with different valid image types.
        *   Test uploading to root (`path="/"` or `path=""`) and to a subfolder.
    *   **Missing file or path:** Verify a 400 error and appropriate error message.
    *   **Invalid file type:** Upload a non-image file (e.g., `.txt`, `.pdf`). Verify a 400 error and message.
    *   **File too large:** Upload an image file exceeding the defined size limit. Verify a 400 error and message.
    *   **Directory creation:** Ensure that if a path is specified for a non-existent directory, it's created.
    *   **Filename sanitization/uniqueness:** If more advanced filename processing were added, test that. (Currently uses `Date.now()` prefix).
    *   **Path traversal attempts:** Provide a path like `../../evil-path`. Verify the sanitization handles this and files are saved within the `public` directory scope.
*   **Tools/Frameworks:** Similar to filesystem API testing. Use `FormData` to construct multipart/form-data requests. `fs.existsSync` and `fs.unlinkSync` will be needed to check for file creation and clean up after tests.

## II. Frontend Component Testing (`components/`)

### 1. FileExplorer Component (`components/file-explorer.tsx`)

*   **Test Scenarios:**
    *   **Initial render:**
        *   Verify loading state is shown initially.
        *   Mock API response for `/api/filesystem` and verify the file/folder structure renders correctly.
        *   Test with empty API response.
    *   **Folder navigation:**
        *   Simulate double-clicking a folder and verify the view updates to show its contents and the path display changes.
        *   Simulate clicking the "Back" button and verify navigation to the parent directory.
    *   **Item selection:**
        *   Single click: Verify item is selected, and previous selection is cleared.
        *   Ctrl/Cmd + click: Verify item is added/removed from selection without affecting other selected items.
        *   Shift + click: Verify range selection works as expected.
        *   Escape key: Verify selection is cleared.
        *   Ctrl/Cmd + A: Verify all items in the current view are selected.
    *   **Image preview:**
        *   Select an image file and verify the preview pane shows the image and its details.
        *   Test image `onError` handling: Mock an image URL that will fail to load and verify the error message/placeholder is shown.
    *   **Empty folder display:** Verify the "No image files found..." message appears for an empty folder.
    *   **Refresh functionality:** Simulate clicking the refresh button and verify the API is called again.
    *   **Copy image path/link:** Simulate clicking copy buttons and verify `navigator.clipboard.writeText` is called with the correct data (may require mocking `navigator.clipboard`).
*   **Tools/Frameworks:** Jest with React Testing Library for rendering components, simulating user interactions, and making assertions about the component's state and output. Mock `fetch` for API calls.

## III. End-to-End (E2E) Testing (Future Consideration)

For broader coverage, E2E tests could simulate full user workflows.

*   **Test Scenarios:**
    *   User navigates through folders, selects an image, views preview.
    *   User uploads a new image (if UI for upload is integrated into explorer), refreshes, and sees the new image.
*   **Tools/Frameworks:** Playwright or Cypress.

## General Testing Practices

*   **Test Coverage:** Aim for a reasonable level of test coverage for critical parts of the application.
*   **CI/CD Integration:** Integrate tests into the CI/CD pipeline to automatically run them on each push or pull request.
*   **Clean State:** Ensure tests are independent and clean up after themselves (e.g., delete created files during upload tests).

This outline provides a starting point for implementing a comprehensive testing suite.
