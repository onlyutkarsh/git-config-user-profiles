import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { simpleGit, SimpleGit } from 'simple-git';

/**
 * Test utilities for creating temporary git repositories
 */

export interface TestRepo {
  path: string;
  git: SimpleGit;
  cleanup: () => Promise<void>;
}

export interface TestRepoConfig {
  userName?: string;
  email?: string;
  signingKey?: string;
}

/**
 * Normalizes path to resolve macOS /var -> /private/var symlink
 */
function normalizePath(p: string): string {
  return fs.realpathSync(p);
}

/**
 * Creates a temporary git repository for testing
 */
export async function createTestGitRepo(config?: TestRepoConfig): Promise<TestRepo> {
  const tmpDir = normalizePath(await fs.mkdtemp(path.join(os.tmpdir(), 'git-test-')));
  const git = simpleGit(tmpDir);

  // Initialize git repo
  await git.init();

  // Disable GPG signing for tests to avoid 1Password SSH agent issues
  await git.addConfig('commit.gpgsign', 'false', false, 'local');

  // Set local git config if provided
  if (config?.userName) {
    await git.addConfig('user.name', config.userName, false, 'local');
  }
  if (config?.email) {
    await git.addConfig('user.email', config.email, false, 'local');
  }
  if (config?.signingKey) {
    await git.addConfig('user.signingkey', config.signingKey, false, 'local');
  }

  // Create initial commit so repo is valid
  const readmePath = path.join(tmpDir, 'README.md');
  await fs.writeFile(readmePath, '# Test Repository');
  await git.add('README.md');
  await git.commit('Initial commit');

  return {
    path: tmpDir,
    git,
    cleanup: async () => {
      await fs.remove(tmpDir);
    },
  };
}

/**
 * Creates a nested git repository (for monorepo testing)
 */
export async function createNestedGitRepo(
  parentPath: string,
  subPath: string,
  config?: TestRepoConfig
): Promise<TestRepo> {
  const fullPath = path.join(parentPath, subPath);
  await fs.mkdirp(fullPath);
  const normalizedPath = normalizePath(fullPath);
  const git = simpleGit(normalizedPath);

  // Initialize git repo
  await git.init();

  // Disable GPG signing for tests to avoid 1Password SSH agent issues
  await git.addConfig('commit.gpgsign', 'false', false, 'local');

  // Set local git config if provided
  if (config?.userName) {
    await git.addConfig('user.name', config.userName, false, 'local');
  }
  if (config?.email) {
    await git.addConfig('user.email', config.email, false, 'local');
  }
  if (config?.signingKey) {
    await git.addConfig('user.signingkey', config.signingKey, false, 'local');
  }

  // Create initial commit
  const readmePath = path.join(normalizedPath, 'README.md');
  await fs.writeFile(readmePath, `# Nested Repository ${subPath}`);
  await git.add('README.md');
  await git.commit('Initial commit');

  return {
    path: normalizedPath,
    git,
    cleanup: async () => {
      // Don't delete the directory, parent will handle it
    },
  };
}

/**
 * Creates a subfolder within a git repository (not a separate repo)
 */
export async function createSubfolder(
  repoPath: string,
  subPath: string
): Promise<string> {
  const fullPath = path.join(repoPath, subPath);
  await fs.mkdirp(fullPath);

  // Create a test file in the subfolder
  const testFilePath = path.join(fullPath, 'test.txt');
  await fs.writeFile(testFilePath, 'test content');

  return fullPath;
}

/**
 * Gets git config values from a repository
 */
export async function getGitConfig(
  repoPath: string
): Promise<{ userName: string; email: string; signingKey: string }> {
  const git = simpleGit(repoPath);
  const userName = await git.getConfig('user.name', 'local');
  const email = await git.getConfig('user.email', 'local');
  const signingKey = await git.getConfig('user.signingkey', 'local');

  return {
    userName: userName.value || '',
    email: email.value || '',
    signingKey: signingKey.value || '',
  };
}
