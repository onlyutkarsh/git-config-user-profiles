import * as vscode from "vscode";
import * as constants from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import * as gm from "../util/gitManager";
import { ICommand, Result } from "./ICommand";
export class DeleteUserProfileCommand implements ICommand<boolean> {
  private static instance: DeleteUserProfileCommand | null = null;

  public static Instance(): DeleteUserProfileCommand {
    if (this.instance === null) {
      this.instance = new DeleteUserProfileCommand();
    }
    return this.instance;
  }

  async execute(): Promise<Result<boolean>> {
    try {
      const result = await gm.getWorkspaceStatus();

      if (!(await gm.validateWorkspace(result))) {
        return {};
      }

      const pickerResult = await util.showProfilePicker();
      const selectedProfile = pickerResult.result as Profile;
      if (selectedProfile) {
        await util.deleteProfile(selectedProfile);
        vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "deleted profile");
      }
      vscode.window.showInformationMessage(`Profile '${selectedProfile.label}' deleted.`);
      return { result: true };
    } catch (error) {
      util.Logger.instance.logError(`Error ocurred while deleting profile. ${error}`);
      vscode.window.showErrorMessage(`Error ocurred while deleting profile.`);
      return { result: false };
    }
  }
}
