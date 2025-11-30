import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { getGitRoot, isGitRepository, getCurrentGitConfig } from '../../src/util/gitManager';
import {
  createTestGitRepo,
  createNestedGitRepo,
  createSubfolder,
  getGitConfig,
  TestRepo,
} from './testHelpers';

describe('gitManager - Multi-Folder Workspace Scenarios', () => {
  describe('getGitRoot', () => {
    let testRepo: TestRepo;

    afterEach(async () => {
      if (testRepo) {
        await testRepo.cleanup();
      }
    });

    test('should find git root when given repository root path', async () => {
      testRepo = await createTestGitRepo({
        userName: 'Test User',
        email: 'test@example.com',
      });

      const gitRoot = await getGitRoot(testRepo.path);

      expect(gitRoot).toBe(testRepo.path);
    });

    test('should find git root when given a subfolder path', async () => {
      testRepo = await createTestGitRepo({
        userName: 'Test User',
        email: 'test@example.com',
      });

      // Create subfolder structure: repo/packages/app
      const subfolderPath = await createSubfolder(testRepo.path, 'packages/app');

      const gitRoot = await getGitRoot(subfolderPath);

      expect(gitRoot).toBe(testRepo.path);
      expect(gitRoot).not.toBe(subfolderPath);
    });

    test('should return null for non-git directory', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'non-git-'));

      const gitRoot = await getGitRoot(tmpDir);

      expect(gitRoot).toBeNull();
      await fs.remove(tmpDir);
    });
  });

  describe('Nested Repositories (Monorepo)', () => {
    let parentRepo: TestRepo;
    let nestedRepo1: TestRepo;
    let nestedRepo2: TestRepo;

    afterEach(async () => {
      if (parentRepo) {
        await parentRepo.cleanup();
      }
    });

    test('should identify separate git roots in nested repositories', async () => {
      // Create parent repo
      parentRepo = await createTestGitRepo({
        userName: 'Parent User',
        email: 'parent@example.com',
      });

      // Create nested repos
      nestedRepo1 = await createNestedGitRepo(parentRepo.path, 'packages/app1', {
        userName: 'App1 User',
        email: 'app1@example.com',
      });

      nestedRepo2 = await createNestedGitRepo(parentRepo.path, 'packages/app2', {
        userName: 'App2 User',
        email: 'app2@example.com',
      });

      // Test parent repo
      const parentRoot = await getGitRoot(parentRepo.path);
      expect(parentRoot).toBe(parentRepo.path);

      // Test nested repo 1
      const nested1Root = await getGitRoot(nestedRepo1.path);
      expect(nested1Root).toBe(nestedRepo1.path);
      expect(nested1Root).not.toBe(parentRepo.path);

      // Test nested repo 2
      const nested2Root = await getGitRoot(nestedRepo2.path);
      expect(nested2Root).toBe(nestedRepo2.path);
      expect(nested2Root).not.toBe(parentRepo.path);
    });

    test('should read correct git config from each nested repository', async () => {
      // Create parent repo
      parentRepo = await createTestGitRepo({
        userName: 'Parent User',
        email: 'parent@example.com',
        signingKey: 'parent-key',
      });

      // Create nested repos with different configs
      nestedRepo1 = await createNestedGitRepo(parentRepo.path, 'packages/app1', {
        userName: 'App1 User',
        email: 'app1@example.com',
        signingKey: 'app1-key',
      });

      nestedRepo2 = await createNestedGitRepo(parentRepo.path, 'packages/app2', {
        userName: 'App2 User',
        email: 'app2@example.com',
        signingKey: 'app2-key',
      });

      // Get configs
      const parentConfig = await getCurrentGitConfig(parentRepo.path);
      const nested1Config = await getCurrentGitConfig(nestedRepo1.path);
      const nested2Config = await getCurrentGitConfig(nestedRepo2.path);

      // Verify each repo has its own config
      expect(parentConfig).toEqual({
        userName: 'Parent User',
        email: 'parent@example.com',
        signingKey: 'parent-key',
      });

      expect(nested1Config).toEqual({
        userName: 'App1 User',
        email: 'app1@example.com',
        signingKey: 'app1-key',
      });

      expect(nested2Config).toEqual({
        userName: 'App2 User',
        email: 'app2@example.com',
        signingKey: 'app2-key',
      });
    });
  });

  describe('Workspace Folder as Subfolder Scenario', () => {
    let testRepo: TestRepo;

    afterEach(async () => {
      if (testRepo) {
        await testRepo.cleanup();
      }
    });

    test('should find git root when workspace folder is a subfolder', async () => {
      // Scenario: User opens /repo/packages/frontend as workspace folder
      testRepo = await createTestGitRepo({
        userName: 'Test User',
        email: 'test@example.com',
      });

      const workspaceFolder = await createSubfolder(testRepo.path, 'packages/frontend');

      const gitRoot = await getGitRoot(workspaceFolder);

      // Should find the parent repo root, not the subfolder
      expect(gitRoot).toBe(testRepo.path);
    });

    test('should read git config from repository root, not subfolder', async () => {
      testRepo = await createTestGitRepo({
        userName: 'Repo User',
        email: 'repo@example.com',
        signingKey: 'repo-key',
      });

      const workspaceFolder = await createSubfolder(testRepo.path, 'src/components');

      // Get git root from subfolder
      const gitRoot = await getGitRoot(workspaceFolder);
      expect(gitRoot).toBe(testRepo.path);

      // Read config should use the git root
      const config = await getCurrentGitConfig(gitRoot!);

      expect(config).toEqual({
        userName: 'Repo User',
        email: 'repo@example.com',
        signingKey: 'repo-key',
      });
    });
  });

  describe('Multi-Root Workspace Scenario', () => {
    let repo1: TestRepo;
    let repo2: TestRepo;

    afterEach(async () => {
      if (repo1) await repo1.cleanup();
      if (repo2) await repo2.cleanup();
    });

    test('should correctly identify different git roots for different workspace folders', async () => {
      // Simulate VSCode multi-root workspace with 2 separate repos
      repo1 = await createTestGitRepo({
        userName: 'User 1',
        email: 'user1@example.com',
      });

      repo2 = await createTestGitRepo({
        userName: 'User 2',
        email: 'user2@example.com',
      });

      const root1 = await getGitRoot(repo1.path);
      const root2 = await getGitRoot(repo2.path);

      expect(root1).toBe(repo1.path);
      expect(root2).toBe(repo2.path);
      expect(root1).not.toBe(root2);
    });

    test('should read independent git configs for each workspace folder', async () => {
      repo1 = await createTestGitRepo({
        userName: 'Alice',
        email: 'alice@work.com',
        signingKey: 'work-key-123',
      });

      repo2 = await createTestGitRepo({
        userName: 'Bob',
        email: 'bob@personal.com',
        signingKey: 'personal-key-456',
      });

      const config1 = await getCurrentGitConfig(repo1.path);
      const config2 = await getCurrentGitConfig(repo2.path);

      expect(config1).toEqual({
        userName: 'Alice',
        email: 'alice@work.com',
        signingKey: 'work-key-123',
      });

      expect(config2).toEqual({
        userName: 'Bob',
        email: 'bob@personal.com',
        signingKey: 'personal-key-456',
      });
    });
  });

  describe('isGitRepository', () => {
    let testRepo: TestRepo;

    afterEach(async () => {
      if (testRepo) {
        await testRepo.cleanup();
      }
    });

    test('should return true for git repository root', async () => {
      testRepo = await createTestGitRepo();
      const isRepo = await isGitRepository(testRepo.path);
      expect(isRepo).toBe(true);
    });

    test('should return true for subfolder within git repository', async () => {
      testRepo = await createTestGitRepo();
      const subfolder = await createSubfolder(testRepo.path, 'src/utils');
      const isRepo = await isGitRepository(subfolder);
      expect(isRepo).toBe(true);
    });

    test('should return false for non-git directory', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'non-git-'));

      const isRepo = await isGitRepository(tmpDir);
      expect(isRepo).toBe(false);

      await fs.remove(tmpDir);
    });
  });

  describe('Edge Cases', () => {
    let testRepo: TestRepo;

    afterEach(async () => {
      if (testRepo) {
        await testRepo.cleanup();
      }
    });

    test('should handle deeply nested subfolders', async () => {
      testRepo = await createTestGitRepo({
        userName: 'Test User',
        email: 'test@example.com',
      });

      const deepPath = await createSubfolder(
        testRepo.path,
        'a/b/c/d/e/f/g'
      );

      const gitRoot = await getGitRoot(deepPath);
      expect(gitRoot).toBe(testRepo.path);
    });

    test('should handle repository with no git config set', async () => {
      testRepo = await createTestGitRepo(); // No config provided

      const config = await getCurrentGitConfig(testRepo.path);

      expect(config).toEqual({
        userName: '',
        email: '',
        signingKey: '',
      });
    });

    test('should handle partial git config (only name and email)', async () => {
      testRepo = await createTestGitRepo({
        userName: 'Test User',
        email: 'test@example.com',
        // No signing key
      });

      const config = await getCurrentGitConfig(testRepo.path);

      expect(config).toEqual({
        userName: 'Test User',
        email: 'test@example.com',
        signingKey: '',
      });
    });
  });
});
