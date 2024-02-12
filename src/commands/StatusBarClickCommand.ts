import { basename } from "path";
import * as vscode from "vscode";
import { window } from "vscode";
import { saveVscProfile } from "../config";
import * as constants from "../constants";
import { Messages } from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import { Logger } from "../util";
import * as gm from "../util/gitManager";
import { EditUserProfileCommand } from "./EditUserProfileCommand";
import { ICommand, Result } from "./ICommand";

export class StatusBarClickCommand implements ICommand<void> {
  async execute(): Promise<Result<void>> {
    Logger.instance.logInfo(`Click event on status bar icon`);
    const result = await gm.getWorkspaceStatus();

    //TODO: Show error if the user deliberately deletes the username or email property from config
    if (result.status === gm.WorkspaceStatus.FieldsMissing) {
      window.showErrorMessage(result.message || "One of label, userName or email properties is missing in the config. Please verify.");
      await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "missing field in profile");
      return {};
    }

    if (result.status === gm.WorkspaceStatus.NoProfilesInConfig) {
      //if no profiles in config, prompt user to create (even if its non git workspace)
      const selected = await vscode.window.showInformationMessage("No user profiles defined. Do you want to define one now?", "Yes", "No");
      if (selected === "Yes") {
        await vscode.commands.executeCommand(constants.CommandIds.CREATE_USER_PROFILE);
      }
      return {};
    }

    if (result.status === gm.WorkspaceStatus.NotAValidWorkspace) {
      vscode.window.showErrorMessage(result.message || Messages.NOT_A_VALID_REPO);
      await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "invalid workspace");
      return {};
    }
    const workspaceFolder = result.currentFolder || ".\\";
    let response;
    if (result.status === gm.WorkspaceStatus.NoSelectedProfilesInConfig) {
      response = await vscode.window.showInformationMessage(
        `You have ${result.profilesInVSConfigCount} profile(s) in settings, but none are selected. What do you want to do?`,
        "Pick a profile",
        "Edit existing",
        "Create new"
      );
    } else {
      if (result.selectedProfile === undefined) {
        //this should never happen
        Logger.instance.logError("Selected profile is undefined");
        return {};
      }

      const notSyncOptions = ["Yes, apply", "No, pick another", "Edit existing", "Create new"];
      const syncOptions = ["Pick a profile", "Edit existing", "Create new"];

      const notSyncMessage = `'${basename(
        workspaceFolder
      )}' is not using user details from '${util.trimLabelIcons(result.selectedProfile!.label)}' profile. Do you want to apply the user details from profile '${util.trimLabelIcons(result.selectedProfile!.label)}'?`;

      const syncMessage = `'${basename(workspaceFolder)}' is already using user details from the profile '${util.trimLabelIcons(result.selectedProfile!.label)}'. What do you want to do?`;

      const options = result.configInSync ? syncOptions : notSyncOptions;
      const message = result.configInSync ? syncMessage : notSyncMessage;

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
      gm.updateGitConfig(workspaceFolder, result.selectedProfile!);
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
        gm.updateGitConfig(workspaceFolder, pickedProfile);

        await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "picked profile");
      } else {
        // profile is already set in the statusbar,
        // user clicks statusbar, picklist is shown to switch profiles, but user does not pick anything
        // leave selected as is
        // if (selectedProfileInVscConfig.length > 0) {
        //   await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "cancelled profile switch");
        //   return {};
        // }
        return {};
      }
    }
    return {};
  }
}
