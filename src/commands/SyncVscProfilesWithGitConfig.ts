import { basename } from "path";
import { commands, window } from "vscode";
import { getVscProfiles, saveVscProfile } from "../config";
import * as constants from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import { ICommand, Result } from "./ICommand";
import { SelectProfileCommand } from "./SelectProfileCommand";

export class SyncVscProfilesWithGitConfig implements ICommand<boolean> {
  private onStartup = true;
  constructor(onStartup: boolean = true) {
    this.onStartup = onStartup;
  }
  async execute(): Promise<Result<boolean>> {
    // check if is valid git workspace
    const validatedWorkspace = await util.isValidWorkspace();
    if (!(validatedWorkspace.isValid && validatedWorkspace.folder)) {
      // window.showWarningMessage(Constants.Messages.NOT_A_VALID_REPO);
      return { result: true };
    }

    // get git config profile
    // let gitProfile: { userName: string; email: string };
    const gitProfile = await util.getCurrentGitConfig(validatedWorkspace.folder);
    // get all existing vsc profiles
    const vscProfiles = getVscProfiles();

    // return an empty object if no git profile found
    if (util.isNameAndEmailEmpty(gitProfile)) {
      //UTK ask user to create a local git config if there are no profiles
      if (vscProfiles.length == 0) {
        const response = await window.showInformationMessage(
          `No user details found in git config of the repo '${basename(validatedWorkspace.folder)}'. Do you want to create a new user detail profile now?`,
          "Yes",
          "No"
        );
        if (response == "Yes") {
          await await commands.executeCommand(constants.CommandIds.CREATE_USER_PROFILE);
          return { result: true };
        }
        return { result: true };
      } else {
        const response = await window.showInformationMessage(
          `No user details found in git config of the repo '${basename(validatedWorkspace.folder)}'. Do you want to apply a user profile now?`,
          "Yes",
          "No"
        );
        if (response == "Yes") {
          await new SelectProfileCommand().execute();
          return { result: true };
        }
      }
      return { result: true };
    }

    // set selected = false for all selected vsc profiles
    await Promise.all(
      vscProfiles
        .filter((vscProfile) => vscProfile.selected)
        .map(async (vscProfile) => {
          vscProfile.selected = false;
          await saveVscProfile(vscProfile, vscProfile.id);
        })
    );

    // update corresponding vsc profile, if it exists, otherwise add it to vsc cofig
    const correspondingVscProfile = vscProfiles.filter((vscProfile) => util.hasSameNameAndEmail(vscProfile, gitProfile));

    if (correspondingVscProfile.length >= 1) {
      // only select the first appearance
      correspondingVscProfile[0].selected = true;
      if (correspondingVscProfile[0].id) {
        await saveVscProfile(correspondingVscProfile[0], correspondingVscProfile[0].id);
      } else {
        await saveVscProfile(correspondingVscProfile[0], correspondingVscProfile[0].label);
      }
    } else {
      // add the git config profile to vsc config
      // const newProfile: Profile = {
      //   label: util.trimLabelIcons(gitProfile.userName),
      //   userName: gitProfile.userName,
      //   email: gitProfile.email,
      //   selected: true,
      //   detail: `${gitProfile.userName} (${gitProfile.email}) `,
      // };
      const newProfile = new Profile(util.trimLabelIcons(gitProfile.userName), gitProfile.userName, gitProfile.email, true, `${gitProfile.userName} (${gitProfile.email}) `);
      await saveVscProfile(newProfile);
    }
    return { result: true };
  }
}
