import * as vscode from "vscode";
import { CleanupWorkspaceProfileSelectionsCommand } from "../../src/commands/CleanupWorkspaceProfileSelectionsCommand";
import * as util from "../../src/util";

jest.mock("../../src/util", () => ({
  cleanupStaleWorkspaceProfileSelections: jest.fn(),
  Logger: {
    instance: {
      logInfo: jest.fn(),
      logError: jest.fn(),
    },
  },
}));

describe("CleanupWorkspaceProfileSelectionsCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("reports the number of removed stale selections", async () => {
    (util.cleanupStaleWorkspaceProfileSelections as jest.Mock).mockResolvedValue(2);

    const result = await new CleanupWorkspaceProfileSelectionsCommand().execute();

    expect(result).toEqual({ result: 2 });
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("Removed 2 stale workspace profile selections.");
  });

  test("reports when no stale selections are found", async () => {
    (util.cleanupStaleWorkspaceProfileSelections as jest.Mock).mockResolvedValue(0);

    await new CleanupWorkspaceProfileSelectionsCommand().execute();

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("No stale workspace profile selections found.");
  });
});
