import { window } from "vscode";
import { getVscProfiles } from "../config";
import { Profile } from "../models";
import { ICommand, Result } from "./ICommand";

export class SelectProfileCommand implements ICommand<Profile> {
  private preloadedProfile: Profile | undefined;
  constructor(prelodedProfile?: Profile) {
    this.preloadedProfile = prelodedProfile;
  }

  async execute(): Promise<Result<Profile>> {
    const profilesInVscConfig = getVscProfiles();

    //show picklist only if no profile is marked as selected in config.
    //this can happen only when setting up config for the first time or user deliberately changed config
    const pickedProfile = await window.showQuickPick<Profile>(
      profilesInVscConfig.map((x) => {
        return {
          label: x.label,
          userName: x.userName,
          email: x.email,
          selected: x.selected,
          detail: `${x.userName} (${x.email}) `,
          id: x.id,
        };
      }),
      {
        canPickMany: false,
        matchOnDetail: false,
        ignoreFocusOut: true,
        placeHolder: "Select a user profile.",
      }
    );
    return {
      result: pickedProfile,
    };
  }
}
