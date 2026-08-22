import { basename } from "path";
import * as vscode from "vscode";
import { saveVscProfile } from "../config";
import * as constants from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import * as gm from "../util/gitManager";
import { Result } from "./ICommand";

interface SaveManagedProfileParams {
  profile: Profile;
  actionVerb: "created" | "updated";
  profileIdToUpdate?: string;
  successMessage?: string;
}

interface CreateManagedProfileParams {
  profile: Profile;
  successMessage?: string;
}

interface UpdateManagedProfileParams {
  profile: Profile;
  profileIdToUpdate: string;
  successMessage?: string;
}

interface DeleteManagedProfileParams {
  profile: Profile;
  successMessage?: string;
}

async function saveManagedProfile({ profile, actionVerb, profileIdToUpdate, successMessage }: SaveManagedProfileParams): Promise<void> {
  if (profileIdToUpdate) {
    await saveVscProfile(profile, profileIdToUpdate);
  } else {
    await saveVscProfile(profile);
  }

  util.Logger.instance.logInfo(`Profile '${profile.label}' ${actionVerb} successfully`);

  if (successMessage) {
    await vscode.window.showInformationMessage(successMessage);
  }
}

export async function createManagedProfile({ profile, successMessage }: CreateManagedProfileParams): Promise<void> {
  await saveManagedProfile({
    profile,
    actionVerb: "created",
    successMessage,
  });
}

export async function updateManagedProfile({ profile, profileIdToUpdate, successMessage }: UpdateManagedProfileParams): Promise<void> {
  await saveManagedProfile({
    profile,
    actionVerb: "updated",
    profileIdToUpdate,
    successMessage,
  });
}

export async function deleteManagedProfile({ profile, successMessage }: DeleteManagedProfileParams): Promise<void> {
  await util.deleteProfile(profile);
  util.Logger.instance.logInfo(`Profile '${profile.label}' deleted successfully`);

  if (successMessage) {
    await vscode.window.showInformationMessage(successMessage);
  }
}

/**
 * Applies a profile to the current workspace's git config and persists the selection.
 * Re-evaluates the workspace first to avoid acting on stale state, rolls back the git
 * config if applying or persisting fails, and refreshes the status bar on success.
 * On success, `message` contains the name of the repository the profile was applied to.
 */
export async function applyProfileToWorkspace(profile: Profile): Promise<Result<Profile>> {
  // Re-evaluate workspace to avoid stale state (e.g., user changed active editor after the command started)
  const refreshedStatus = await gm.getWorkspaceStatus();
  if (!(await gm.validateWorkspace(refreshedStatus))) {
    util.Logger.instance.logWarning("Workspace validation failed before applying profile", {
      status: gm.WorkspaceStatus[refreshedStatus.status],
      message: refreshedStatus.message,
    });
    return {};
  }

  const refreshedFolder = refreshedStatus.currentFolder;
  if (!refreshedFolder) {
    util.Logger.instance.logWarning("No active workspace folder when applying profile", {});
    return {};
  }

  const refreshedGitRootUri = vscode.Uri.file(refreshedFolder);
  const refreshedRepoName = basename(refreshedFolder);
  const previousGitConfig = refreshedStatus.currentGitConfig ?? (await gm.getCurrentGitConfig(refreshedFolder));
  profile.detail = undefined;
  profile.selected = true;
  try {
    await gm.updateGitConfig(refreshedFolder, profile);
  } catch (error) {
    util.Logger.instance.logError("Failed to update git config with selected profile", error as Error);
    try {
      await gm.restoreGitConfig(refreshedFolder, previousGitConfig);
      vscode.window.showErrorMessage(`Failed to apply profile '${profile.label}'. Previous Git config was restored.`);
    } catch (rollbackError) {
      util.Logger.instance.logError("Failed to restore previous git config after profile apply failed", rollbackError as Error);
      vscode.window.showErrorMessage(`Failed to apply profile '${profile.label}' and restore previous Git config. See logs for details.`);
    }
    gm.invalidateWorkspaceStatusCache();
    return { result: undefined, error: error as Error };
  }
  // Persist the selection only after Git accepts the profile.
  try {
    await saveVscProfile(Object.assign({}, profile), undefined, refreshedGitRootUri);
  } catch (error) {
    util.Logger.instance.logError("Failed to save selected profile; restoring previous git config", error as Error);
    try {
      await gm.restoreGitConfig(refreshedFolder, previousGitConfig);
      vscode.window.showErrorMessage(`Failed to save profile selection. Previous Git config was restored.`);
    } catch (rollbackError) {
      util.Logger.instance.logError("Failed to restore previous git config after profile selection save failed", rollbackError as Error);
      vscode.window.showErrorMessage(`Failed to save profile selection and restore previous Git config. See logs for details.`);
    }
    gm.invalidateWorkspaceStatusCache();
    return { result: undefined, error: error as Error };
  }

  // Invalidate cache after updating git config
  gm.invalidateWorkspaceStatusCache();
  await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "applied profile");

  util.Logger.instance.logInfo(`Profile '${profile.label}' applied successfully to '${refreshedRepoName}'`);
  return { result: profile, message: refreshedRepoName };
}
