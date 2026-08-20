import * as vscode from "vscode";
import { getProfilesInSettings } from "../config";
import { LogCategory } from "../constants";
import { showProfileForm } from "../controls/profileUi";
import { Profile } from "../models";
import * as util from "../util";
import * as gm from "../util/gitManager";
import { ICommand, Result } from "./ICommand";
import { createManagedProfile, deleteManagedProfile } from "./profileCommandActions";

export class CreateUserProfileCommand implements ICommand<Profile | undefined> {
  async execute(): Promise<Result<Profile | undefined>> {
    try {
      util.Logger.instance.logDebug(LogCategory.CREATE_PROFILE, "Create profile command started", {});

      const config = vscode.workspace.getConfiguration("gitConfigUser");
      const useUIToEdit = config.get<boolean>("useUIToEdit", false);
      if (useUIToEdit) {
        const workspaceStatus = await gm.getWorkspaceStatus();
        const workspaceSelections = config.get<Record<string, string>>("workspaceProfileSelections", {});
        void showProfileForm(
          undefined,
          getProfilesInSettings(),
          async (profile) => {
            await createManagedProfile({
              profile,
            });
          },
          async (profile) => {
            await deleteManagedProfile({ profile });
          },
          undefined,
          workspaceSelections,
          workspaceStatus.currentFolder
        ).catch((error) => {
          util.Logger.instance.logError(`Error occurred while managing profiles. ${error}`);
          vscode.window.showErrorMessage("Error occurred while managing profiles.");
        });
        return { result: undefined };
      }

      const result = await util.createProfileWithWizard();
      const profile = result as Profile;
      if (!profile) {
        util.Logger.instance.logDebug(LogCategory.CREATE_PROFILE, "User cancelled profile creation", {});
        return { result: undefined };
      }

      util.Logger.instance.logDebug(LogCategory.CREATE_PROFILE, "New profile created", {
        profileLabel: profile.label,
        profileId: profile.id,
        userName: profile.userName,
        email: profile.email,
      });

      await createManagedProfile({
        profile,
        successMessage: `Profile '${profile.label}' created. 🎉`,
      });
      return { result: profile };
    } catch (error) {
      util.Logger.instance.logError(`Error occurred while creating profile. ${error}`);
      vscode.window.showErrorMessage(`Error occurred while creating profile.`);
      return { result: undefined, error: error as Error };
    }
  }
}
