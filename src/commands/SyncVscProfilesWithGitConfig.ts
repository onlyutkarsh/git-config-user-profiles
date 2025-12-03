import { basename } from "path";
import * as vscode from "vscode";
import { getProfilesInSettings, saveVscProfile } from "../config";
import * as constants from "../constants";
import { LogCategory } from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import * as gm from "../util/gitManager";
import { ICommand, Result } from "./ICommand";

export class SyncVscProfilesWithGitConfig implements ICommand<boolean> {
  private onStartup = true;
  constructor(onStartup: boolean = true) {
    this.onStartup = onStartup;
  }
  async execute(): Promise<Result<boolean>> {
    // check if is valid git workspace
    const validatedWorkspace = await gm.isValidWorkspace();
    if (!(validatedWorkspace.isValid && validatedWorkspace.folder)) {
      // window.showWarningMessage(Constants.Messages.NOT_A_VALID_REPO);
      return { result: true };
    }

    // get git config profile
    // let gitProfile: { userName: string; email: string };
    const gitProfile = await gm.getCurrentGitConfig(validatedWorkspace.folder);
    // get all existing vsc profiles
    const vscProfiles = getProfilesInSettings();

    // return an empty object if no git profile found
    if (util.isNameAndEmailEmpty(gitProfile)) {
      //UTK ask user to create a local git config if there are no profiles
      if (vscProfiles.length == 0) {
        const response = await vscode.window.showInformationMessage(
          `No user details found in git config of '${basename(validatedWorkspace.folder)}'. Do you want to create a new user detail profile now?`,
          "Yes",
          "No"
        );
        if (response == "Yes") {
          await vscode.commands.executeCommand(constants.CommandIds.CREATE_USER_PROFILE);
          return { result: true };
        }
        return { result: true };
      } else {
        const response = await vscode.window.showInformationMessage(
          `No user details found in git config of '${basename(validatedWorkspace.folder)}'. Do you want to apply a user profile now?`,
          "Yes",
          "No"
        );
        if (response == "Yes") {
          await vscode.commands.executeCommand(constants.CommandIds.CREATE_USER_PROFILE);
          return { result: true };
        }
      }
      return { result: true };
    }

    // Get workspace folder URI for this git root
    const vscWorkspaceFolder = vscode.workspace.workspaceFolders?.find((wf) => validatedWorkspace.folder!.startsWith(wf.uri.fsPath));

    // update corresponding vsc profile, if it exists, otherwise add it to vsc config
    const correspondingVscProfile = vscProfiles.filter((vscProfile) => util.isConfigInSync(vscProfile, gitProfile));

    if (correspondingVscProfile.length >= 1) {
      // only select the first appearance for this workspace
      const profileToSelect = correspondingVscProfile[0];

      util.Logger.instance.logDebug(LogCategory.PROFILE_MATCHING, "Found matching profile for git config", {
        profileLabel: profileToSelect.label,
        profileId: profileToSelect.id,
        workspaceFolder: basename(validatedWorkspace.folder),
      });

      // Save as selected profile for this workspace
      profileToSelect.selected = true;
      if (profileToSelect.id) {
        await saveVscProfile(profileToSelect, profileToSelect.id, vscWorkspaceFolder?.uri);
      } else {
        await saveVscProfile(profileToSelect, profileToSelect.label, vscWorkspaceFolder?.uri);
      }
    } else {
      // add the git config profile to vsc config and select it for this workspace
      util.Logger.instance.logDebug(LogCategory.PROFILE_MATCHING, "Creating new profile from git config", {
        userName: gitProfile.userName,
        email: gitProfile.email,
        workspaceFolder: basename(validatedWorkspace.folder),
      });

      const newProfile = new Profile(
        util.trimLabelIcons(gitProfile.userName),
        gitProfile.userName,
        gitProfile.email,
        true,
        gitProfile.signingKey,
        `${gitProfile.userName} (${gitProfile.email}) `
      );
      await saveVscProfile(newProfile, undefined, vscWorkspaceFolder?.uri);
    }
    return { result: true };
  }
}
