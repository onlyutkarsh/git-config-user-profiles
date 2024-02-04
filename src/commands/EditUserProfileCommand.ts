import { window } from "vscode";
import { getVscProfiles, saveVscProfile } from "../config";
import { Profile } from "../models";
import { ICommand, Result } from "./ICommand";
import { PickOrLoadProfileCommand } from "./PickOrLoadProfileCommand";
import { SelectProfileCommand } from "./SelectProfileCommand";

export class EditUserProfileCommand implements ICommand<boolean> {
  private static instance: EditUserProfileCommand | null = null;

  public static Instance(): EditUserProfileCommand {
    if (this.instance === null) {
      this.instance = new EditUserProfileCommand();
    }
    return this.instance;
  }

  async execute(): Promise<Result<boolean>> {
    const profilesInConfig = getVscProfiles();

    if (profilesInConfig.length === 0) {
      window.showWarningMessage("No profiles found");
      return { result: false };
    }
    const result = await new SelectProfileCommand().execute();
    let selectedProfile = result.result as Profile;
    if (selectedProfile) {
      selectedProfile.detail = undefined;
      selectedProfile.label = selectedProfile.label;

      const result = await new PickOrLoadProfileCommand(selectedProfile).execute();
      const updatedProfile = result.result as Profile;
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
