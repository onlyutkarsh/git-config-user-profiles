import * as vscode from "vscode";
import { CycleUserProfileCommand } from "../../src/commands/CycleUserProfileCommand";
import { getProfilesInSettings, getSelectedProfileId, saveVscProfile } from "../../src/config";
import * as gm from "../../src/util/gitManager";

jest.mock("../../src/config", () => ({
  getProfilesInSettings: jest.fn(),
  getSelectedProfileId: jest.fn(),
  saveVscProfile: jest.fn(),
}));

jest.mock("../../src/util", () => ({
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

describe("CycleUserProfileCommand", () => {
  const previousGitConfig = {
    userName: "Previous User",
    email: "previous@example.com",
    signingKey: "previous-key",
  };
  const workProfile = {
    id: "profile-work",
    label: "Work",
    userName: "Work User",
    email: "work@example.com",
    signingKey: "",
  };
  const personalProfile = {
    id: "profile-personal",
    label: "Personal",
    userName: "Personal User",
    email: "personal@example.com",
    signingKey: "",
  };
  const profiles = [workProfile, personalProfile];

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
    (gm.updateGitConfig as jest.Mock).mockResolvedValue(undefined);
    (gm.restoreGitConfig as jest.Mock).mockResolvedValue(undefined);
    (saveVscProfile as jest.Mock).mockResolvedValue(undefined);
    (getProfilesInSettings as jest.Mock).mockReturnValue(profiles);
    (getSelectedProfileId as jest.Mock).mockReturnValue(workProfile.id);
  });

  test("applies the next profile after the currently selected one", async () => {
    const result = await new CycleUserProfileCommand().execute();

    expect(gm.updateGitConfig).toHaveBeenCalledWith("/repo", expect.objectContaining({ id: personalProfile.id }));
    expect(saveVscProfile).toHaveBeenCalledWith(expect.objectContaining({ id: personalProfile.id }), undefined, expect.objectContaining({ fsPath: "/repo" }));
    expect(vscode.window.setStatusBarMessage).toHaveBeenCalledWith(expect.stringContaining("Personal"), 3000);
    expect(result.result?.id).toBe(personalProfile.id);
  });

  test("wraps around to the first profile when the last one is selected", async () => {
    (getSelectedProfileId as jest.Mock).mockReturnValue(personalProfile.id);

    const result = await new CycleUserProfileCommand().execute();

    expect(gm.updateGitConfig).toHaveBeenCalledWith("/repo", expect.objectContaining({ id: workProfile.id }));
    expect(result.result?.id).toBe(workProfile.id);
  });

  test("starts with the first profile when no profile is selected", async () => {
    (getSelectedProfileId as jest.Mock).mockReturnValue(undefined);

    const result = await new CycleUserProfileCommand().execute();

    expect(gm.updateGitConfig).toHaveBeenCalledWith("/repo", expect.objectContaining({ id: workProfile.id }));
    expect(result.result?.id).toBe(workProfile.id);
  });

  test("does nothing when workspace validation fails", async () => {
    (gm.validateWorkspace as jest.Mock).mockResolvedValue(false);

    const result = await new CycleUserProfileCommand().execute();

    expect(gm.updateGitConfig).not.toHaveBeenCalled();
    expect(saveVscProfile).not.toHaveBeenCalled();
    expect(result.result).toBeUndefined();
  });

  test("shows an error when the workspace is not a valid git repository", async () => {
    (gm.getWorkspaceStatus as jest.Mock).mockResolvedValue({
      status: gm.WorkspaceStatus.NotAValidWorkspace,
      message: "not a repo",
      currentFolder: "/repo",
    });

    const result = await new CycleUserProfileCommand().execute();

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("not a repo");
    expect(gm.updateGitConfig).not.toHaveBeenCalled();
    expect(result.result).toBeUndefined();
  });

  test("offers to create a profile when none are defined", async () => {
    (getProfilesInSettings as jest.Mock).mockReturnValue([]);
    (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue("Create Profile");

    const result = await new CycleUserProfileCommand().execute();

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining("No profiles defined"), "Create Profile");
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith("git-config-user-profiles.createUserProfile");
    expect(gm.updateGitConfig).not.toHaveBeenCalled();
    expect(result.result).toBeUndefined();
  });

  test("shows a message when only one profile is defined", async () => {
    (getProfilesInSettings as jest.Mock).mockReturnValue([workProfile]);

    const result = await new CycleUserProfileCommand().execute();

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining("Only one profile"));
    expect(gm.updateGitConfig).not.toHaveBeenCalled();
    expect(result.result).toBeUndefined();
  });

  test("does not persist selection when updating git config fails", async () => {
    const gitError = new Error("git config failed");
    (gm.updateGitConfig as jest.Mock).mockRejectedValue(gitError);

    const result = await new CycleUserProfileCommand().execute();

    expect(saveVscProfile).not.toHaveBeenCalled();
    expect(gm.restoreGitConfig).toHaveBeenCalledWith("/repo", previousGitConfig);
    expect(result.error).toBe(gitError);
  });

  test("restores the previous git config when persisting selection fails", async () => {
    const settingsError = new Error("settings update failed");
    (saveVscProfile as jest.Mock).mockRejectedValue(settingsError);

    const result = await new CycleUserProfileCommand().execute();

    expect(gm.updateGitConfig).toHaveBeenCalledTimes(1);
    expect(gm.restoreGitConfig).toHaveBeenCalledWith("/repo", previousGitConfig);
    expect(gm.invalidateWorkspaceStatusCache).toHaveBeenCalled();
    expect(result.error).toBe(settingsError);
  });
});
