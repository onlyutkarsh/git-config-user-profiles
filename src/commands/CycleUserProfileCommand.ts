import * as vscode from "vscode";
import { getProfilesInSettings, getSelectedProfileId } from "../config";
import * as constants from "../constants";
import { LogCategory } from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import * as gm from "../util/gitManager";
import { ICommand, Result } from "./ICommand";
import { applyProfileToWorkspace } from "./profileCommandActions";

/**
 * Switches the current repository to the next profile in the list, wrapping around
 * at the end. Intended to be bound to a key for quick profile switching without
 * opening a picker.
 */
export class CycleUserProfileCommand implements ICommand<Profile> {
  async execute(): Promise<Result<Profile>> {
    try {
      util.Logger.instance.logDebug(LogCategory.PICK_PROFILE, "Cycle profile command started", {});

      const result = await gm.getWorkspaceStatus();

      if (!(await gm.validateWorkspace(result))) {
        util.Logger.instance.logDebug(LogCategory.PICK_PROFILE, "Workspace validation failed", {
          status: gm.WorkspaceStatus[result.status],
          message: result.message,
        });
        return {};
      }

      if (result.status === gm.WorkspaceStatus.NotAValidWorkspace) {
        util.Logger.instance.logWarning("Invalid workspace for profile cycling", {
          message: result.message,
        });
        vscode.window.showErrorMessage(result.message || constants.Messages.NOT_A_VALID_REPO);
        await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "invalid workspace");
        return {};
      }

      const workspaceFolder = result.currentFolder || "./";
      const profiles = getProfilesInSettings();

      if (profiles.length === 0) {
        const createAction = "Create Profile";
        const selection = await vscode.window.showInformationMessage("No profiles defined yet. Create a profile to start switching.", createAction);
        if (selection === createAction) {
          await vscode.commands.executeCommand(constants.CommandIds.CREATE_USER_PROFILE);
        }
        return {};
      }

      if (profiles.length === 1) {
        await vscode.window.showInformationMessage(`Only one profile ('${profiles[0].label}') is defined. Create another profile to cycle between them.`);
        return {};
      }

      const gitRootUri = vscode.Uri.file(workspaceFolder);
      const selectedProfileId = getSelectedProfileId(gitRootUri);
      const currentIndex = profiles.findIndex((p) => (p.id ? p.id === selectedProfileId : p.label.toLowerCase() === (selectedProfileId || "").toLowerCase()));
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % profiles.length;
      const nextProfile = profiles[nextIndex];

      util.Logger.instance.logDebug(LogCategory.PICK_PROFILE, "Cycling to next profile", {
        currentProfileId: selectedProfileId,
        currentIndex,
        nextIndex,
        nextProfileLabel: nextProfile.label,
        totalProfiles: profiles.length,
      });

      const profileToApply: Profile = Object.assign({}, nextProfile, { detail: undefined, selected: true });
      const applyResult = await applyProfileToWorkspace(profileToApply);
      if (applyResult.error || !applyResult.result) {
        return { result: undefined, error: applyResult.error };
      }

      vscode.window.setStatusBarMessage(`$(check) Switched to profile '${nextProfile.label}' for '${applyResult.message}'`, 3000);
      return { result: applyResult.result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      util.Logger.instance.logError(`Error occurred while cycling profile. ${errorMessage}`, error as Error);
      vscode.window.showErrorMessage(`Error occurred while cycling profile: ${errorMessage}`);
      return { result: undefined, error: error as Error };
    }
  }
}
