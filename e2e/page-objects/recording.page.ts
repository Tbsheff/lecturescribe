import { Page, Locator } from '@playwright/test';

export class RecordingPage {
  readonly page: Page;
  readonly startRecordingButton: Locator;
  readonly stopRecordingButton: Locator;
  readonly discardButton: Locator;
  readonly processButton: Locator;
  readonly recordingDuration: Locator;
  readonly audioVisualizer: Locator;
  readonly processingIndicator: Locator;
  readonly errorMessage: Locator;
  readonly recordingStatus: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Recording controls
    this.startRecordingButton = page.getByRole('button', { name: /start recording/i });
    this.stopRecordingButton = page.getByRole('button', { name: /stop recording/i });
    this.discardButton = page.getByRole('button', { name: /discard/i });
    this.processButton = page.getByRole('button', { name: /process with ai/i });
    
    // Status elements
    this.recordingDuration = page.locator('text=/\\d{2}:\\d{2}/');
    this.audioVisualizer = page.locator('canvas');
    this.processingIndicator = page.getByText(/processing audio/i);
    this.errorMessage = page.locator('.bg-destructive\\/10');
    this.recordingStatus = page.getByText(/recording\.\.\./i);
  }

  async goto() {
    await this.page.goto('/');
  }

  async startRecording() {
    await this.startRecordingButton.click();
    // Grant microphone permission if browser prompts
    await this.page.context().grantPermissions(['microphone']);
  }

  async stopRecording() {
    await this.stopRecordingButton.click();
  }

  async discardRecording() {
    await this.discardButton.click();
  }

  async processRecording() {
    await this.processButton.click();
  }

  async waitForProcessingComplete() {
    // Wait for navigation to the note page
    await this.page.waitForURL(/\/notes\/.*/, { timeout: 30000 });
  }

  async isRecording() {
    return await this.recordingStatus.isVisible();
  }

  async getRecordingDuration() {
    return await this.recordingDuration.textContent();
  }

  async hasError() {
    return await this.errorMessage.isVisible();
  }

  async getErrorText() {
    return await this.errorMessage.textContent();
  }

  async isProcessing() {
    return await this.processingIndicator.isVisible();
  }
}