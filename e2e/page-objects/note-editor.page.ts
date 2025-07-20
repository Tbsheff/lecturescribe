import { Page, Locator } from '@playwright/test';

export class NoteEditorPage {
  readonly page: Page;
  readonly editor: Locator;
  readonly editTab: Locator;
  readonly previewTab: Locator;
  readonly saveStatus: Locator;
  readonly boldButton: Locator;
  readonly italicButton: Locator;
  readonly heading1Button: Locator;
  readonly heading2Button: Locator;
  readonly bulletListButton: Locator;
  readonly numberedListButton: Locator;
  readonly linkButton: Locator;
  readonly imageButton: Locator;
  readonly previewContent: Locator;
  readonly deleteNoteButton: Locator;
  readonly noteTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Editor elements
    this.editor = page.locator('textarea[placeholder="Start writing..."]');
    this.editTab = page.getByRole('tab', { name: 'Edit' });
    this.previewTab = page.getByRole('tab', { name: 'Preview' });
    this.saveStatus = page.getByText(/sav(ed|ing)/i);
    
    // Formatting toolbar
    this.boldButton = page.getByRole('button', { name: /bold/i });
    this.italicButton = page.getByRole('button', { name: /italic/i });
    this.heading1Button = page.getByRole('button', { name: /heading 1/i });
    this.heading2Button = page.getByRole('button', { name: /heading 2/i });
    this.bulletListButton = page.getByRole('button', { name: /bullet list/i });
    this.numberedListButton = page.getByRole('button', { name: /numbered list/i });
    this.linkButton = page.getByRole('button', { name: /link/i });
    this.imageButton = page.getByRole('button', { name: /image/i });
    
    // Preview and note management
    this.previewContent = page.locator('.prose');
    this.deleteNoteButton = page.getByRole('button', { name: /delete/i });
    this.noteTitle = page.locator('h1').first();
  }

  async goto(noteId: string) {
    await this.page.goto(`/notes/${noteId}`);
  }

  async typeContent(content: string) {
    await this.editor.click();
    await this.editor.fill(content);
  }

  async appendContent(content: string) {
    await this.editor.click();
    await this.editor.press('End');
    await this.editor.type(content);
  }

  async selectText(start: number, end: number) {
    await this.editor.click();
    await this.page.keyboard.press('Control+A');
    await this.editor.evaluate((el, [s, e]) => {
      (el as HTMLTextAreaElement).setSelectionRange(s, e);
    }, [start, end]);
  }

  async formatBold() {
    await this.boldButton.click();
  }

  async formatItalic() {
    await this.italicButton.click();
  }

  async formatHeading1() {
    await this.heading1Button.click();
  }

  async formatHeading2() {
    await this.heading2Button.click();
  }

  async insertBulletList() {
    await this.bulletListButton.click();
  }

  async insertNumberedList() {
    await this.numberedListButton.click();
  }

  async switchToPreview() {
    await this.previewTab.click();
  }

  async switchToEdit() {
    await this.editTab.click();
  }

  async waitForSave() {
    await this.page.waitForFunction(
      () => document.querySelector('text=/Saved/i')?.textContent === 'Saved',
      { timeout: 5000 }
    );
  }

  async getContent() {
    return await this.editor.inputValue();
  }

  async getPreviewContent() {
    await this.switchToPreview();
    return await this.previewContent.textContent();
  }

  async deleteNote() {
    await this.deleteNoteButton.click();
    // Confirm deletion in dialog if present
    const confirmButton = this.page.getByRole('button', { name: /confirm|yes|delete/i }).last();
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
  }

  async isSaved() {
    const status = await this.saveStatus.textContent();
    return status?.toLowerCase() === 'saved';
  }
}