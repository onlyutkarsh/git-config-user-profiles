import * as vscode from "vscode";
import * as controls from "../../src/controls";
import { createProfileWithWizard } from "../../src/util/utils";

jest.mock("../../src/controls", () => ({
  MultiStepInput: {
    run: jest.fn(),
  },
}));

jest.mock("../../src/util/gitManager", () => ({
  getGlobalGitConfig: jest.fn().mockResolvedValue({}),
}));

describe("createProfileWithWizard", () => {
  const mockRun = controls.MultiStepInput.run as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("enables the back button from the first wizard step", async () => {
    mockRun.mockResolvedValue({ wentBackFromFirstStep: false });

    await createProfileWithWizard();

    expect(mockRun).toHaveBeenCalledWith(expect.any(Function), { showBackOnFirstStep: true });
  });

  test("returns to the profile picker when the user goes back from the first step", async () => {
    mockRun.mockResolvedValue({ wentBackFromFirstStep: true });

    const profile = await createProfileWithWizard();

    expect(profile).toBeUndefined();
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith("git-config-user-profiles.pickUserProfile");
  });
});
