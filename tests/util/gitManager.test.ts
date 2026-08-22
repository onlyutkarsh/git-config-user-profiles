import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import simpleGit from "simple-git";
import * as vscode from "vscode";
import {
  getCurrentGitConfig,
  getGitRoot,
  getWorkspaceStatus,
  invalidateWorkspaceStatusCache,
  isGitRepository,
  restoreGitConfig,
  updateGitConfig,
  WorkspaceStatus,
} from "../../src/util/gitManager";
import { createNestedGitRepo, createSubfolder, createTestGitRepo, TestRepo } from "./testHelpers";

describe("gitManager - Multi-Folder Workspace Scenarios", () => {
  describe("getGitRoot", () => {
    let testRepo: TestRepo;

    afterEach(async () => {
      if (testRepo) {
        await testRepo.cleanup();
      }
    });

    test("should find git root when given repository root path", async () => {
      testRepo = await createTestGitRepo({
        userName: "Test User",
        email: "test@example.com",
      });

      const gitRoot = await getGitRoot(testRepo.path);

      expect(gitRoot).toBe(testRepo.path);
    });

    test("should find git root when given a subfolder path", async () => {
      testRepo = await createTestGitRepo({
        userName: "Test User",
        email: "test@example.com",
      });

      // Create subfolder structure: repo/packages/app
      const subfolderPath = await createSubfolder(testRepo.path, "packages/app");

      const gitRoot = await getGitRoot(subfolderPath);

      expect(gitRoot).toBe(testRepo.path);
      expect(gitRoot).not.toBe(subfolderPath);
    });

    test.each([
      ["document fileName", "not-admin", "config"],
      ["URI path", "config", "not-admin"],
      ["document fileName", "not-admin", "description"],
      ["URI path", "description", "not-admin"],
      ["document fileName", "not-admin", "hooks/pre-commit"],
      ["URI path", "hooks/pre-commit", "not-admin"],
    ])("should keep the repository active when a .git file is identified by the %s", async (_source, uriName, documentName) => {
      testRepo = await createTestGitRepo({
        userName: "Test User",
        email: "test@example.com",
      });

      const workspaceFolder = { uri: vscode.Uri.file(testRepo.path), name: "test-repo", index: 0 };
      (vscode.workspace as any).workspaceFolders = [workspaceFolder];
      const uriPath = path.join(testRepo.path, ".git", uriName);
      const documentPath = path.join(testRepo.path, ".git", documentName);
      (vscode.window as any).activeTextEditor = {
        document: {
          uri: vscode.Uri.file(uriPath),
          fileName: documentPath,
        },
      };
      (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue(undefined);
      (vscode.workspace.getWorkspaceFolder as jest.Mock).mockClear();

      try {
        const result = await getWorkspaceStatus();

        expect(result.currentFolder).toBe(testRepo.path);
        expect(result.message).toBe("No profiles found in settings.");
        expect(result.status).toBe(WorkspaceStatus.NoProfilesInConfig);
        expect(vscode.workspace.getWorkspaceFolder).not.toHaveBeenCalled();
      } finally {
        (vscode.window as any).activeTextEditor = undefined;
        (vscode.workspace as any).workspaceFolders = [];
      }
    });

    test("should report a non-repository file outside the workspace", async () => {
      testRepo = await createTestGitRepo();

      (vscode.workspace as any).workspaceFolders = [{ uri: vscode.Uri.file(testRepo.path), name: "test-repo", index: 0 }];
      (vscode.window as any).activeTextEditor = {
        document: {
          uri: vscode.Uri.file(path.join(testRepo.path, "outside.txt")),
          fileName: path.join(testRepo.path, "outside.txt"),
        },
      };
      (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue(undefined);

      try {
        const result = await getWorkspaceStatus();

        expect(result.status).toBe(WorkspaceStatus.NotAValidWorkspace);
        expect(result.currentFolder).toBeUndefined();
        expect(result.message).toBe("This file is not part of a workspace folder.");
      } finally {
        (vscode.window as any).activeTextEditor = undefined;
        (vscode.workspace as any).workspaceFolders = [];
      }
    });

    test("should return null for non-git directory", async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "non-git-"));

      const gitRoot = await getGitRoot(tmpDir);

      expect(gitRoot).toBeNull();
      await fs.remove(tmpDir);
    });
  });

  describe("Nested Repositories (Monorepo)", () => {
    let parentRepo: TestRepo;
    let nestedRepo1: TestRepo;
    let nestedRepo2: TestRepo;

    afterEach(async () => {
      if (parentRepo) {
        await parentRepo.cleanup();
      }
    });

    test("should identify separate git roots in nested repositories", async () => {
      // Create parent repo
      parentRepo = await createTestGitRepo({
        userName: "Parent User",
        email: "parent@example.com",
      });

      // Create nested repos
      nestedRepo1 = await createNestedGitRepo(parentRepo.path, "packages/app1", {
        userName: "App1 User",
        email: "app1@example.com",
      });

      nestedRepo2 = await createNestedGitRepo(parentRepo.path, "packages/app2", {
        userName: "App2 User",
        email: "app2@example.com",
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

    test("should read correct git config from each nested repository", async () => {
      // Create parent repo
      parentRepo = await createTestGitRepo({
        userName: "Parent User",
        email: "parent@example.com",
        signingKey: "parent-key",
      });

      // Create nested repos with different configs
      nestedRepo1 = await createNestedGitRepo(parentRepo.path, "packages/app1", {
        userName: "App1 User",
        email: "app1@example.com",
        signingKey: "app1-key",
      });

      nestedRepo2 = await createNestedGitRepo(parentRepo.path, "packages/app2", {
        userName: "App2 User",
        email: "app2@example.com",
        signingKey: "app2-key",
      });

      // Get configs
      const parentConfig = await getCurrentGitConfig(parentRepo.path);
      const nested1Config = await getCurrentGitConfig(nestedRepo1.path);
      const nested2Config = await getCurrentGitConfig(nestedRepo2.path);

      // Verify each repo has its own config
      expect(parentConfig).toEqual({
        userName: "Parent User",
        email: "parent@example.com",
        signingKey: "parent-key",
      });

      expect(nested1Config).toEqual({
        userName: "App1 User",
        email: "app1@example.com",
        signingKey: "app1-key",
      });

      expect(nested2Config).toEqual({
        userName: "App2 User",
        email: "app2@example.com",
        signingKey: "app2-key",
      });
    });
  });

  describe("Workspace Folder as Subfolder Scenario", () => {
    let testRepo: TestRepo;

    afterEach(async () => {
      if (testRepo) {
        await testRepo.cleanup();
      }
    });

    test("should find git root when workspace folder is a subfolder", async () => {
      // Scenario: User opens /repo/packages/frontend as workspace folder
      testRepo = await createTestGitRepo({
        userName: "Test User",
        email: "test@example.com",
      });

      const workspaceFolder = await createSubfolder(testRepo.path, "packages/frontend");

      const gitRoot = await getGitRoot(workspaceFolder);

      // Should find the parent repo root, not the subfolder
      expect(gitRoot).toBe(testRepo.path);
    });

    test("should read git config from repository root, not subfolder", async () => {
      testRepo = await createTestGitRepo({
        userName: "Repo User",
        email: "repo@example.com",
        signingKey: "repo-key",
      });

      const workspaceFolder = await createSubfolder(testRepo.path, "src/components");

      // Get git root from subfolder
      const gitRoot = await getGitRoot(workspaceFolder);
      expect(gitRoot).toBe(testRepo.path);

      // Read config should use the git root
      const config = await getCurrentGitConfig(gitRoot!);

      expect(config).toEqual({
        userName: "Repo User",
        email: "repo@example.com",
        signingKey: "repo-key",
      });
    });
  });

  describe("Multi-Root Workspace Scenario", () => {
    let repo1: TestRepo;
    let repo2: TestRepo;

    afterEach(async () => {
      if (repo1) await repo1.cleanup();
      if (repo2) await repo2.cleanup();
    });

    test("should correctly identify different git roots for different workspace folders", async () => {
      // Simulate VSCode multi-root workspace with 2 separate repos
      repo1 = await createTestGitRepo({
        userName: "User 1",
        email: "user1@example.com",
      });

      repo2 = await createTestGitRepo({
        userName: "User 2",
        email: "user2@example.com",
      });

      const root1 = await getGitRoot(repo1.path);
      const root2 = await getGitRoot(repo2.path);

      expect(root1).toBe(repo1.path);
      expect(root2).toBe(repo2.path);
      expect(root1).not.toBe(root2);
    });

    test("should read independent git configs for each workspace folder", async () => {
      repo1 = await createTestGitRepo({
        userName: "Alice",
        email: "alice@work.com",
        signingKey: "work-key-123",
      });

      repo2 = await createTestGitRepo({
        userName: "Bob",
        email: "bob@personal.com",
        signingKey: "personal-key-456",
      });

      const config1 = await getCurrentGitConfig(repo1.path);
      const config2 = await getCurrentGitConfig(repo2.path);

      expect(config1).toEqual({
        userName: "Alice",
        email: "alice@work.com",
        signingKey: "work-key-123",
      });

      expect(config2).toEqual({
        userName: "Bob",
        email: "bob@personal.com",
        signingKey: "personal-key-456",
      });
    });
  });

  describe("Profile auto-selection", () => {
    let testRepo: TestRepo;

    async function configureWorkspace(profiles: object[], selectedProfileId?: string) {
      const workspaceFolder = { uri: vscode.Uri.file(testRepo.path), name: "test-repo", index: 0 };
      (vscode.workspace as any).workspaceFolders = [workspaceFolder];
      (vscode.window as any).activeTextEditor = {
        document: {
          uri: vscode.Uri.file(path.join(testRepo.path, "README.md")),
          fileName: path.join(testRepo.path, "README.md"),
        },
      };
      (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue(workspaceFolder);

      const config = vscode.workspace.getConfiguration("gitConfigUser");
      await config.update("profiles", profiles);
      await config.update("workspaceProfileSelections", selectedProfileId ? { [testRepo.path]: selectedProfileId } : {});
      await config.update("selectMatchedProfileAutomatically", true);
      return config;
    }

    afterEach(async () => {
      invalidateWorkspaceStatusCache();
      (vscode.window as any).activeTextEditor = undefined;
      (vscode.workspace as any).workspaceFolders = [];
      if ((vscode.workspace as any)._clearMockConfigurations) {
        (vscode.workspace as any)._clearMockConfigurations();
      }
      if (testRepo) {
        await testRepo.cleanup();
      }
    });

    test("should preserve the selected profile when multiple profiles match git config", async () => {
      testRepo = await createTestGitRepo({
        userName: "Shared User",
        email: "shared@example.com",
      });

      const config = await configureWorkspace(
        [
          { id: "profile-1", label: "First", userName: "Shared User", email: "shared@example.com", signingKey: "" },
          { id: "profile-2", label: "Selected", userName: "Shared User", email: "shared@example.com", signingKey: "" },
        ],
        "profile-2"
      );

      const result = await getWorkspaceStatus();

      expect(result.selectedProfile?.id).toBe("profile-2");
      expect(config.get("workspaceProfileSelections")).toEqual({ [testRepo.path]: "profile-2" });
    });

    test("should auto-select the profile with a signing key when name and email are identical", async () => {
      const signingKey = "ssh-ed25519 AAAAC3NzaTestKey";
      testRepo = await createTestGitRepo({
        userName: "Shared User",
        email: "shared@example.com",
        signingKey,
      });

      const config = await configureWorkspace([
        { id: "without-key", label: "Without key", userName: "Shared User", email: "shared@example.com", signingKey: "" },
        { id: "with-key", label: "With key", userName: "Shared User", email: "shared@example.com", signingKey },
      ]);

      const result = await getWorkspaceStatus();

      expect(result.selectedProfile?.id).toBe("with-key");
      expect(config.get("workspaceProfileSelections")).toEqual({ [testRepo.path]: "with-key" });
    });

    test("should auto-select the profile without a signing key when name and email are identical", async () => {
      testRepo = await createTestGitRepo({
        userName: "Shared User",
        email: "shared@example.com",
      });

      const config = await configureWorkspace([
        { id: "with-key", label: "With key", userName: "Shared User", email: "shared@example.com", signingKey: "ssh-ed25519 AAAAC3NzaTestKey" },
        { id: "without-key", label: "Without key", userName: "Shared User", email: "shared@example.com", signingKey: "" },
      ]);

      const result = await getWorkspaceStatus();

      expect(result.selectedProfile?.id).toBe("without-key");
      expect(config.get("workspaceProfileSelections")).toEqual({ [testRepo.path]: "without-key" });
    });

    test("should auto-select the profile with the matching commit signing preference", async () => {
      testRepo = await createTestGitRepo({
        userName: "Shared User",
        email: "shared@example.com",
      });
      await testRepo.git.addConfig("commit.gpgsign", "false", false, "local");

      const config = await configureWorkspace([
        { id: "signing-enabled", label: "Signing enabled", userName: "Shared User", email: "shared@example.com", signingKey: "", commitGpgSign: true },
        { id: "signing-disabled", label: "Signing disabled", userName: "Shared User", email: "shared@example.com", signingKey: "", commitGpgSign: false },
      ]);

      const result = await getWorkspaceStatus();

      expect(result.selectedProfile?.id).toBe("signing-disabled");
      expect(config.get("workspaceProfileSelections")).toEqual({ [testRepo.path]: "signing-disabled" });
    });

    test("should silently remove legacy signing mode keys from profiles", async () => {
      testRepo = await createTestGitRepo({
        userName: "Shared User",
        email: "shared@example.com",
      });

      const config = await configureWorkspace([
        {
          id: "legacy-profile",
          label: "Legacy",
          userName: "Shared User",
          email: "shared@example.com",
          signingKey: "",
          signingKeyMode: "local",
          commitGpgSignMode: "local",
          gpgFormatMode: "local",
        },
      ]);

      await getWorkspaceStatus();

      const profiles = config.get("profiles") as Record<string, unknown>[];
      expect(profiles).toHaveLength(1);
      expect(profiles[0]).not.toHaveProperty("signingKeyMode");
      expect(profiles[0]).not.toHaveProperty("commitGpgSignMode");
      expect(profiles[0]).not.toHaveProperty("gpgFormatMode");
      expect(profiles[0]).toMatchObject({ id: "legacy-profile", label: "Legacy", userName: "Shared User", email: "shared@example.com", signingKey: "" });
    });

    test("should not rewrite profiles that have no legacy mode keys", async () => {
      testRepo = await createTestGitRepo({
        userName: "Shared User",
        email: "shared@example.com",
      });

      const cleanProfile = { id: "clean-profile", label: "Clean", userName: "Shared User", email: "shared@example.com", signingKey: "key-1" };
      const config = await configureWorkspace([cleanProfile]);

      await getWorkspaceStatus();

      expect(config.get("profiles")).toEqual([cleanProfile]);
    });
  });

  describe("Profile application", () => {
    let testRepo: TestRepo;

    afterEach(async () => {
      if (testRepo) {
        await testRepo.cleanup();
      }
    });

    test("should remove a stale signing key when applying an otherwise identical profile without one", async () => {
      testRepo = await createTestGitRepo({
        userName: "Shared User",
        email: "shared@example.com",
        signingKey: "ssh-ed25519 AAAAC3NzaOldKey",
      });

      await updateGitConfig(testRepo.path, {
        id: "without-key",
        label: "Without key",
        userName: "Shared User",
        email: "shared@example.com",
        signingKey: "",
      });

      expect(await getCurrentGitConfig(testRepo.path)).toEqual({
        userName: "Shared User",
        email: "shared@example.com",
        signingKey: "",
      });
    });

    test("should apply and read back a complete git config profile", async () => {
      testRepo = await createTestGitRepo();

      await updateGitConfig(testRepo.path, {
        id: "complete-profile",
        label: "Complete profile",
        userName: "Complete User",
        email: "complete@example.com",
        signingKey: "ssh-ed25519 AAAAC3NzaCompleteKey",
        commitGpgSign: true,
        gpgFormat: "ssh",
      });

      expect(await getCurrentGitConfig(testRepo.path)).toEqual({
        userName: "Complete User",
        email: "complete@example.com",
        signingKey: "ssh-ed25519 AAAAC3NzaCompleteKey",
        commitGpgSign: true,
        gpgFormat: "ssh",
      });
    });

    test("should restore inherited values by removing local keys that were previously absent", async () => {
      testRepo = await createTestGitRepo({
        userName: "Applied User",
        email: "applied@example.com",
        signingKey: "applied-key",
      });

      await restoreGitConfig(testRepo.path, {
        userName: "",
        email: "",
        signingKey: "",
      });

      expect(await getCurrentGitConfig(testRepo.path)).toEqual({
        userName: "",
        email: "",
        signingKey: "",
      });
    });

    test("should apply the selected commit signing preference", async () => {
      testRepo = await createTestGitRepo({
        userName: "Signing User",
        email: "signing@example.com",
      });

      await updateGitConfig(testRepo.path, {
        id: "signing-enabled",
        label: "Signing enabled",
        userName: "Signing User",
        email: "signing@example.com",
        signingKey: "",
        commitGpgSign: true,
      });

      expect((await getCurrentGitConfig(testRepo.path)).commitGpgSign).toBe(true);

      await updateGitConfig(testRepo.path, {
        id: "signing-disabled",
        label: "Signing disabled",
        userName: "Signing User",
        email: "signing@example.com",
        signingKey: "",
        commitGpgSign: false,
      });

      expect((await getCurrentGitConfig(testRepo.path)).commitGpgSign).toBe(false);
    });

    test("should clear signing configuration when applying a profile with signing disabled", async () => {
      testRepo = await createTestGitRepo({
        userName: "Signing User",
        email: "signing@example.com",
        signingKey: "stale-signing-key",
      });
      await simpleGit(testRepo.path).addConfig("commit.gpgsign", "true", false, "local");

      await updateGitConfig(testRepo.path, {
        id: "signing-disabled",
        label: "Signing disabled",
        userName: "Signing User",
        email: "signing@example.com",
        signingKey: "",
        commitGpgSign: false,
      });

      expect(await getCurrentGitConfig(testRepo.path)).toEqual({
        userName: "Signing User",
        email: "signing@example.com",
        signingKey: "",
        commitGpgSign: false,
      });
    });

    test("should remove the local commit signing preference when a profile uses the global setting", async () => {
      testRepo = await createTestGitRepo({
        userName: "Signing User",
        email: "signing@example.com",
      });

      await updateGitConfig(testRepo.path, {
        id: "global-signing",
        label: "Global signing",
        userName: "Signing User",
        email: "signing@example.com",
        signingKey: "",
      });

      expect((await getCurrentGitConfig(testRepo.path)).commitGpgSign).toBeUndefined();
    });

    test("should apply the selected gpg.format", async () => {
      testRepo = await createTestGitRepo({
        userName: "Signing User",
        email: "signing@example.com",
      });

      await updateGitConfig(testRepo.path, {
        id: "ssh-format",
        label: "SSH format",
        userName: "Signing User",
        email: "signing@example.com",
        signingKey: "",
        gpgFormat: "ssh",
      });

      expect((await getCurrentGitConfig(testRepo.path)).gpgFormat).toBe("ssh");

      await updateGitConfig(testRepo.path, {
        id: "openpgp-format",
        label: "OpenPGP format",
        userName: "Signing User",
        email: "signing@example.com",
        signingKey: "",
        gpgFormat: "openpgp",
      });

      expect((await getCurrentGitConfig(testRepo.path)).gpgFormat).toBe("openpgp");
    });

    test("should remove the local gpg.format when a profile uses the global setting", async () => {
      testRepo = await createTestGitRepo({
        userName: "Signing User",
        email: "signing@example.com",
      });
      await simpleGit(testRepo.path).addConfig("gpg.format", "ssh", false, "local");

      await updateGitConfig(testRepo.path, {
        id: "global-gpg-format",
        label: "Global gpg format",
        userName: "Signing User",
        email: "signing@example.com",
        signingKey: "",
      });

      expect((await getCurrentGitConfig(testRepo.path)).gpgFormat).toBeUndefined();
    });
  });

  describe("isGitRepository", () => {
    let testRepo: TestRepo;

    afterEach(async () => {
      if (testRepo) {
        await testRepo.cleanup();
      }
    });

    test("should return true for git repository root", async () => {
      testRepo = await createTestGitRepo();
      const isRepo = await isGitRepository(testRepo.path);
      expect(isRepo).toBe(true);
    });

    test("should return true for subfolder within git repository", async () => {
      testRepo = await createTestGitRepo();
      const subfolder = await createSubfolder(testRepo.path, "src/utils");
      const isRepo = await isGitRepository(subfolder);
      expect(isRepo).toBe(true);
    });

    test("should return false for non-git directory", async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "non-git-"));

      const isRepo = await isGitRepository(tmpDir);
      expect(isRepo).toBe(false);

      await fs.remove(tmpDir);
    });
  });

  describe("Edge Cases", () => {
    let testRepo: TestRepo;

    afterEach(async () => {
      if (testRepo) {
        await testRepo.cleanup();
      }
    });

    test("should handle deeply nested subfolders", async () => {
      testRepo = await createTestGitRepo({
        userName: "Test User",
        email: "test@example.com",
      });

      const deepPath = await createSubfolder(testRepo.path, "a/b/c/d/e/f/g");

      const gitRoot = await getGitRoot(deepPath);
      expect(gitRoot).toBe(testRepo.path);
    });

    test("should handle repository with no git config set", async () => {
      testRepo = await createTestGitRepo(); // No config provided

      const config = await getCurrentGitConfig(testRepo.path);

      expect(config).toEqual({
        userName: "",
        email: "",
        signingKey: "",
      });
    });

    test("should handle partial git config (only name and email)", async () => {
      testRepo = await createTestGitRepo({
        userName: "Test User",
        email: "test@example.com",
        // No signing key
      });

      const config = await getCurrentGitConfig(testRepo.path);

      expect(config).toEqual({
        userName: "Test User",
        email: "test@example.com",
        signingKey: "",
      });
    });
  });
});
