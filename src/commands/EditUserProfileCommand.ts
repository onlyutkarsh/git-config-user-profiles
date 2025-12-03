import * as vscode from "vscode";
import { saveVscProfile } from "../config";
import * as constants from "../constants";
import { LogCategory } from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import * as gm from "../util/gitManager";
import { ICommand, Result } from "./ICommand";
export class EditUserProfileCommand implements ICommand<boolean> {
  private static instance: EditUserProfileCommand | null = null;

  public static Instance(): EditUserProfileCommand {
    if (this.instance === null) {
      this.instance = new EditUserProfileCommand();
    }
    return this.instance;
  }

  async execute(): Promise<Result<boolean>> {
    try {
      util.Logger.instance.logDebug(LogCategory.EDIT_PROFILE, "Edit profile command started", {});

      const result = await gm.getWorkspaceStatus();

      if (!(await gm.validateWorkspace(result))) {
        return {};
      }

      const pickedProfile = await util.showProfilePicker();
      const selectedProfile = pickedProfile.result as Profile;
      if (selectedProfile) {
        util.Logger.instance.logDebug(LogCategory.EDIT_PROFILE, "Profile selected for editing", {
          profileLabel: selectedProfile.label,
          profileId: selectedProfile.id
        });

        selectedProfile.detail = undefined;
        selectedProfile.label = selectedProfile.label;

        const result = await util.loadProfileInWizard(selectedProfile);
        const updatedProfile = result as Profile;
        if (updatedProfile) {
          util.Logger.instance.logDebug(LogCategory.EDIT_PROFILE, "Profile updated", {
            profileLabel: updatedProfile.label,
            profileId: updatedProfile.id,
            userName: updatedProfile.userName,
            email: updatedProfile.email
          });

          if (updatedProfile.id) {
            await saveVscProfile(updatedProfile, updatedProfile.id);
          } else {
            await saveVscProfile(updatedProfile, updatedProfile.label);
          }
          util.Logger.instance.logInfo(`Profile '${updatedProfile.label}' updated successfully`);
          vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "edited profile");
        } else {
          util.Logger.instance.logDebug(LogCategory.EDIT_PROFILE, "User cancelled profile update", {});
        }
      } else {
        util.Logger.instance.logDebug(LogCategory.EDIT_PROFILE, "User cancelled profile selection", {});
      }
      return { result: true };
    } catch (error) {
      util.Logger.instance.logError(`Error occurred while editing profile. ${error}`);
      vscode.window.showErrorMessage(`Error occurred while editing profile.`);
      return { result: false };
    }
  }
}
