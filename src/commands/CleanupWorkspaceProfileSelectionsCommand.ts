import * as vscode from "vscode";
import * as util from "../util";
import { ICommand, Result } from "./ICommand";

export class CleanupWorkspaceProfileSelectionsCommand implements ICommand<number> {
  async execute(): Promise<Result<number>> {
    try {
      const removedCount = await util.cleanupStaleWorkspaceProfileSelections();
      const message =
        removedCount === 0 ? "No stale workspace profile selections found." : `Removed ${removedCount} stale workspace profile selection${removedCount === 1 ? "" : "s"}.`;

      util.Logger.instance.logInfo(message);
      await vscode.window.showInformationMessage(message);
      return { result: removedCount };
    } catch (error) {
      util.Logger.instance.logError("Failed to clean up stale workspace profile selections", error as Error);
      await vscode.window.showErrorMessage("Failed to clean up stale workspace profile selections. See logs for details.");
      return { result: 0, error: error as Error };
    }
  }
}
