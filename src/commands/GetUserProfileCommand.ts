import { basename } from "path";
import { window } from "vscode";
import { getProfilesInSettings } from "../config";
import { StatusBarStatus, ProfileStatusBar as statusBar } from "../controls";
import { Profile } from "../models";
import * as util from "../util";
import { Logger } from "../util";
import { ICommand, Result } from "./ICommand";

export class GetUserProfileCommand implements ICommand<void> {
  constructor() {}

  async execute(origin?: string): Promise<Result<void>> {
    Logger.instance.logInfo(`Getting user profiles from settings [${origin}]`);
    const profilesInSettings = getProfilesInSettings();

    if (profilesInSettings.length === 0) {
      //if profile loaded automatically and no config found
      //OR if no config found and user clicks on "no profile" on status bar, send undefined to show picklist
      await statusBar.instance.updateStatus(undefined, undefined, StatusBarStatus.Warning);
      return {};
    }

    const selectedProfileInVscConfig = profilesInSettings.filter((x) => x.selected) || [];
    const selectedVscProfile: Profile | undefined = selectedProfileInVscConfig.length > 0 ? selectedProfileInVscConfig[0] : undefined;

    //TODO: Show error if the user deliberately deletes the username or email property from config
    if (selectedVscProfile && (selectedVscProfile.label === undefined || selectedVscProfile.userName === undefined || selectedVscProfile.email === undefined)) {
      window.showErrorMessage("One of label, userName or email properties is missing in the config. Please verify.");
      await statusBar.instance.updateStatus(undefined, undefined, StatusBarStatus.Warning, "One of label, userName or email properties is missing in the config. Please verify.");
      return {};
    }

    const validatedWorkspace = await util.isValidWorkspace();

    if (validatedWorkspace.isValid === false) {
      await statusBar.instance.updateStatus(selectedVscProfile, undefined, StatusBarStatus.Warning, validatedWorkspace.message);
      return {};
    }

    let configInSync = false;
    //if configs found, compare it with current git config
    if (selectedVscProfile && validatedWorkspace.isValid && validatedWorkspace.folder) {
      const currentGitConfig = await util.getCurrentGitConfig(validatedWorkspace.folder);
      configInSync = util.isConfigInSync(currentGitConfig, selectedVscProfile);
      await statusBar.instance.updateStatus(selectedVscProfile, basename(validatedWorkspace.folder), configInSync ? StatusBarStatus.Normal : StatusBarStatus.Warning);
      return {};
    }
    //if configs found, but none are selected, if from statusbar show picklist else silent
    //if multiple items have selected = true (due to manual change) return the first one
    await statusBar.instance.updateStatus(undefined, undefined, StatusBarStatus.Warning, validatedWorkspace.message);
    return {};
  }
}
