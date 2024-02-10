import { saveVscProfile } from "../config";
import { Profile } from "../models";
import * as util from "../util";
import { ICommand, Result } from "./ICommand";

export class CreateUserProfileCommand implements ICommand<Profile> {
  async execute(): Promise<Result<Profile>> {
    const result = await util.createProfileWithWizard();
    const profile = result as Profile;
    if (profile) {
      await saveVscProfile(profile);
    }
    return { result: profile };
  }
}
