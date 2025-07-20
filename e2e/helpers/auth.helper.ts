import { Page } from '@playwright/test';
import { AuthPage } from '../page-objects/auth.page';
import { TEST_USER } from './test-data';

export class AuthHelper {
  static async signIn(page: Page, email?: string, password?: string): Promise<void> {
    const authPage = new AuthPage(page);
    
    await authPage.goto();
    await authPage.signIn(
      email || TEST_USER.email,
      password || TEST_USER.password
    );
    await authPage.waitForAuthSuccess();
  }

  static async signUp(page: Page, email: string, password: string): Promise<void> {
    const authPage = new AuthPage(page);
    
    await authPage.goto();
    await authPage.signUp(email, password);
    await authPage.waitForAuthSuccess();
  }

  static async ensureSignedOut(page: Page): Promise<void> {
    // Check if user is signed in by looking for user menu
    const userMenuVisible = await page.locator('[data-testid="user-menu"], button:has(svg.lucide-user)').isVisible();
    
    if (userMenuVisible) {
      // Sign out
      await page.locator('[data-testid="user-menu"], button:has(svg.lucide-user)').click();
      await page.getByRole('menuitem', { name: /sign out|logout/i }).click();
      await page.waitForURL('/auth');
    }
  }

  static async setupAuthenticatedSession(page: Page): Promise<void> {
    // This could be enhanced to use session storage or cookies
    // to speed up tests by avoiding repeated sign-ins
    await this.signIn(page);
  }
}