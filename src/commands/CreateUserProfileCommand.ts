import * as vscode from "vscode";
import { saveVscProfile } from "../config";
import { Profile } from "../models";
import * as util from "../util";
import { ICommand, Result } from "./ICommand";

export class CreateUserProfileCommand implements ICommand<Profile | undefined> {
  async execute(): Promise<Result<Profile | undefined>> {
    try {
      const result = await util.createProfileWithWizard();
      const profile = result as Profile;
      if (profile) {
        await saveVscProfile(profile);
        vscode.window.showInformationMessage(`Profile '${profile.label}' created. 🎉`);
        return { result: profile };
      } else {
        return { result: undefined };
      }
    } catch (error) {
      util.Logger.instance.logError(`Error ocurred while creating profile. ${error}`);
      vscode.window.showErrorMessage(`Error ocurred while creating profile.`);
      return { result: undefined, error: error as Error };
    }
  }
}
