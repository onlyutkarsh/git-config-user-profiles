import { basename, sep } from "path";
import * as vscode from "vscode";
import * as constants from "../constants";
import { LogCategory } from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import * as gm from "../util/gitManager";
import { ICommand, Result } from "./ICommand";
import { applyProfileToWorkspace } from "./profileCommandActions";
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
      util.Logger.instance.logDebug(LogCategory.PICK_PROFILE, "Pick profile command started", {});

      const result = await gm.getWorkspaceStatus();

      if (!(await gm.validateWorkspace(result))) {
        util.Logger.instance.logDebug(LogCategory.PICK_PROFILE, "Workspace validation failed", {
          status: gm.WorkspaceStatus[result.status],
          message: result.message,
        });
        return {};
      }

      // validate workspace separately as not all commands needs a valid workspace (like edit/delete/create profile commands)
      // pick profile command needs a valid workspace as it attempts to apply the selected profile to the workspace
      if (result.status === gm.WorkspaceStatus.NotAValidWorkspace) {
        util.Logger.instance.logWarning("Invalid workspace for profile selection", {
          message: result.message,
        });
        vscode.window.showErrorMessage(result.message || constants.Messages.NOT_A_VALID_REPO);
        await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "invalid workspace");
        return {};
      }

      const workspaceFolder = result.currentFolder || "./";

      // Get the VSCode workspace folder URI for this git root
      // The git root should either be the workspace folder itself or within it
      const vscWorkspaceFolder = vscode.workspace.workspaceFolders?.find((wf) => {
        const gitRoot = workspaceFolder;
        const wsFolder = wf.uri.fsPath;
        // Git root equals workspace folder OR git root is within workspace folder
        return gitRoot === wsFolder || gitRoot.startsWith(wsFolder + sep);
      });

      // Use the git root folder as the key for storing the profile selection in user settings
      // This ensures each git repo can have its own profile selection
      const gitRootUri = vscode.Uri.file(workspaceFolder);

      util.Logger.instance.logDebug(LogCategory.PICK_PROFILE, "Workspace folder resolution", {
        gitRoot: workspaceFolder,
        gitRootBasename: basename(workspaceFolder),
        vscWorkspaceFolderFound: !!vscWorkspaceFolder,
        vscWorkspaceFolderPath: vscWorkspaceFolder?.uri.fsPath,
        gitRootUri: gitRootUri.fsPath,
        allWorkspaceFolders: vscode.workspace.workspaceFolders?.map((wf) => wf.uri.fsPath),
      });

      const pickerResponse = await util.showProfilePicker({
        selectedProfileId: result.selectedProfile?.id,
        includeActions: true,
      });

      if (pickerResponse.actionId) {
        if (pickerResponse.actionId === util.PROFILE_PICKER_ACTION_CREATE) {
          util.Logger.instance.logDebug(LogCategory.PICK_PROFILE, "User chose to create a new profile from picker", {});
          await vscode.commands.executeCommand(constants.CommandIds.CREATE_USER_PROFILE);
          return { result: undefined };
        }
        if (pickerResponse.actionId === util.PROFILE_PICKER_ACTION_EDIT) {
          util.Logger.instance.logDebug(LogCategory.PICK_PROFILE, "User chose to edit a profile from picker", {});
          await vscode.commands.executeCommand(constants.CommandIds.EDIT_USER_PROFILE);
          return { result: undefined };
        }
        if (pickerResponse.actionId === util.PROFILE_PICKER_ACTION_DELETE) {
          util.Logger.instance.logDebug(LogCategory.PICK_PROFILE, "User chose to delete a profile from picker", {});
          await vscode.commands.executeCommand(constants.CommandIds.DELETE_USER_PROFILE);
          return { result: undefined };
        }
      }

      const pickedProfile = pickerResponse.result as Profile;
      if (pickedProfile) {
        util.Logger.instance.logDebug(LogCategory.PICK_PROFILE, "User selected profile", {
          profileLabel: pickedProfile.label,
          profileId: pickedProfile.id,
          userName: pickedProfile.userName,
          email: pickedProfile.email,
          workspaceFolder: basename(workspaceFolder),
        });

        const applyResult = await applyProfileToWorkspace(pickedProfile);
        if (applyResult.error || !applyResult.result) {
          return { result: undefined, error: applyResult.error };
        }

        // Refresh the status bar with the new in-sync state, then confirm via a transient
        // status bar message - no modal, so focus stays put
        await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "applied profile");
        vscode.window.setStatusBarMessage(`$(check) Profile '${util.trimLabelIcons(pickedProfile.label)}' is now applied for '${applyResult.message}'`, 3000);
        return { result: pickedProfile };
      }
      util.Logger.instance.logDebug(LogCategory.PICK_PROFILE, "User cancelled profile selection", {});
      return { result: undefined };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      util.Logger.instance.logError(`Error occurred while picking profile. ${errorMessage}`, error as Error);
      vscode.window.showErrorMessage(`Error occurred while picking profile: ${errorMessage}`);
      return { result: undefined, error: error as Error };
    }
  }
}
