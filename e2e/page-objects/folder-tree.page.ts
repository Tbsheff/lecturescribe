import { Page, Locator } from '@playwright/test';

export class FolderTreePage {
  readonly page: Page;
  readonly createFolderButton: Locator;
  readonly folderNameInput: Locator;
  readonly createButton: Locator;
  readonly cancelButton: Locator;
  readonly renameButton: Locator;
  readonly deleteButton: Locator;
  readonly moreOptionsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Main controls
    this.createFolderButton = page.getByRole('button', { name: /new.*folder|create folder/i });
    this.folderNameInput = page.getByPlaceholder(/folder name/i);
    this.createButton = page.getByRole('button', { name: 'Create' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.renameButton = page.getByRole('menuitem', { name: 'Rename' });
    this.deleteButton = page.getByRole('menuitem', { name: 'Delete' });
    this.moreOptionsButton = page.locator('button:has(svg.lucide-more-horizontal)');
  }

  async createFolder(name: string, parentFolder?: string) {
    if (parentFolder) {
      // Click on the parent folder's more options
      const folder = this.getFolderByName(parentFolder);
      await folder.hover();
      await folder.locator('button:has(svg.lucide-more-horizontal)').click();
      await this.page.getByRole('menuitem', { name: 'New Folder' }).click();
    } else {
      // Create root folder
      await this.createFolderButton.first().click();
    }
    
    await this.folderNameInput.fill(name);
    await this.createButton.click();
  }

  async renameItem(oldName: string, newName: string) {
    const item = this.getItemByName(oldName);
    await item.hover();
    await item.locator('button:has(svg.lucide-more-horizontal)').click();
    await this.renameButton.click();
    
    const renameInput = this.page.getByPlaceholder(/name/i);
    await renameInput.clear();
    await renameInput.fill(newName);
    await this.page.getByRole('button', { name: 'Rename' }).click();
  }

  async deleteItem(name: string) {
    const item = this.getItemByName(name);
    await item.hover();
    await item.locator('button:has(svg.lucide-more-horizontal)').click();
    await this.deleteButton.click();
  }

  async expandFolder(name: string) {
    const folder = this.getFolderByName(name);
    const chevron = folder.locator('button:has(svg.lucide-chevron-right)');
    if (await chevron.isVisible()) {
      await chevron.click();
    }
  }

  async collapseFolder(name: string) {
    const folder = this.getFolderByName(name);
    const chevron = folder.locator('button:has(svg.lucide-chevron-down)');
    if (await chevron.isVisible()) {
      await chevron.click();
    }
  }

  async selectNote(name: string) {
    const note = this.getNoteByName(name);
    await note.click();
  }

  async dragItemToFolder(itemName: string, targetFolderName: string) {
    const item = this.getItemByName(itemName);
    const targetFolder = this.getFolderByName(targetFolderName);
    
    await item.dragTo(targetFolder);
  }

  async isFolderExpanded(name: string): Promise<boolean> {
    const folder = this.getFolderByName(name);
    const chevronDown = folder.locator('svg.lucide-chevron-down');
    return await chevronDown.isVisible();
  }

  async isItemSelected(name: string): Promise<boolean> {
    const item = this.getItemByName(name);
    const classes = await item.getAttribute('class');
    return classes?.includes('bg-accent') || false;
  }

  async getItemCount(): Promise<number> {
    const items = this.page.locator('div:has(> svg.lucide-folder, > svg.lucide-file)');
    return await items.count();
  }

  async getFolderCount(): Promise<number> {
    const folders = this.page.locator('div:has(> svg.lucide-folder)');
    return await folders.count();
  }

  async getNoteCount(): Promise<number> {
    const notes = this.page.locator('div:has(> svg.lucide-file)');
    return await notes.count();
  }

  private getItemByName(name: string): Locator {
    return this.page.locator(`div:has(> span:text("${name}"))`).first();
  }

  private getFolderByName(name: string): Locator {
    return this.page.locator(`div:has(> svg.lucide-folder):has(span:text("${name}"))`).first();
  }

  private getNoteByName(name: string): Locator {
    return this.page.locator(`div:has(> svg.lucide-file):has(span:text("${name}"))`).first();
  }
}