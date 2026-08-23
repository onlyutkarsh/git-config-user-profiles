import * as vscode from "vscode";
import * as constants from "../constants";
import { LogCategory } from "../constants";
import { Logger } from "../util";
import * as gm from "../util/gitManager";
import { ICommand, Result } from "./ICommand";

export class StatusBarClickCommand implements ICommand<void> {
  async execute(): Promise<Result<void>> {
    Logger.instance.logDebug(LogCategory.STATUS_BAR, "Click event on status bar icon");
    const result = await gm.getWorkspaceStatus();

    Logger.instance.logDebug(LogCategory.STATUS_BAR, "Workspace status retrieved", {
      status: gm.WorkspaceStatus[result.status],
      configInSync: result.configInSync,
      currentFolder: result.currentFolder,
    });

    // Handle non-git workspace case - show helpful message
    if (result.status === gm.WorkspaceStatus.NotAValidWorkspace) {
      const message = result.message || "This is not a valid git repository.";
      vscode.window.showWarningMessage(message);
      Logger.instance.logDebug(LogCategory.STATUS_BAR, "User clicked status bar in non-git workspace", {
        message: result.message,
      });
      return {};
    }

    if (!(await gm.validateWorkspace(result))) {
      return {};
    }

    await vscode.commands.executeCommand(constants.CommandIds.PICK_USER_PROFILE);
    return {};
  }
}
