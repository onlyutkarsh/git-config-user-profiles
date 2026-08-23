import * as vscode from "vscode";
import { EditUserProfileCommand } from "../../src/commands/EditUserProfileCommand";
import * as profileUi from "../../src/controls/profileUi";
import * as util from "../../src/util";
import * as gm from "../../src/util/gitManager";

jest.mock("../../src/controls/profileUi", () => ({
  showProfileForm: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/util", () => ({
  showProfilePicker: jest.fn(),
  Logger: {
    instance: {
      logDebug: jest.fn(),
      logInfo: jest.fn(),
      logError: jest.fn(),
    },
  },
  trimLabelIcons: (value: string) => value,
  PROFILE_PICKER_ACTION_GO_BACK: "go-back",
}));

jest.mock("../../src/util/gitManager", () => ({
  getWorkspaceStatus: jest.fn(),
  validateWorkspace: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../src/util/logger", () => ({
  Logger: {
    instance: {
      logDebug: jest.fn(),
      logInfo: jest.fn(),
      logError: jest.fn(),
    },
  },
}));

describe("EditUserProfileCommand UI entry", () => {
  const mockGetWorkspaceStatus = gm.getWorkspaceStatus as jest.Mock;
  const mockShowProfileForm = profileUi.showProfileForm as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    (vscode.workspace as any)._clearMockConfigurations();
    await vscode.workspace.getConfiguration("gitConfigUser").update("useUIToEdit", true);
  });

  test("opens the currently selected workspace profile", async () => {
    const profile = { id: "work", label: "Work", userName: "Work User", email: "work@example.com", signingKey: "" };
    mockGetWorkspaceStatus.mockResolvedValue({ selectedProfile: profile, currentFolder: "/repos/work" });

    await new EditUserProfileCommand().execute();

    expect(mockShowProfileForm).toHaveBeenCalledWith(profile, expect.any(Array), expect.any(Function), expect.any(Function), "work", expect.any(Object), "/repos/work");
  });

  test("opens a create form when no workspace profile is selected", async () => {
    mockGetWorkspaceStatus.mockResolvedValue({ selectedProfile: undefined, currentFolder: "/repos/work" });

    await new EditUserProfileCommand().execute();

    expect(mockShowProfileForm).toHaveBeenCalledWith(undefined, expect.any(Array), expect.any(Function), expect.any(Function), undefined, expect.any(Object), "/repos/work");
  });

  test("shows a standardized back action when editing a selected profile", async () => {
    const profile = { id: "work", label: "Work", userName: "Work User", email: "work@example.com", signingKey: "" };
    (util.showProfilePicker as jest.Mock).mockResolvedValue({ actionId: "go-back" });
    mockGetWorkspaceStatus.mockResolvedValue({ selectedProfile: profile, currentFolder: "/repos/work" });
    await vscode.workspace.getConfiguration("gitConfigUser").update("useUIToEdit", false);

    await new EditUserProfileCommand().execute();

    expect(util.showProfilePicker).toHaveBeenCalledWith({
      includeGoBack: true,
      selectedProfileId: "work",
      placeHolder: "Select a profile to edit.",
    });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith("git-config-user-profiles.pickUserProfile");
  });
});
