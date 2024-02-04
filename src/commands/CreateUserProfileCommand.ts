import { saveVscProfile } from "../config";
import { Profile } from "../models";
import { ICommand, Result } from "./ICommand";
import { PickOrLoadProfileCommand } from "./PickOrLoadProfileCommand";

export class CreateUserProfileCommand implements ICommand<Profile> {
  async execute(): Promise<Result<Profile>> {
    const result = await new PickOrLoadProfileCommand().execute();
    const profile = result.result as Profile;
    if (profile) {
      await saveVscProfile(profile);
    }
    return result;
  }
}
