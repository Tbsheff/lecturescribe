import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/auth.page';
import { NoteEditorPage } from './page-objects/note-editor.page';
import { RecordingPage } from './page-objects/recording.page';

test.describe('Note Management Flow', () => {
  let authPage: AuthPage;
  let noteEditorPage: NoteEditorPage;
  let recordingPage: RecordingPage;
  let testNoteId: string;

  test.beforeEach(async ({ page, context }) => {
    authPage = new AuthPage(page);
    noteEditorPage = new NoteEditorPage(page);
    recordingPage = new RecordingPage(page);

    // Grant permissions and sign in
    await context.grantPermissions(['microphone']);
    await authPage.goto();
    await authPage.signIn('testuser@example.com', 'TestPassword123!');
    await authPage.waitForAuthSuccess();

    // Create a test note by recording
    await recordingPage.goto();
    await recordingPage.startRecording();
    await page.waitForTimeout(1000);
    await recordingPage.stopRecording();
    await recordingPage.processRecording();
    await recordingPage.waitForProcessingComplete();

    // Extract note ID from URL
    const url = page.url();
    testNoteId = url.split('/notes/')[1];
  });

  test('should edit note content', async ({ page }) => {
    // Navigate to the note
    await noteEditorPage.goto(testNoteId);

    // Clear and add new content
    await noteEditorPage.typeContent('# Test Note\n\nThis is a test note with **bold** text.');

    // Wait for auto-save
    await noteEditorPage.waitForSave();
    await expect(noteEditorPage.saveStatus).toHaveText('Saved');

    // Verify content persists after reload
    await page.reload();
    const content = await noteEditorPage.getContent();
    expect(content).toContain('# Test Note');
    expect(content).toContain('**bold**');
  });

  test('should preview markdown content', async ({ page }) => {
    await noteEditorPage.goto(testNoteId);

    // Add markdown content
    const markdownContent = `# Heading 1
## Heading 2
This is a paragraph with **bold** and *italic* text.

- Bullet point 1
- Bullet point 2

1. Numbered item 1
2. Numbered item 2

\`\`\`javascript
const hello = "world";
\`\`\``;

    await noteEditorPage.typeContent(markdownContent);
    await noteEditorPage.waitForSave();

    // Switch to preview
    await noteEditorPage.switchToPreview();

    // Verify rendered content
    const preview = noteEditorPage.previewContent;
    await expect(preview.locator('h1')).toHaveText('Heading 1');
    await expect(preview.locator('h2')).toHaveText('Heading 2');
    await expect(preview.locator('strong')).toHaveText('bold');
    await expect(preview.locator('em')).toHaveText('italic');
    await expect(preview.locator('ul li')).toHaveCount(2);
    await expect(preview.locator('ol li')).toHaveCount(2);
    await expect(preview.locator('pre code')).toContainText('const hello = "world"');
  });

  test('should apply formatting with toolbar buttons', async ({ page }) => {
    await noteEditorPage.goto(testNoteId);

    // Type some text
    await noteEditorPage.typeContent('This is some text');

    // Select "some" and make it bold
    await noteEditorPage.selectText(8, 12);
    await noteEditorPage.formatBold();

    const content = await noteEditorPage.getContent();
    expect(content).toBe('This is **some** text');

    // Add heading
    await noteEditorPage.editor.press('Enter');
    await noteEditorPage.formatHeading1();
    await noteEditorPage.editor.type('My Heading');

    const updatedContent = await noteEditorPage.getContent();
    expect(updatedContent).toContain('# My Heading');
  });

  test('should use keyboard shortcuts for formatting', async ({ page }) => {
    await noteEditorPage.goto(testNoteId);

    // Type and format with keyboard shortcuts
    await noteEditorPage.typeContent('Bold text');
    await noteEditorPage.selectText(0, 4);
    await page.keyboard.press('Control+B');

    let content = await noteEditorPage.getContent();
    expect(content).toBe('**Bold** text');

    // Italic with Ctrl+I
    await noteEditorPage.editor.press('End');
    await noteEditorPage.editor.type(' and italic');
    await noteEditorPage.selectText(content.length + 5, content.length + 11);
    await page.keyboard.press('Control+I');

    content = await noteEditorPage.getContent();
    expect(content).toContain('*italic*');
  });

  test('should auto-save content after delay', async ({ page }) => {
    await noteEditorPage.goto(testNoteId);

    // Type content
    await noteEditorPage.typeContent('Auto-save test content');

    // Should show "Saving..." immediately or shortly after
    await page.waitForTimeout(500);
    const savingVisible = await page.getByText('Saving...').isVisible();
    expect(savingVisible).toBeTruthy();

    // Wait for auto-save to complete (1.5s delay + processing)
    await noteEditorPage.waitForSave();
    await expect(noteEditorPage.saveStatus).toHaveText('Saved');

    // Reload and verify content was saved
    await page.reload();
    const content = await noteEditorPage.getContent();
    expect(content).toBe('Auto-save test content');
  });

  test('should handle concurrent edits gracefully', async ({ page }) => {
    await noteEditorPage.goto(testNoteId);

    // Make rapid edits
    for (let i = 0; i < 5; i++) {
      await noteEditorPage.typeContent(`Edit ${i}\n`);
      await page.waitForTimeout(100);
    }

    // Wait for final save
    await noteEditorPage.waitForSave();
    
    // Verify all edits were saved
    const content = await noteEditorPage.getContent();
    expect(content).toContain('Edit 4');
  });

  test('should delete note', async ({ page }) => {
    await noteEditorPage.goto(testNoteId);

    // Delete the note
    await noteEditorPage.deleteNote();

    // Should redirect after deletion
    await page.waitForURL('/notes');
    
    // Note should not be accessible
    await page.goto(`/notes/${testNoteId}`);
    await expect(page.locator('text=/not found|404/i')).toBeVisible();
  });

  test('should insert lists and checkboxes', async ({ page }) => {
    await noteEditorPage.goto(testNoteId);

    // Insert bullet list
    await noteEditorPage.insertBulletList();
    await noteEditorPage.editor.type('First item');
    await noteEditorPage.editor.press('Enter');
    await noteEditorPage.editor.type('Second item');

    // Insert numbered list
    await noteEditorPage.editor.press('Enter');
    await noteEditorPage.editor.press('Enter');
    await noteEditorPage.insertNumberedList();
    await noteEditorPage.editor.type('Step one');
    await noteEditorPage.editor.press('Enter');
    await noteEditorPage.editor.type('Step two');

    const content = await noteEditorPage.getContent();
    expect(content).toContain('- First item');
    expect(content).toContain('- Second item');
    expect(content).toContain('1. Step one');
    expect(content).toContain('2. Step two');
  });

  test('should handle special characters and unicode', async ({ page }) => {
    await noteEditorPage.goto(testNoteId);

    const specialContent = 'Special chars: < > & " \' 🎉 你好 مرحبا';
    await noteEditorPage.typeContent(specialContent);
    await noteEditorPage.waitForSave();

    // Verify in preview
    await noteEditorPage.switchToPreview();
    const previewText = await noteEditorPage.previewContent.textContent();
    expect(previewText).toContain('🎉');
    expect(previewText).toContain('你好');
    expect(previewText).toContain('مرحبا');
  });
});