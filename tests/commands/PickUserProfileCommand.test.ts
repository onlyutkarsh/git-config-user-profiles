import * as vscode from "vscode";
import { PickUserProfileCommand } from "../../src/commands/PickUserProfileCommand";
import { saveVscProfile } from "../../src/config";
import * as util from "../../src/util";
import * as gm from "../../src/util/gitManager";

jest.mock("../../src/config", () => ({
  saveVscProfile: jest.fn(),
}));

jest.mock("../../src/util", () => ({
  showProfilePicker: jest.fn(),
  Logger: {
    instance: {
      logTrace: jest.fn(),
      logDebug: jest.fn(),
      logInfo: jest.fn(),
      logWarning: jest.fn(),
      logError: jest.fn(),
    },
  },
}));

jest.mock("../../src/util/gitManager", () => ({
  getWorkspaceStatus: jest.fn(),
  getCurrentGitConfig: jest.fn(),
  validateWorkspace: jest.fn(),
  updateGitConfig: jest.fn(),
  restoreGitConfig: jest.fn(),
  invalidateWorkspaceStatusCache: jest.fn(),
  WorkspaceStatus: {
    ConfigOutofSync: 0,
    FieldsMissing: 1,
    NoProfilesInConfig: 2,
    NoSelectedProfilesInConfig: 3,
    NotAValidWorkspace: 4,
    NoIssues: 5,
  },
}));

describe("PickUserProfileCommand", () => {
  const previousGitConfig = {
    userName: "Previous User",
    email: "previous@example.com",
    signingKey: "previous-key",
  };
  const profile = {
    id: "profile-1",
    label: "Work",
    userName: "Work User",
    email: "work@example.com",
    signingKey: "",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (vscode.workspace as any).workspaceFolders = [{ uri: vscode.Uri.file("/repo"), name: "repo", index: 0 }];
    (gm.getWorkspaceStatus as jest.Mock).mockResolvedValue({
      status: gm.WorkspaceStatus.NoIssues,
      currentFolder: "/repo",
      currentGitConfig: previousGitConfig,
    });
    (gm.getCurrentGitConfig as jest.Mock).mockResolvedValue(previousGitConfig);
    (gm.validateWorkspace as jest.Mock).mockResolvedValue(true);
    (util.showProfilePicker as jest.Mock).mockResolvedValue({ result: { ...profile } });
    (gm.updateGitConfig as jest.Mock).mockResolvedValue(undefined);
    (gm.restoreGitConfig as jest.Mock).mockResolvedValue(undefined);
    (saveVscProfile as jest.Mock).mockResolvedValue(undefined);
  });

  test("does not persist selection when updating git config fails", async () => {
    const gitError = new Error("git config failed");
    (gm.updateGitConfig as jest.Mock).mockRejectedValue(gitError);

    const result = await new PickUserProfileCommand().execute();

    expect(saveVscProfile).not.toHaveBeenCalled();
    expect(gm.restoreGitConfig).toHaveBeenCalledWith("/repo", previousGitConfig);
    expect(result.error).toBe(gitError);
  });

  test("persists selection after updating git config succeeds", async () => {
    await new PickUserProfileCommand().execute();

    expect(gm.updateGitConfig).toHaveBeenCalledWith("/repo", expect.objectContaining(profile));
    expect(saveVscProfile).toHaveBeenCalledWith(expect.objectContaining(profile), undefined, expect.objectContaining({ fsPath: "/repo" }));
    expect((gm.updateGitConfig as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((saveVscProfile as jest.Mock).mock.invocationCallOrder[0]);
  });

  test("restores the previous git config when persisting selection fails", async () => {
    const settingsError = new Error("settings update failed");
    (saveVscProfile as jest.Mock).mockRejectedValue(settingsError);

    const result = await new PickUserProfileCommand().execute();

    expect(gm.updateGitConfig).toHaveBeenCalledTimes(1);
    expect(gm.updateGitConfig).toHaveBeenCalledWith("/repo", expect.objectContaining(profile));
    expect(gm.restoreGitConfig).toHaveBeenCalledWith("/repo", previousGitConfig);
    expect(gm.invalidateWorkspaceStatusCache).toHaveBeenCalled();
    expect(result.error).toBe(settingsError);
  });

  test("reports rollback failure without replacing the persistence error", async () => {
    const settingsError = new Error("settings update failed");
    const rollbackError = new Error("rollback failed");
    (saveVscProfile as jest.Mock).mockRejectedValue(settingsError);
    (gm.restoreGitConfig as jest.Mock).mockRejectedValue(rollbackError);

    const result = await new PickUserProfileCommand().execute();

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to save profile selection and restore previous Git config. See logs for details.");
    expect(result.error).toBe(settingsError);
  });
});
