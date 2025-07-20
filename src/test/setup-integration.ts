import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestUser, cleanupTestData } from './supabase-test-client';

// Mock the original Supabase client to use our test client
vi.mock('@/integrations/supabase/client', async () => {
  const { testSupabaseClient } = await import('./supabase-test-client');
  return {
    supabase: testSupabaseClient,
  };
});

// Setup test user before all tests
beforeAll(async () => {
  try {
    await createTestUser();
  } catch (error) {
    console.warn('Test user creation failed (may already exist):', error);
  }
});

// Reset mocks and clean data before each test
beforeEach(async () => {
  vi.clearAllMocks();
  await cleanupTestData();
});

// Clean up after each test
afterEach(async () => {
  cleanup();
  await cleanupTestData();
});

// Clean up after all tests
afterAll(async () => {
  await cleanupTestData();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock window.scrollTo
window.scrollTo = vi.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
};