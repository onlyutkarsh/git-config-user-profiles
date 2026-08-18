import * as vscode from "vscode";
import { CreateUserProfileCommand } from "../../src/commands/CreateUserProfileCommand";
import * as profileUi from "../../src/controls/profileUi";
import * as gm from "../../src/util/gitManager";

jest.mock("../../src/controls/profileUi", () => ({
  showProfileForm: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/util/gitManager", () => ({
  getWorkspaceStatus: jest.fn(),
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

describe("CreateUserProfileCommand UI entry", () => {
  const mockGetWorkspaceStatus = gm.getWorkspaceStatus as jest.Mock;
  const mockShowProfileForm = profileUi.showProfileForm as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    (vscode.workspace as any)._clearMockConfigurations();
    await vscode.workspace.getConfiguration("gitConfigUser").update("useUIToEdit", true);
  });

  test("opens a blank create form even when a workspace profile is selected", async () => {
    const selectedProfile = { id: "github", label: "GitHub", userName: "UTK", email: "gh@example.com", signingKey: "" };
    mockGetWorkspaceStatus.mockResolvedValue({ selectedProfile, currentFolder: "/repos/current" });

    await new CreateUserProfileCommand().execute();

    expect(mockShowProfileForm).toHaveBeenCalledWith(undefined, expect.any(Array), expect.any(Function), expect.any(Function), undefined, expect.any(Object), "/repos/current");
  });
});
