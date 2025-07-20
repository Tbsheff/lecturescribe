import { Page, Locator } from '@playwright/test';

export class AuthPage {
  readonly page: Page;
  readonly signInTab: Locator;
  readonly signUpTab: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly signUpButton: Locator;
  readonly errorMessage: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Tab navigation
    this.signInTab = page.getByRole('tab', { name: 'Sign In' });
    this.signUpTab = page.getByRole('tab', { name: 'Sign Up' });
    
    // Sign In form elements
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.signInButton = page.getByRole('button', { name: /sign in/i });
    this.signUpButton = page.getByRole('button', { name: /sign up/i });
    
    // Feedback elements
    this.errorMessage = page.locator('.text-destructive');
    this.loadingIndicator = page.getByText(/signing (in|up).../i);
  }

  async goto() {
    await this.page.goto('/auth');
  }

  async signIn(email: string, password: string) {
    await this.signInTab.click();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async signUp(email: string, password: string) {
    await this.signUpTab.click();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signUpButton.click();
  }

  async waitForAuthSuccess() {
    // Wait for redirect after successful auth
    await this.page.waitForURL('/', { timeout: 10000 });
  }

  async getErrorMessage() {
    return await this.errorMessage.textContent();
  }

  async isLoading() {
    return await this.loadingIndicator.isVisible();
  }
}