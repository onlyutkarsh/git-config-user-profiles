import { saveVscProfile } from "../config";
import { Profile } from "../models";
import { CreateOrLoadProfileCommand } from "./CreateOrLoadProfileCommand";
import { ICommand, Result } from "./ICommand";

export class CreateUserProfileCommand implements ICommand<Profile> {
  async execute(): Promise<Result<Profile>> {
    const result = await new CreateOrLoadProfileCommand().execute();
    const profile = result.result as Profile;
    if (profile) {
      await saveVscProfile(profile);
    }
    return result;
  }
}
