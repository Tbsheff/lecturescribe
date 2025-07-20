import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/auth.page';
import { NavigationPage } from './page-objects/navigation.page';

test.describe('Authentication Flow', () => {
  let authPage: AuthPage;
  let navPage: NavigationPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    navPage = new NavigationPage(page);
  });

  test('should sign up a new user successfully', async ({ page }) => {
    // Generate unique email for test
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    await authPage.goto();
    await authPage.signUp(testEmail, testPassword);

    // Should redirect to home page after successful signup
    await authPage.waitForAuthSuccess();
    await expect(page).toHaveURL('/');

    // Should show authenticated user menu
    await expect(navPage.userMenu).toBeVisible();
  });

  test('should sign in with existing user', async ({ page }) => {
    // Note: This assumes a test user exists in the database
    // In a real scenario, you'd set up test data before running
    const testEmail = 'testuser@example.com';
    const testPassword = 'TestPassword123!';

    await authPage.goto();
    await authPage.signIn(testEmail, testPassword);

    // Should redirect to home page
    await authPage.waitForAuthSuccess();
    await expect(page).toHaveURL('/');

    // Should show authenticated user menu
    await expect(navPage.userMenu).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await authPage.goto();
    await authPage.signIn('invalid@example.com', 'wrongpassword');

    // Should stay on auth page
    await expect(page).toHaveURL('/auth');

    // Should show error message (implementation may vary)
    // You might need to adjust this based on how errors are displayed
    await page.waitForTimeout(1000); // Wait for error to appear
    const errorVisible = await page.locator('.text-destructive, [role="alert"]').isVisible();
    expect(errorVisible).toBeTruthy();
  });

  test('should sign out successfully', async ({ page }) => {
    // First sign in
    const testEmail = 'testuser@example.com';
    const testPassword = 'TestPassword123!';

    await authPage.goto();
    await authPage.signIn(testEmail, testPassword);
    await authPage.waitForAuthSuccess();

    // Then sign out
    await navPage.signOut();
    await navPage.waitForSignOut();

    // Should redirect to auth page
    await expect(page).toHaveURL('/auth');

    // User menu should not be visible
    await expect(navPage.userMenu).not.toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await authPage.goto();

    // Try to sign in without filling fields
    await authPage.signInButton.click();

    // Check for HTML5 validation messages
    const emailInput = authPage.emailInput;
    const isEmailInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isEmailInvalid).toBeTruthy();
  });

  test('should switch between sign in and sign up tabs', async ({ page }) => {
    await authPage.goto();

    // Start on sign in tab
    await expect(authPage.signInTab).toHaveAttribute('data-state', 'active');

    // Switch to sign up
    await authPage.signUpTab.click();
    await expect(authPage.signUpTab).toHaveAttribute('data-state', 'active');
    await expect(authPage.signUpButton).toBeVisible();

    // Switch back to sign in
    await authPage.signInTab.click();
    await expect(authPage.signInTab).toHaveAttribute('data-state', 'active');
    await expect(authPage.signInButton).toBeVisible();
  });

  test('should show loading state during authentication', async ({ page }) => {
    await authPage.goto();
    
    // Fill form
    await authPage.emailInput.fill('test@example.com');
    await authPage.passwordInput.fill('password123');

    // Click sign in and immediately check for loading state
    const signInPromise = authPage.signInButton.click();
    
    // Check if button shows loading state (text changes or is disabled)
    const buttonText = await authPage.signInButton.textContent();
    const isDisabled = await authPage.signInButton.isDisabled();
    
    expect(buttonText?.toLowerCase()).toContain('signing in');
    expect(isDisabled).toBeTruthy();

    // Wait for the action to complete
    await signInPromise;
  });

  test('should handle network errors gracefully', async ({ page, context }) => {
    // Block API requests to simulate network error
    await context.route('**/auth/**', route => route.abort());

    await authPage.goto();
    await authPage.signIn('test@example.com', 'password123');

    // Should show error and stay on auth page
    await expect(page).toHaveURL('/auth');
    
    // Wait for error message
    await page.waitForTimeout(1000);
    const hasError = await page.locator('.text-destructive, [role="alert"], .error').isVisible();
    expect(hasError).toBeTruthy();
  });
});