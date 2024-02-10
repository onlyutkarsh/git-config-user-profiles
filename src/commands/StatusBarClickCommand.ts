import { basename } from "path";
import * as vscode from "vscode";
import { window } from "vscode";
import { getProfilesInSettings, saveVscProfile } from "../config";
import * as constants from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import { Logger } from "../util";
import { EditUserProfileCommand } from "./EditUserProfileCommand";
import { ICommand, Result } from "./ICommand";

export class StatusBarClickCommand implements ICommand<void> {
  async execute(): Promise<Result<void>> {
    Logger.instance.logInfo(`Click event on status bar icon`);
    const profilesInVscConfig = getProfilesInSettings();
    const selectedProfileInVscConfig = profilesInVscConfig.filter((x) => x.selected) || [];
    const emptyProfile = <Profile>{
      label: constants.Application.APPLICATION_NAME,
      selected: false,
      email: "NA",
      userName: "NA",
    };
    const selectedVscProfile: Profile | undefined = selectedProfileInVscConfig.length > 0 ? selectedProfileInVscConfig[0] : emptyProfile;

    //TODO: Show error if the user deliberately deletes the username or email property from config
    if (selectedVscProfile && (selectedVscProfile.label === undefined || selectedVscProfile.userName === undefined || selectedVscProfile.email === undefined)) {
      window.showErrorMessage("One of label, userName or email properties is missing in the config. Please verify.");
      await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "missing field in profile");
      return {};
    }

    const validatedWorkspace = await util.isValidWorkspace();

    let configInSync = false;
    if (validatedWorkspace.isValid && validatedWorkspace.folder) {
      const currentGitConfig = await util.getCurrentGitConfig(validatedWorkspace.folder);
      configInSync = util.isConfigInSync(currentGitConfig, selectedVscProfile);
    }

    if (profilesInVscConfig.length === 0) {
      //if no profiles in config, prompt user to create (even if its non git workspace)
      const selected = await vscode.window.showInformationMessage("No user profiles defined. Do you want to define one now?", "Yes", "No");
      if (selected === "Yes") {
        await vscode.commands.executeCommand(constants.CommandIds.CREATE_USER_PROFILE);
      }
      return {};
    }

    let response;

    if (validatedWorkspace.isValid === false) {
      vscode.window.showErrorMessage(validatedWorkspace.message);
      await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "invalid workspace");
      return {};
    }
    const workspaceFolder = validatedWorkspace.folder ? validatedWorkspace.folder : ".\\";
    if (selectedProfileInVscConfig.length === 0) {
      const profilesInVscConfig = getProfilesInSettings();
      response = await vscode.window.showInformationMessage(
        `You have ${profilesInVscConfig.length} profile(s) in settings. What do you want to do?`,
        "Pick a profile",
        "Edit existing",
        "Create new"
      );
    } else {
      const notSyncOptions = ["Yes, apply", "No, pick another", "Edit existing", "Create new"];
      const syncOptions = ["Apply again", "Pick a profile", "Edit existing", "Create new"];

      const options = configInSync ? syncOptions : notSyncOptions;
      const message = configInSync
        ? `'${basename(workspaceFolder)}' is already using user details from the profile '${util.trimLabelIcons(selectedVscProfile.label)}'. What do you want to do?`
        : `'${basename(
            workspaceFolder
          )}' is not using user details from '${util.trimLabelIcons(selectedVscProfile.label)}' profile. Do you want to apply the user details from profile '${util.trimLabelIcons(selectedVscProfile.label)}'?`;

      response = await vscode.window.showInformationMessage(message, ...options);
    }

    if (response === undefined) {
      await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "user cancelled prompt");
      return {};
    }
    if (response === "Edit existing") {
      await EditUserProfileCommand.Instance().execute();
      await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "edit profile");
      return {};
    }
    if (response === "Yes, apply" || response === "Apply again") {
      util.updateGitConfig(workspaceFolder, selectedVscProfile);
      await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "applied profile");

      return {};
    }
    if (response === "Create new") {
      await vscode.commands.executeCommand(constants.CommandIds.CREATE_USER_PROFILE);
      await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "created new profile");
      return {};
    }
    if (response === "No, pick another" || response === "Pick a profile") {
      //show picklist only if no profile is marked as selected in config.
      //this can happen only when setting up config for the first time or user deliberately changed config
      const result = await util.showProfilePicker();
      const pickedProfile = result.result as Profile;
      if (pickedProfile) {
        pickedProfile.detail = undefined;
        pickedProfile.label = pickedProfile.label;
        pickedProfile.selected = true;
        await saveVscProfile(Object.assign({}, pickedProfile));
        util.updateGitConfig(workspaceFolder, pickedProfile);

        await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "picked profile");
      } else {
        // profile is already set in the statusbar,
        // user clicks statusbar, picklist is shown to switch profiles, but user does not pick anything
        // leave selected as is
        if (selectedProfileInVscConfig.length > 0) {
          await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "cancelled profile switch");
          return {};
        }
      }
    }
    return {};
  }
}
