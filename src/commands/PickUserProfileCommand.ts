import { basename, sep } from "path";
import * as vscode from "vscode";
import { saveVscProfile } from "../config";
import * as constants from "../constants";
import { LogCategory } from "../constants";
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

      const pickedProfileRaw = await util.showProfilePicker();
      const pickedProfile = pickedProfileRaw.result as Profile;
      if (pickedProfile) {
        util.Logger.instance.logDebug(LogCategory.PICK_PROFILE, "User selected profile", {
          profileLabel: pickedProfile.label,
          profileId: pickedProfile.id,
          userName: pickedProfile.userName,
          email: pickedProfile.email,
          workspaceFolder: basename(workspaceFolder),
        });

        // Re-evaluate workspace after picker closes to avoid stale state (e.g., user changed active editor during picker)
        const refreshedStatus = await gm.getWorkspaceStatus();
        if (!(await gm.validateWorkspace(refreshedStatus))) {
          util.Logger.instance.logWarning("Workspace validation failed after picker closed", {
            status: gm.WorkspaceStatus[refreshedStatus.status],
            message: refreshedStatus.message,
          });
          return {};
        }

        const refreshedFolder = refreshedStatus.currentFolder;
        if (!refreshedFolder) {
          util.Logger.instance.logWarning("No active workspace folder after picker selection", {});
          return {};
        }

        const refreshedGitRootUri = vscode.Uri.file(refreshedFolder);
        const refreshedRepoName = basename(refreshedFolder);
        pickedProfile.detail = undefined;
        pickedProfile.label = pickedProfile.label;
        pickedProfile.selected = true;
        // Save profile selection to user settings (not workspace settings)
        await saveVscProfile(Object.assign({}, pickedProfile), undefined, refreshedGitRootUri);
        try {
          await gm.updateGitConfig(refreshedFolder, pickedProfile);
        } catch (error) {
          util.Logger.instance.logError("Failed to update git config with selected profile", error as Error);
          vscode.window.showErrorMessage(`Failed to apply profile '${pickedProfile.label}'. See logs for details.`);
          return { result: undefined, error: error as Error };
        }

        // Invalidate cache after updating git config
        gm.invalidateWorkspaceStatusCache();
        await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "picked profile");

        util.Logger.instance.logInfo(`Profile '${pickedProfile.label}' applied successfully to '${refreshedRepoName}'`);
        await vscode.window.showInformationMessage(`Profile '${pickedProfile.label}' is now applied for '${refreshedRepoName}'. 🎉`, "OK");
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
