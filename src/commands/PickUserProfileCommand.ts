import { basename } from "path";
import * as vscode from "vscode";
import { saveVscProfile } from "../config";
import * as constants from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import * as gm from "../util/gitManager";
import { ICommand, Result } from "./ICommand";
export class PickUserProfileCommand implements ICommand<Profile> {
  private static instance: PickUserProfileCommand | null = null;

  public static Instance(): PickUserProfileCommand {
    if (this.instance === null) {
      this.instance = new PickUserProfileCommand();
    }
    return this.instance;
  }

  async execute(): Promise<Result<Profile>> {
    try {
      util.Logger.instance.logDebug("PickProfile", "Pick profile command started", {});

      const result = await gm.getWorkspaceStatus();

      if (!(await gm.validateWorkspace(result))) {
        util.Logger.instance.logDebug("PickProfile", "Workspace validation failed", {
          status: gm.WorkspaceStatus[result.status],
          message: result.message
        });
        return {};
      }

      // validate workspace separately as not all commands needs a valid workspace (like edit/delete/create profile commands)
      // pick profile command needs a valid workspace as it attempts to apply the selected profile to the workspace
      if (result.status === gm.WorkspaceStatus.NotAValidWorkspace) {
        util.Logger.instance.logWarning("Invalid workspace for profile selection", {
          message: result.message
        });
        vscode.window.showErrorMessage(result.message || constants.Messages.NOT_A_VALID_REPO);
        await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "invalid workspace");
        return {};
      }

      const workspaceFolder = result.currentFolder || ".\\";
      const pickedProfileRaw = await util.showProfilePicker();
      const pickedProfile = pickedProfileRaw.result as Profile;
      if (pickedProfile) {
        util.Logger.instance.logDebug("PickProfile", "User selected profile", {
          profileLabel: pickedProfile.label,
          profileId: pickedProfile.id,
          userName: pickedProfile.userName,
          email: pickedProfile.email,
          workspaceFolder: basename(workspaceFolder)
        });

        // user might have switched to different file after showing the picker. so need to check again
        if (!gm.validateWorkspace(result)) {
          return {};
        }
        pickedProfile.detail = undefined;
        pickedProfile.label = pickedProfile.label;
        pickedProfile.selected = true;
        await saveVscProfile(Object.assign({}, pickedProfile));
        gm.updateGitConfig(workspaceFolder, pickedProfile);

        // Invalidate cache after updating git config
        gm.invalidateWorkspaceStatusCache();
        await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "picked profile");

        util.Logger.instance.logInfo(`Profile '${pickedProfile.label}' applied successfully to '${basename(workspaceFolder)}'`);
        await vscode.window.showInformationMessage(`Profile '${pickedProfile.label}' is now applied for '${basename(workspaceFolder)}'. 🎉`);
        return { result: pickedProfile };
      }
      util.Logger.instance.logDebug("PickProfile", "User cancelled profile selection", {});
      return { result: undefined };
    } catch (error) {
      util.Logger.instance.logError(`Error occurred while picking profile. ${error}`);
      vscode.window.showErrorMessage(`Error occurred while picking profile.`);
      return { result: undefined, error: error as Error };
    }
  }
}
