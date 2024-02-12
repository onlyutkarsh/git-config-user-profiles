import * as vscode from "vscode";
import { saveVscProfile } from "../config";
import * as constants from "../constants";
import { Profile } from "../models";
import * as util from "../util";
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
    const result = await util.showProfilePicker();
    const selectedProfile = result.result as Profile;
    if (selectedProfile) {
      selectedProfile.detail = undefined;
      selectedProfile.label = selectedProfile.label;

      const result = await util.loadProfileInWizard(selectedProfile);
      const updatedProfile = result as Profile;
      if (updatedProfile) {
        if (updatedProfile.id) {
          await saveVscProfile(updatedProfile, updatedProfile.id);
        } else {
          // backward compatibility
          await saveVscProfile(updatedProfile, updatedProfile.label);
        }
        vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "edited profile");
      } else {
        // user cancelled update
      }
    }
    return { result: true };
  }
}
