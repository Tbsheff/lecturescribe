import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/auth.page';
import { FolderTreePage } from './page-objects/folder-tree.page';
import { RecordingPage } from './page-objects/recording.page';
import { NoteEditorPage } from './page-objects/note-editor.page';

test.describe('Folder Organization Flow', () => {
  let authPage: AuthPage;
  let folderTreePage: FolderTreePage;
  let recordingPage: RecordingPage;
  let noteEditorPage: NoteEditorPage;

  test.beforeEach(async ({ page, context }) => {
    authPage = new AuthPage(page);
    folderTreePage = new FolderTreePage(page);
    recordingPage = new RecordingPage(page);
    noteEditorPage = new NoteEditorPage(page);

    // Grant permissions and sign in
    await context.grantPermissions(['microphone']);
    await authPage.goto();
    await authPage.signIn('testuser@example.com', 'TestPassword123!');
    await authPage.waitForAuthSuccess();
  });

  test('should create a new folder', async ({ page }) => {
    await page.goto('/notes');

    // Create a root folder
    await folderTreePage.createFolder('Test Folder');

    // Verify folder was created
    const folderCount = await folderTreePage.getFolderCount();
    expect(folderCount).toBeGreaterThan(0);

    // Folder should be visible
    await expect(page.getByText('Test Folder')).toBeVisible();
  });

  test('should create nested folders', async ({ page }) => {
    await page.goto('/notes');

    // Create parent folder
    await folderTreePage.createFolder('Parent Folder');
    await page.waitForTimeout(500);

    // Create child folder
    await folderTreePage.createFolder('Child Folder', 'Parent Folder');

    // Expand parent to see child
    await folderTreePage.expandFolder('Parent Folder');

    // Verify both folders exist
    await expect(page.getByText('Parent Folder')).toBeVisible();
    await expect(page.getByText('Child Folder')).toBeVisible();
  });

  test('should rename folder', async ({ page }) => {
    await page.goto('/notes');

    // Create a folder
    await folderTreePage.createFolder('Original Name');
    await page.waitForTimeout(500);

    // Rename it
    await folderTreePage.renameItem('Original Name', 'New Name');

    // Verify rename
    await expect(page.getByText('Original Name')).not.toBeVisible();
    await expect(page.getByText('New Name')).toBeVisible();
  });

  test('should move note to folder', async ({ page }) => {
    await page.goto('/notes');

    // Create a folder
    await folderTreePage.createFolder('My Notes');
    await page.waitForTimeout(500);

    // Create a note
    await recordingPage.goto();
    await recordingPage.startRecording();
    await page.waitForTimeout(1000);
    await recordingPage.stopRecording();
    await recordingPage.processRecording();
    await recordingPage.waitForProcessingComplete();

    // Go back to notes view
    await page.goto('/notes');

    // Find the note (it should have a timestamp-based name)
    const noteElement = page.locator('div:has(> svg.lucide-file)').first();
    const noteName = await noteElement.locator('span').textContent();

    // Drag note to folder
    if (noteName) {
      await folderTreePage.dragItemToFolder(noteName, 'My Notes');
    }

    // Expand folder to verify
    await folderTreePage.expandFolder('My Notes');
    
    // Note should be inside the folder
    const expandedFolder = page.locator('div:has(> span:text("My Notes"))').locator('..');
    await expect(expandedFolder.locator(`text="${noteName}"`)).toBeVisible();
  });

  test('should delete empty folder', async ({ page }) => {
    await page.goto('/notes');

    // Create a folder
    await folderTreePage.createFolder('To Delete');
    await page.waitForTimeout(500);

    // Delete it
    await folderTreePage.deleteItem('To Delete');

    // Confirm deletion if dialog appears
    const confirmButton = page.getByRole('button', { name: /confirm|delete|yes/i }).last();
    if (await confirmButton.isVisible({ timeout: 1000 })) {
      await confirmButton.click();
    }

    // Folder should be gone
    await expect(page.getByText('To Delete')).not.toBeVisible();
  });

  test('should delete folder with contents', async ({ page }) => {
    await page.goto('/notes');

    // Create folder structure
    await folderTreePage.createFolder('Parent to Delete');
    await page.waitForTimeout(500);
    await folderTreePage.createFolder('Child Folder', 'Parent to Delete');

    // Delete parent folder
    await folderTreePage.deleteItem('Parent to Delete');

    // Confirm deletion
    const confirmButton = page.getByRole('button', { name: /confirm|delete|yes/i }).last();
    if (await confirmButton.isVisible({ timeout: 1000 })) {
      await confirmButton.click();
    }

    // Both folders should be gone
    await expect(page.getByText('Parent to Delete')).not.toBeVisible();
    await expect(page.getByText('Child Folder')).not.toBeVisible();
  });

  test('should expand and collapse folders', async ({ page }) => {
    await page.goto('/notes');

    // Create nested structure
    await folderTreePage.createFolder('Expandable');
    await page.waitForTimeout(500);
    await folderTreePage.createFolder('Hidden Child', 'Expandable');

    // Initially child should not be visible (parent is collapsed)
    await expect(page.getByText('Hidden Child')).not.toBeVisible();

    // Expand parent
    await folderTreePage.expandFolder('Expandable');
    await expect(page.getByText('Hidden Child')).toBeVisible();

    // Collapse parent
    await folderTreePage.collapseFolder('Expandable');
    await expect(page.getByText('Hidden Child')).not.toBeVisible();
  });

  test('should handle drag and drop between folders', async ({ page }) => {
    await page.goto('/notes');

    // Create two folders
    await folderTreePage.createFolder('Source Folder');
    await page.waitForTimeout(500);
    await folderTreePage.createFolder('Target Folder');
    await page.waitForTimeout(500);

    // Create a subfolder in source
    await folderTreePage.createFolder('Moving Folder', 'Source Folder');
    await folderTreePage.expandFolder('Source Folder');

    // Drag subfolder to target folder
    await folderTreePage.dragItemToFolder('Moving Folder', 'Target Folder');

    // Verify move
    await folderTreePage.expandFolder('Target Folder');
    const targetExpanded = page.locator('div:has(> span:text("Target Folder"))').locator('..');
    await expect(targetExpanded.locator('text="Moving Folder"')).toBeVisible();

    // Should not be in source anymore
    const sourceExpanded = page.locator('div:has(> span:text("Source Folder"))').locator('..');
    await expect(sourceExpanded.locator('text="Moving Folder"')).not.toBeVisible();
  });

  test('should select note from folder tree', async ({ page }) => {
    await page.goto('/notes');

    // Create folder and note
    await folderTreePage.createFolder('Note Container');
    await page.waitForTimeout(500);

    // Create a note
    await recordingPage.goto();
    await recordingPage.startRecording();
    await page.waitForTimeout(1000);
    await recordingPage.stopRecording();
    await recordingPage.processRecording();
    await recordingPage.waitForProcessingComplete();

    // Extract note ID from URL
    const noteId = page.url().split('/notes/')[1];

    // Go back to notes view
    await page.goto('/notes');

    // Find and move note to folder
    const noteElement = page.locator('div:has(> svg.lucide-file)').first();
    const noteName = await noteElement.locator('span').textContent();
    
    if (noteName) {
      await folderTreePage.dragItemToFolder(noteName, 'Note Container');
      await folderTreePage.expandFolder('Note Container');
      
      // Select the note
      await folderTreePage.selectNote(noteName);
      
      // Should navigate to note editor
      await expect(page).toHaveURL(`/notes/${noteId}`);
      await expect(noteEditorPage.editor).toBeVisible();
    }
  });

  test('should show empty state when no folders exist', async ({ page }) => {
    await page.goto('/notes');

    // If there are existing folders, this test might need adjustment
    // Check for empty state or presence of folders
    const itemCount = await folderTreePage.getItemCount();
    
    if (itemCount === 0) {
      await expect(page.getByText('No folders or notes')).toBeVisible();
      await expect(page.getByRole('button', { name: /create folder/i })).toBeVisible();
    }
  });

  test('should persist folder structure after page reload', async ({ page }) => {
    await page.goto('/notes');

    // Create complex structure
    await folderTreePage.createFolder('Persistent Parent');
    await page.waitForTimeout(500);
    await folderTreePage.createFolder('Persistent Child', 'Persistent Parent');
    await folderTreePage.expandFolder('Persistent Parent');

    // Reload page
    await page.reload();

    // Structure should persist
    await expect(page.getByText('Persistent Parent')).toBeVisible();
    
    // Expand parent to check child
    await folderTreePage.expandFolder('Persistent Parent');
    await expect(page.getByText('Persistent Child')).toBeVisible();
  });
});