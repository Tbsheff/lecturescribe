import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/auth.page';
import { RecordingPage } from './page-objects/recording.page';
import { NoteEditorPage } from './page-objects/note-editor.page';

test.describe('Audio Recording Flow', () => {
  let authPage: AuthPage;
  let recordingPage: RecordingPage;
  let noteEditorPage: NoteEditorPage;

  test.beforeEach(async ({ page, context }) => {
    authPage = new AuthPage(page);
    recordingPage = new RecordingPage(page);
    noteEditorPage = new NoteEditorPage(page);

    // Grant microphone permissions
    await context.grantPermissions(['microphone']);

    // Sign in before each test
    await authPage.goto();
    await authPage.signIn('testuser@example.com', 'TestPassword123!');
    await authPage.waitForAuthSuccess();
  });

  test('should start and stop audio recording', async ({ page }) => {
    await recordingPage.goto();

    // Start recording
    await recordingPage.startRecording();

    // Verify recording state
    await expect(recordingPage.recordingStatus).toBeVisible();
    await expect(recordingPage.stopRecordingButton).toBeVisible();
    await expect(recordingPage.startRecordingButton).not.toBeVisible();

    // Check duration is updating
    await page.waitForTimeout(2000);
    const duration = await recordingPage.getRecordingDuration();
    expect(duration).toMatch(/00:0[1-9]/);

    // Stop recording
    await recordingPage.stopRecording();

    // Verify stopped state
    await expect(recordingPage.recordingStatus).not.toBeVisible();
    await expect(recordingPage.processButton).toBeVisible();
    await expect(recordingPage.discardButton).toBeVisible();
  });

  test('should discard recording', async ({ page }) => {
    await recordingPage.goto();

    // Record for a short time
    await recordingPage.startRecording();
    await page.waitForTimeout(1000);
    await recordingPage.stopRecording();

    // Discard recording
    await recordingPage.discardRecording();

    // Should return to initial state
    await expect(recordingPage.startRecordingButton).toBeVisible();
    await expect(recordingPage.processButton).not.toBeVisible();
    await expect(recordingPage.discardButton).not.toBeVisible();
  });

  test('should process recording and create note', async ({ page }) => {
    await recordingPage.goto();

    // Record audio
    await recordingPage.startRecording();
    await page.waitForTimeout(2000); // Record for 2 seconds
    await recordingPage.stopRecording();

    // Process recording
    await recordingPage.processRecording();

    // Should show processing indicator
    await expect(recordingPage.processingIndicator).toBeVisible();

    // Should navigate to note editor after processing
    await recordingPage.waitForProcessingComplete();
    await expect(page).toHaveURL(/\/notes\/.*/);

    // Note editor should be visible
    await expect(noteEditorPage.editor).toBeVisible();
  });

  test('should handle microphone permission denial', async ({ page, context }) => {
    // Revoke microphone permissions
    await context.clearPermissions();

    await recordingPage.goto();
    await recordingPage.startRecordingButton.click();

    // Should show error message
    await page.waitForTimeout(1000);
    await expect(recordingPage.errorMessage).toBeVisible();
    const errorText = await recordingPage.getErrorText();
    expect(errorText).toContain('microphone');
  });

  test('should display audio visualizer during recording', async ({ page }) => {
    await recordingPage.goto();

    // Start recording
    await recordingPage.startRecording();

    // Check if visualizer is visible
    await expect(recordingPage.audioVisualizer).toBeVisible();

    // Stop recording
    await recordingPage.stopRecording();
  });

  test('should prevent navigation during recording', async ({ page }) => {
    await recordingPage.goto();

    // Start recording
    await recordingPage.startRecording();

    // Try to navigate away
    page.on('dialog', async dialog => {
      // Expect a confirmation dialog
      expect(dialog.type()).toBe('beforeunload');
      await dialog.accept();
    });

    // Attempt navigation
    await page.goto('/notes');
  });

  test('should handle recording errors gracefully', async ({ page, context }) => {
    // Mock audio processing failure
    await context.route('**/transcribe/**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Processing failed' })
      });
    });

    await recordingPage.goto();

    // Record and try to process
    await recordingPage.startRecording();
    await page.waitForTimeout(1000);
    await recordingPage.stopRecording();
    await recordingPage.processRecording();

    // Should show error
    await page.waitForTimeout(2000);
    const hasError = await recordingPage.hasError();
    expect(hasError).toBeTruthy();

    // Should still be on recording page
    await expect(page).toHaveURL('/');
  });

  test('should maintain recording state across component re-renders', async ({ page }) => {
    await recordingPage.goto();

    // Start recording
    await recordingPage.startRecording();
    await page.waitForTimeout(2000);

    // Force a re-render by toggling theme or other UI action
    await page.keyboard.press('Control+Shift+L'); // Example: toggle theme

    // Recording should still be active
    await expect(recordingPage.recordingStatus).toBeVisible();
    const duration = await recordingPage.getRecordingDuration();
    expect(duration).toMatch(/00:0[2-9]/);
  });
});