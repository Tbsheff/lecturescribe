import { Page, Locator } from '@playwright/test';

export class NavigationPage {
  readonly page: Page;
  readonly userMenu: Locator;
  readonly signOutButton: Locator;
  readonly profileButton: Locator;
  readonly settingsButton: Locator;
  readonly homeLink: Locator;
  readonly notesLink: Locator;
  readonly logo: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Navigation elements
    this.userMenu = page.locator('[data-testid="user-menu"], button:has(svg.lucide-user)');
    this.signOutButton = page.getByRole('menuitem', { name: /sign out|logout/i });
    this.profileButton = page.getByRole('menuitem', { name: /profile/i });
    this.settingsButton = page.getByRole('menuitem', { name: /settings/i });
    this.homeLink = page.getByRole('link', { name: /home/i });
    this.notesLink = page.getByRole('link', { name: /notes/i });
    this.logo = page.getByText(/lecturescribe/i).first();
  }

  async openUserMenu() {
    await this.userMenu.click();
  }

  async signOut() {
    await this.openUserMenu();
    await this.signOutButton.click();
  }

  async navigateToHome() {
    await this.homeLink.click();
  }

  async navigateToNotes() {
    await this.notesLink.click();
  }

  async navigateToSettings() {
    await this.openUserMenu();
    await this.settingsButton.click();
  }

  async isUserAuthenticated(): Promise<boolean> {
    return await this.userMenu.isVisible();
  }

  async waitForSignOut() {
    await this.page.waitForURL('/auth');
  }
}