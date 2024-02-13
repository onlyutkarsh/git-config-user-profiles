import * as vscode from "vscode";
import { saveVscProfile } from "../config";
import * as constants from "../constants";
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
      const result = await gm.getWorkspaceStatus();

      if (!(await gm.validateWorkspace(result))) {
        return {};
      }

      const pickedProfile = await util.showProfilePicker();
      const selectedProfile = pickedProfile.result as Profile;
      if (selectedProfile) {
        selectedProfile.detail = undefined;
        selectedProfile.label = selectedProfile.label;

        const result = await util.loadProfileInWizard(selectedProfile);
        const updatedProfile = result as Profile;
        if (updatedProfile) {
          if (updatedProfile.id) {
            await saveVscProfile(updatedProfile, updatedProfile.id);
          } else {
            await saveVscProfile(updatedProfile, updatedProfile.label);
          }
          vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "edited profile");
        } else {
          // user cancelled update
        }
      }
      return { result: true };
    } catch (error) {
      util.Logger.instance.logError(`Error ocurred while editing profile. ${error}`);
      vscode.window.showErrorMessage(`Error ocurred while editing profile.`);
      return { result: false };
    }
  }
}
