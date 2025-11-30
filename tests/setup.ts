/**
 * Jest setup file
 * Runs before each test file
 */

import { execSync } from 'child_process';

// Set up any global test configuration here
jest.setTimeout(30000); // 30 second timeout for git operations

// Configure git user identity for CI/CD environments
// This prevents "Author identity unknown" errors when running tests
beforeAll(() => {
  try {
    // Set global git config for tests
    execSync('git config --global user.email "test@example.com"', { stdio: 'ignore' });
    execSync('git config --global user.name "Test User"', { stdio: 'ignore' });
  } catch (error) {
    // Silently ignore errors in case git is not available or already configured
    console.warn('Could not configure git user identity for tests:', error);
  }
});
