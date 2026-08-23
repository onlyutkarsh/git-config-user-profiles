import * as vscode from "vscode";
import { getProfilesInSettings } from "../config";
import * as constants from "../constants";
import { LogCategory } from "../constants";
import { showProfileDeleteUi } from "../controls/profileUi";
import { Profile } from "../models";
import * as util from "../util";
import * as gm from "../util/gitManager";
import { ICommand, Result } from "./ICommand";
import { deleteManagedProfile } from "./profileCommandActions";
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
      util.Logger.instance.logDebug(LogCategory.DELETE_PROFILE, "Delete profile command started", {});

      const result = await gm.getWorkspaceStatus();

      if (!(await gm.validateWorkspace(result))) {
        return {};
      }

      const config = vscode.workspace.getConfiguration("gitConfigUser");
      const useUIToEdit = config.get<boolean>("useUIToEdit", false);
      const pickedProfile = useUIToEdit
        ? undefined
        : await util.showProfilePicker({
            includeGoBack: true,
            selectedProfileId: result.selectedProfile?.id,
            placeHolder: "Select a profile to delete.",
          });
      const selectedProfile = useUIToEdit ? await showProfileDeleteUi(getProfilesInSettings()) : (pickedProfile?.result as Profile);

      if (pickedProfile?.actionId === util.PROFILE_PICKER_ACTION_GO_BACK) {
        util.Logger.instance.logDebug(LogCategory.DELETE_PROFILE, "User chose to return to the profile picker", {});
        await vscode.commands.executeCommand(constants.CommandIds.PICK_USER_PROFILE);
        return { result: true };
      }

      if (selectedProfile) {
        util.Logger.instance.logDebug(LogCategory.DELETE_PROFILE, "Profile selected for deletion", {
          profileLabel: selectedProfile.label,
          profileId: selectedProfile.id,
        });

        const confirmation = useUIToEdit
          ? "Yes, delete"
          : await vscode.window.showQuickPick(["No", "Yes, delete", "Go back"], {
              canPickMany: false,
              ignoreFocusOut: true,
              placeHolder: `Delete profile '${util.trimLabelIcons(selectedProfile.label)}'? This cannot be undone.`,
            });

        if (confirmation === "Go back") {
          util.Logger.instance.logDebug(LogCategory.DELETE_PROFILE, "User chose to return to profile selection after confirming deletion prompt", {
            profileLabel: selectedProfile.label,
          });
          await vscode.commands.executeCommand(constants.CommandIds.PICK_USER_PROFILE);
          return { result: true };
        }

        if (confirmation !== "Yes, delete") {
          util.Logger.instance.logDebug(LogCategory.DELETE_PROFILE, "User cancelled profile deletion confirmation", {
            profileLabel: selectedProfile.label,
          });
          return { result: false };
        }

        await deleteManagedProfile({
          profile: selectedProfile,
          successMessage: `Profile '${selectedProfile.label}' deleted.`,
        });
        vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "deleted profile");
      } else {
        util.Logger.instance.logDebug(LogCategory.DELETE_PROFILE, "User cancelled profile deletion", {});
      }
      return { result: true };
    } catch (error) {
      util.Logger.instance.logError(`Error occurred while deleting profile. ${error}`);
      vscode.window.showErrorMessage(`Error occurred while deleting profile.`);
      return { result: false };
    }
  }
}
