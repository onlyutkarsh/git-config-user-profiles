import { basename } from "path";
import * as vscode from "vscode";
import * as constants from "../constants";
import { LogCategory } from "../constants";
import * as util from "../util";
import { Logger } from "../util";
import * as gm from "../util/gitManager";
import { EditUserProfileCommand } from "./EditUserProfileCommand";
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

    const workspaceFolder = result.currentFolder || ".\\";
    const repositoryName = basename(workspaceFolder);
    let response;
    if (result.status === gm.WorkspaceStatus.NoSelectedProfilesInConfig) {
      response = await vscode.window.showInformationMessage(
        `You have ${result.profilesInVSConfigCount} profile(s) in settings, but none are selected. What do you want to do?`,
        "Pick a profile",
        "Edit existing",
        "Create new"
      );
    } else {
      if (result.selectedProfile === undefined) {
        //this should never happen
        Logger.instance.logError("Selected profile is undefined");
        return {};
      }

      const notSyncOptions = ["Yes, apply", "No, pick another", "Edit existing", "Create new"];
      const syncOptions = ["Pick a profile", "Edit existing", "Create new"];

      const notSyncMessage = `'${repositoryName}' is not using user details from '${util.trimLabelIcons(result.selectedProfile!.label)}' profile. Do you want to apply the user details from profile '${util.trimLabelIcons(result.selectedProfile!.label)}'?`;

      const syncMessage = `'${repositoryName}' is already using user details from the profile '${util.trimLabelIcons(result.selectedProfile!.label)}'. What do you want to do?`;

      const options = result.configInSync ? syncOptions : notSyncOptions;
      const message = result.configInSync ? syncMessage : notSyncMessage;

      Logger.instance.logDebug(LogCategory.STATUS_BAR, "Showing options to user", {
        options: options,
        configInSync: result.configInSync,
      });
      response = await vscode.window.showInformationMessage(message, ...options);
    }

    if (response === undefined) {
      Logger.instance.logDebug(LogCategory.STATUS_BAR, "User cancelled prompt");
      await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "user cancelled prompt");
      return {};
    }

    Logger.instance.logDebug(LogCategory.STATUS_BAR, "User selected option", { selectedOption: response });
    if (response === "Edit existing") {
      await EditUserProfileCommand.Instance().execute();
      await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "edit profile");
      return {};
    }
    if (response === "Yes, apply" || response === "Apply again") {
      try {
        await gm.updateGitConfig(workspaceFolder, result.selectedProfile!);
      } catch (error) {
        const message = `Failed to apply profile '${result.selectedProfile!.label}'. See logs for details.`;
        Logger.instance.logError("Failed to update git config from status bar action", error as Error);
        vscode.window.showErrorMessage(message);
        return { error: error as Error };
      }
      await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "applied profile");
      await vscode.window.showInformationMessage(`Profile '${result.selectedProfile!.label}' is now applied for '${repositoryName}'. 🎉`, "OK");
      return {};
    }
    if (response === "Create new") {
      await vscode.commands.executeCommand(constants.CommandIds.CREATE_USER_PROFILE);
      await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "created new profile");
      return {};
    }
    if (response === "No, pick another" || response === "Pick a profile") {
      await vscode.commands.executeCommand(constants.CommandIds.PICK_USER_PROFILE);
    }
    return {};
  }
}
