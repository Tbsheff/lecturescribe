import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/auth.page';
import { RecordingPage } from './page-objects/recording.page';
import { NoteEditorPage } from './page-objects/note-editor.page';
import { FolderTreePage } from './page-objects/folder-tree.page';
import { AuthHelper } from './helpers/auth.helper';
import { SAMPLE_MARKDOWN, TIMEOUTS } from './helpers/test-data';

test.describe('Edge Cases and Error Scenarios', () => {
  test.describe('Authentication Edge Cases', () => {
    let authPage: AuthPage;

    test.beforeEach(async ({ page }) => {
      authPage = new AuthPage(page);
      await authPage.goto();
    });

    test('should handle XSS attempts in login form', async ({ page }) => {
      const xssPayload = '<script>alert("XSS")</script>';
      
      await authPage.signIn(xssPayload, xssPayload);
      
      // Should not execute script, should show validation error
      await expect(page.locator('dialog')).not.toBeVisible();
      await expect(page).toHaveURL('/auth');
    });

    test('should handle SQL injection attempts', async ({ page }) => {
      const sqlInjection = "admin' OR '1'='1";
      
      await authPage.signIn(sqlInjection, sqlInjection);
      
      // Should treat as invalid credentials
      await expect(page).toHaveURL('/auth');
    });

    test('should handle extremely long inputs', async ({ page }) => {
      const longString = 'a'.repeat(10000);
      
      await authPage.emailInput.fill(longString + '@example.com');
      await authPage.passwordInput.fill(longString);
      await authPage.signInButton.click();
      
      // Should handle gracefully without crashing
      await expect(page).toHaveURL('/auth');
    });

    test('should prevent rapid form submissions', async ({ page }) => {
      await authPage.emailInput.fill('test@example.com');
      await authPage.passwordInput.fill('password');
      
      // Rapid clicks
      for (let i = 0; i < 5; i++) {
        await authPage.signInButton.click({ force: true });
      }
      
      // Should not crash or show multiple errors
      await page.waitForTimeout(TIMEOUTS.SHORT);
      const errorCount = await page.locator('.text-destructive').count();
      expect(errorCount).toBeLessThanOrEqual(1);
    });
  });

  test.describe('Recording Edge Cases', () => {
    let recordingPage: RecordingPage;

    test.beforeEach(async ({ page }) => {
      recordingPage = new RecordingPage(page);
      await AuthHelper.signIn(page);
      await recordingPage.goto();
    });

    test('should handle immediate stop after start', async ({ page }) => {
      await recordingPage.startRecording();
      // Immediately stop
      await recordingPage.stopRecording();
      
      // Should handle gracefully
      await expect(recordingPage.discardButton).toBeVisible();
      await expect(recordingPage.processButton).toBeVisible();
    });

    test('should handle multiple start attempts', async ({ page }) => {
      await recordingPage.startRecording();
      
      // Try to start again (button should be hidden, but force click)
      const startButton = page.getByRole('button', { name: /start recording/i });
      if (await startButton.isVisible()) {
        await startButton.click();
      }
      
      // Should remain in recording state
      await expect(recordingPage.recordingStatus).toBeVisible();
    });

    test('should handle page visibility changes during recording', async ({ page }) => {
      await recordingPage.startRecording();
      
      // Simulate tab switching (page becomes hidden)
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
          writable: true,
          value: true
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      
      await page.waitForTimeout(TIMEOUTS.SHORT);
      
      // Simulate returning to tab
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
          writable: true,
          value: false
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      
      // Recording should still be active
      await expect(recordingPage.recordingStatus).toBeVisible();
    });
  });

  test.describe('Note Editor Edge Cases', () => {
    let noteEditorPage: NoteEditorPage;
    let recordingPage: RecordingPage;

    test.beforeEach(async ({ page, context }) => {
      noteEditorPage = new NoteEditorPage(page);
      recordingPage = new RecordingPage(page);
      
      await context.grantPermissions(['microphone']);
      await AuthHelper.signIn(page);
      
      // Create a test note
      await recordingPage.goto();
      await recordingPage.startRecording();
      await page.waitForTimeout(TIMEOUTS.SHORT);
      await recordingPage.stopRecording();
      await recordingPage.processRecording();
      await recordingPage.waitForProcessingComplete();
    });

    test('should handle extremely large content', async ({ page }) => {
      const largeContent = SAMPLE_MARKDOWN.complex.repeat(100);
      
      await noteEditorPage.typeContent(largeContent);
      await noteEditorPage.waitForSave();
      
      // Should save without errors
      await expect(noteEditorPage.saveStatus).toHaveText('Saved');
      
      // Preview should render
      await noteEditorPage.switchToPreview();
      await expect(noteEditorPage.previewContent).toBeVisible();
    });

    test('should handle rapid formatting changes', async ({ page }) => {
      await noteEditorPage.typeContent('Test text for formatting');
      
      // Rapidly apply multiple formats
      await noteEditorPage.selectText(0, 4);
      await noteEditorPage.formatBold();
      await noteEditorPage.formatItalic();
      await noteEditorPage.formatBold(); // Toggle off
      
      const content = await noteEditorPage.getContent();
      expect(content).toContain('*Test*'); // Should only have italic
    });

    test('should handle offline scenario', async ({ page, context }) => {
      // Type content
      await noteEditorPage.typeContent('Offline test content');
      
      // Go offline
      await context.setOffline(true);
      
      // Make changes
      await noteEditorPage.appendContent('\nAdded while offline');
      
      // Should show as saving/unsaved
      await page.waitForTimeout(TIMEOUTS.SAVE_DELAY);
      const status = await noteEditorPage.saveStatus.textContent();
      expect(status).not.toBe('Saved');
      
      // Go back online
      await context.setOffline(false);
      
      // Should eventually save
      await page.waitForTimeout(TIMEOUTS.MEDIUM);
      await expect(noteEditorPage.saveStatus).toHaveText('Saved');
    });

    test('should handle special markdown edge cases', async ({ page }) => {
      const edgeCaseMarkdown = `
# Edge Cases

## Nested formatting
***bold and italic***
**_bold and italic_**
*__italic and bold__*

## Empty code blocks
\`\`\`
\`\`\`

## Broken links
[Broken link](
[](https://example.com)
[Link text]()

## Escaped characters
\\*not italic\\*
\\**not bold\\**
\\\`not code\\\`

## Unicode and emojis
# 你好世界 🌍
## مرحبا بالعالم 🌟
### Здравствуй мир 🚀
`;

      await noteEditorPage.typeContent(edgeCaseMarkdown);
      await noteEditorPage.waitForSave();
      
      // Switch to preview - should not crash
      await noteEditorPage.switchToPreview();
      await expect(noteEditorPage.previewContent).toBeVisible();
      
      // Check some content rendered
      await expect(noteEditorPage.previewContent).toContainText('Edge Cases');
      await expect(noteEditorPage.previewContent).toContainText('🌍');
    });
  });

  test.describe('Folder Organization Edge Cases', () => {
    let folderTreePage: FolderTreePage;

    test.beforeEach(async ({ page }) => {
      folderTreePage = new FolderTreePage(page);
      await AuthHelper.signIn(page);
      await page.goto('/notes');
    });

    test('should handle special characters in folder names', async ({ page }) => {
      const specialNames = [
        'Folder/With/Slashes',
        'Folder\\With\\Backslashes',
        'Folder<>With<>Brackets',
        'Folder"With"Quotes',
        'Folder|With|Pipes',
        '文件夹',
        'مجلد',
        '📁 Emoji Folder'
      ];

      for (const name of specialNames) {
        await folderTreePage.createFolder(name);
        await page.waitForTimeout(500);
        
        // Should create and display folder
        await expect(page.getByText(name)).toBeVisible();
      }
    });

    test('should handle deeply nested folders', async ({ page }) => {
      let parentName = 'Level 0';
      await folderTreePage.createFolder(parentName);
      
      // Create 10 levels deep
      for (let i = 1; i <= 10; i++) {
        const childName = `Level ${i}`;
        await page.waitForTimeout(300);
        await folderTreePage.createFolder(childName, parentName);
        await folderTreePage.expandFolder(parentName);
        parentName = childName;
      }
      
      // Should handle deep nesting
      await expect(page.getByText('Level 10')).toBeVisible();
    });

    test('should handle circular reference prevention', async ({ page }) => {
      // Create parent and child
      await folderTreePage.createFolder('Parent');
      await page.waitForTimeout(500);
      await folderTreePage.createFolder('Child', 'Parent');
      await folderTreePage.expandFolder('Parent');
      
      // Try to move parent into child (should be prevented)
      await folderTreePage.dragItemToFolder('Parent', 'Child');
      
      // Parent should still be at root level
      const parentAtRoot = page.locator('div').filter({ hasText: 'Parent' }).first();
      await expect(parentAtRoot).toBeVisible();
    });

    test('should handle rapid folder operations', async ({ page }) => {
      // Create multiple folders rapidly
      const folderPromises = [];
      for (let i = 0; i < 5; i++) {
        folderPromises.push(folderTreePage.createFolder(`Rapid Folder ${i}`));
      }
      
      await Promise.all(folderPromises);
      await page.waitForTimeout(TIMEOUTS.SHORT);
      
      // All folders should be created
      for (let i = 0; i < 5; i++) {
        await expect(page.getByText(`Rapid Folder ${i}`)).toBeVisible();
      }
    });

    test('should handle empty folder names gracefully', async ({ page }) => {
      await folderTreePage.createFolderButton.first().click();
      
      // Try to create with empty name
      await folderTreePage.createButton.click();
      
      // Should show error or not create folder
      await expect(page.getByText('cannot be empty')).toBeVisible();
      
      // Cancel and verify no folder created
      await folderTreePage.cancelButton.click();
      const folderCount = await folderTreePage.getFolderCount();
      expect(folderCount).toBe(0);
    });
  });

  test.describe('Performance and Stress Tests', () => {
    test('should handle multiple concurrent operations', async ({ page }) => {
      await AuthHelper.signIn(page);
      
      // Open multiple tabs/operations
      const [page1, page2] = await Promise.all([
        page.context().newPage(),
        page.context().newPage()
      ]);
      
      // Simultaneous operations
      await Promise.all([
        page.goto('/notes'),
        page1.goto('/'),
        page2.goto('/settings')
      ]);
      
      // All pages should load correctly
      await expect(page.locator('h3:has-text("Folders")')).toBeVisible();
      await expect(page1.getByRole('button', { name: /start recording/i })).toBeVisible();
    });

    test('should handle browser refresh during operations', async ({ page, context }) => {
      await context.grantPermissions(['microphone']);
      await AuthHelper.signIn(page);
      
      const recordingPage = new RecordingPage(page);
      await recordingPage.goto();
      
      // Start recording
      await recordingPage.startRecording();
      await page.waitForTimeout(TIMEOUTS.SHORT);
      
      // Refresh page
      await page.reload();
      
      // Should return to initial state (recording lost)
      await expect(recordingPage.startRecordingButton).toBeVisible();
    });
  });
});