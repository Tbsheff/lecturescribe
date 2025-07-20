# LectureScribe E2E Tests

This directory contains end-to-end tests for LectureScribe using Playwright.

## Test Structure

### Page Objects (`/page-objects`)
- `auth.page.ts` - Authentication page interactions
- `recording.page.ts` - Audio recording functionality
- `note-editor.page.ts` - Note editing and management
- `folder-tree.page.ts` - Folder organization features
- `navigation.page.ts` - App navigation elements

### Test Suites
- `auth.spec.ts` - Authentication flow tests (sign up, sign in, sign out)
- `audio-recording.spec.ts` - Audio recording and processing tests
- `note-management.spec.ts` - Note creation, editing, and deletion tests
- `folder-organization.spec.ts` - Folder creation and organization tests

### Helpers (`/helpers`)
- `test-data.ts` - Test constants and data generators
- `auth.helper.ts` - Authentication utility functions

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run tests with UI mode
```bash
npm run test:e2e:ui
```

### Run specific test file
```bash
npx playwright test e2e/auth.spec.ts
```

### Run tests in headed mode (see browser)
```bash
npx playwright test --headed
```

### Run tests in debug mode
```bash
npx playwright test --debug
```

### Run specific test by name
```bash
npx playwright test -g "should sign up a new user"
```

## Test Configuration

Tests are configured in `playwright.config.ts`:
- Base URL: `http://localhost:5173`
- Browsers: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari
- Parallel execution enabled
- Automatic retries on CI
- Screenshots on failure
- Video recording on failure

## Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

3. Ensure you have a test database configured or use mock data

## Writing New Tests

1. Create page objects for new UI components
2. Use existing helpers for common operations
3. Follow the established patterns:
   - Use descriptive test names
   - Set up authentication in `beforeEach` when needed
   - Clean up test data in `afterEach` if necessary
   - Use page objects instead of direct selectors
   - Add data-testid attributes for critical elements

## Best Practices

1. **Page Objects**: Always use page objects for better maintainability
2. **Selectors**: Prefer semantic selectors (role, text) over CSS
3. **Waits**: Use Playwright's auto-waiting; avoid hard timeouts
4. **Assertions**: Use Playwright's web-first assertions
5. **Test Data**: Generate unique data for each test run
6. **Parallelization**: Ensure tests don't interfere with each other

## Debugging Failed Tests

1. Check the test report:
   ```bash
   npx playwright show-report
   ```

2. Use trace viewer for failed tests:
   ```bash
   npx playwright show-trace trace.zip
   ```

3. Run in debug mode to step through tests

## CI/CD Integration

Tests are configured to run in CI with:
- Retries enabled (2 attempts)
- Parallel execution disabled
- Failure artifacts (screenshots, videos, traces)

## Common Issues

### Microphone Permission
Tests requiring microphone access grant permissions automatically. On local development, you may need to allow microphone access in your browser.

### Test User Setup
Some tests expect a test user to exist. You may need to:
1. Create a test user manually
2. Set up test data seeding
3. Use a test database

### Flaky Tests
If tests are flaky:
1. Check for timing issues
2. Ensure proper waits are in place
3. Verify test isolation
4. Check for race conditions

## Environment Variables

Set these variables for different environments:
- `BASE_URL` - Override the base URL
- `CI` - Set to true in CI environments
- `PWDEBUG` - Set to 1 for debug mode