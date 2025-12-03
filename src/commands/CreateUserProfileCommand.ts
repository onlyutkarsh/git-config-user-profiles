import * as vscode from "vscode";
import { saveVscProfile } from "../config";
import { LogCategory } from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import { ICommand, Result } from "./ICommand";

export class CreateUserProfileCommand implements ICommand<Profile | undefined> {
  async execute(): Promise<Result<Profile | undefined>> {
    try {
      util.Logger.instance.logDebug(LogCategory.CREATE_PROFILE, "Create profile command started", {});

      const result = await util.createProfileWithWizard();
      const profile = result as Profile;
      if (profile) {
        util.Logger.instance.logDebug(LogCategory.CREATE_PROFILE, "New profile created", {
          profileLabel: profile.label,
          profileId: profile.id,
          userName: profile.userName,
          email: profile.email
        });

        await saveVscProfile(profile);
        util.Logger.instance.logInfo(`Profile '${profile.label}' created successfully`);
        vscode.window.showInformationMessage(`Profile '${profile.label}' created. 🎉`);
        return { result: profile };
      } else {
        util.Logger.instance.logDebug(LogCategory.CREATE_PROFILE, "User cancelled profile creation", {});
        return { result: undefined };
      }
    } catch (error) {
      util.Logger.instance.logError(`Error occurred while creating profile. ${error}`);
      vscode.window.showErrorMessage(`Error occurred while creating profile.`);
      return { result: undefined, error: error as Error };
    }
  }
}
