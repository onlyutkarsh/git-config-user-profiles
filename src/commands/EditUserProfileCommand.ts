import { window } from "vscode";
import { getProfilesInSettings, saveVscProfile } from "../config";
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
    const profilesInConfig = getProfilesInSettings();

    if (profilesInConfig.length === 0) {
      window.showWarningMessage("No profiles found");
      return { result: false };
    }
    const result = await util.showProfilePicker();
    let selectedProfile = result.result as Profile;
    if (selectedProfile) {
      selectedProfile.detail = undefined;
      selectedProfile.label = selectedProfile.label;

      const result = await util.loadProfileInWizard(selectedProfile);
      const updatedProfile = result as Profile;
      if (updatedProfile) {
        selectedProfile = updatedProfile;
      }
      if (selectedProfile.id) {
        await saveVscProfile(selectedProfile, selectedProfile.id);
      } else {
        // backward compatibility
        await saveVscProfile(selectedProfile, selectedProfile.label);
      }
    }
    return { result: true };
  }
}
