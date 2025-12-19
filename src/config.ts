import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { LogCategory } from "./constants";
import { Profile } from "./models";
import * as util from "./util";

export function getProfilesInSettings(): Profile[] {
  const profiles = vscode.workspace.getConfiguration("gitConfigUser").get<Profile[]>("profiles");

  if (profiles && profiles.length > 0) {
    // map all profiles in to profiles entity and return
    return profiles;
  }
  return [];
}

/**
 * Directly reads the selectedProfileId from a .vscode/settings.json file at the given path.
 * This is needed when the folder is not a workspace folder but we still want to read its settings.
 */
function readSelectedProfileIdFromFile(folderPath: string): string | undefined {
  const settingsPath = path.join(folderPath, ".vscode", "settings.json");

  try {
    if (!fs.existsSync(settingsPath)) {
      util.Logger.instance.logTrace(LogCategory.WORKSPACE_STATUS, "No .vscode/settings.json file found", {
        settingsPath,
      });
      return undefined;
    }

    const content = fs.readFileSync(settingsPath, "utf8");
    const settings = JSON.parse(content);
    const selectedId = settings["gitConfigUser.selectedProfileId"];

    util.Logger.instance.logTrace(LogCategory.WORKSPACE_STATUS, "Read selectedProfileId from .vscode/settings.json", {
      settingsPath,
      selectedId: selectedId || "<none>",
    });

    return selectedId;
  } catch (error) {
    util.Logger.instance.logTrace(LogCategory.WORKSPACE_STATUS, "Failed to read .vscode/settings.json", {
      settingsPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Removes the old selectedProfileId setting from .vscode/settings.json file.
 * This is called after migrating the setting to user settings.
 */
function removeSelectedProfileIdFromFile(folderPath: string): void {
  const settingsPath = path.join(folderPath, ".vscode", "settings.json");

  try {
    if (!fs.existsSync(settingsPath)) {
      return;
    }

    const content = fs.readFileSync(settingsPath, "utf8");
    const settings = JSON.parse(content);

    // Check if the setting exists
    if (!settings.hasOwnProperty("gitConfigUser.selectedProfileId")) {
      return;
    }

    // Remove the setting
    delete settings["gitConfigUser.selectedProfileId"];

    // Write back to file
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");

    util.Logger.instance.logInfo("Migrated profile selection from .vscode/settings.json to user settings", {
      settingsPath,
    });
  } catch (error) {
    util.Logger.instance.logWarning("Failed to remove old selectedProfileId from .vscode/settings.json", {
      settingsPath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Helper function to handle async migration of profile selection from old storage to new storage.
 * This runs in the background without blocking the caller.
 */
async function migrateProfileSelection(profileId: string, workspaceFolder: vscode.Uri, workspacePath: string): Promise<void> {
  try {
    await setSelectedProfileId(profileId, workspaceFolder);
    // Remove the old setting from .vscode/settings.json after successful migration
    removeSelectedProfileIdFromFile(workspacePath);
    util.Logger.instance.logInfo("Successfully migrated profile selection to user settings", {
      profileId,
      folderPath: workspacePath,
    });
  } catch (err) {
    util.Logger.instance.logWarning("Failed to migrate profile selection to user settings", { error: err });
  }
}

/**
 * Get the selected profile ID for the current workspace folder.
 * Reads from user settings map first, then falls back to old storage locations for migration.
 */
export function getSelectedProfileId(workspaceFolder?: vscode.Uri): string | undefined {
  if (!workspaceFolder?.fsPath) {
    util.Logger.instance.logTrace(LogCategory.WORKSPACE_STATUS, "No workspace folder provided", {});
    return undefined;
  }

  const workspacePath = workspaceFolder.fsPath;

  // Validate workspace path
  if (!workspacePath || typeof workspacePath !== "string" || workspacePath.trim() === "") {
    util.Logger.instance.logWarning("Invalid workspace path provided", { path: workspacePath });
    return undefined;
  }

  const config = vscode.workspace.getConfiguration("gitConfigUser");

  // 1. Try reading from the new user settings map (preferred)
  const selections = config.get<Record<string, string>>("workspaceProfileSelections") || {};
  const selectedId = selections[workspacePath];

  if (selectedId) {
    util.Logger.instance.logTrace(LogCategory.WORKSPACE_STATUS, "Found selected profile in user settings map", {
      profileId: selectedId,
      folderPath: workspacePath,
    });
    return selectedId;
  }

  // 2. Migration: Try reading from old .vscode/settings.json file
  const fileSelectedId = readSelectedProfileIdFromFile(workspacePath);
  if (fileSelectedId) {
    util.Logger.instance.logTrace(LogCategory.WORKSPACE_STATUS, "Found selected profile in .vscode/settings.json (migrating to user settings)", {
      profileId: fileSelectedId,
      folderPath: workspacePath,
    });
    // Migrate to new storage and clean up old setting (async operation runs in background)
    migrateProfileSelection(fileSelectedId, workspaceFolder, workspacePath);
    return fileSelectedId;
  }

  // 3. Migration: Try reading from old workspace-scoped VSCode setting
  const workspaceConfig = vscode.workspace.getConfiguration("gitConfigUser", workspaceFolder);
  const oldSelectedId = workspaceConfig.get<string>("selectedProfileId");

  if (oldSelectedId) {
    util.Logger.instance.logTrace(LogCategory.WORKSPACE_STATUS, "Found selected profile in workspace settings (migrating to user settings)", {
      profileId: oldSelectedId,
      folderPath: workspacePath,
    });
    // Migrate to new storage and clean up old setting
    setSelectedProfileId(oldSelectedId, workspaceFolder)
      .then(async () => {
        // Remove the old setting from workspace settings after successful migration
        try {
          await workspaceConfig.update("selectedProfileId", undefined, vscode.ConfigurationTarget.WorkspaceFolder);
          util.Logger.instance.logInfo("Cleaned up old selectedProfileId from workspace settings", {
            folderPath: workspacePath,
          });
        } catch (error) {
          util.Logger.instance.logWarning("Failed to clean up old selectedProfileId from workspace settings", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })
      .catch((err) => {
        util.Logger.instance.logWarning("Failed to migrate profile selection to user settings", { error: err });
      });
    return oldSelectedId;
  }

  // 4. Fall back to legacy global "selected" flag for backwards compatibility
  const profiles = getProfilesInSettings();
  const selectedProfile = profiles.find((p) => p.selected === true);

  if (selectedProfile?.id) {
    util.Logger.instance.logTrace(LogCategory.WORKSPACE_STATUS, "Using legacy global selected flag", {
      profileId: selectedProfile.id,
      profileLabel: selectedProfile.label,
    });
    return selectedProfile.id;
  }

util.Logger.instance.logTrace(LogCategory.WORKSPACE_STATUS, "No selected profile found", {
    folderPath: workspacePath,
    totalProfiles: profiles.length,
  });

  return undefined;
}

/**
 * Set the selected profile ID for the current workspace folder.
 * Stores the selection in user settings (not workspace settings) so it remains
 * private to each developer and is not shared with the team.
 */
export async function setSelectedProfileId(profileId: string, workspaceFolder?: vscode.Uri): Promise<void> {
  if (!workspaceFolder?.fsPath) {
    util.Logger.instance.logTrace(LogCategory.WORKSPACE_STATUS, "No workspace folder provided for setSelectedProfileId", {});
    return;
  }

  const workspacePath = workspaceFolder.fsPath;

  // Validate workspace path
  if (!workspacePath || typeof workspacePath !== "string" || workspacePath.trim() === "") {
    util.Logger.instance.logWarning("Invalid workspace path provided to setSelectedProfileId", { path: workspacePath });
    return;
  }

  // Validate profile ID
  if (!profileId || typeof profileId !== "string" || profileId.trim() === "") {
    util.Logger.instance.logWarning("Invalid profile ID provided to setSelectedProfileId", { profileId });
    return;
  }

  // Get the current map of workspace selections from user settings
  const config = vscode.workspace.getConfiguration("gitConfigUser");
  const selections = config.get<Record<string, string>>("workspaceProfileSelections") || {};

  // Update the selection for this workspace folder
  selections[workspacePath] = profileId;

  // Save back to user settings (Global scope)
  await config.update("workspaceProfileSelections", selections, vscode.ConfigurationTarget.Global);

util.Logger.instance.logTrace(LogCategory.WORKSPACE_STATUS, "Updated workspace-scoped selected profile in user settings", {
    profileId,
    folderPath: workspacePath,
  });
}

export async function saveVscProfile(profile: Profile, oldProfileId?: string, workspaceFolder?: vscode.Uri): Promise<void> {
  //get existing profiles
  const profiles = getProfilesInSettings();
  profile = util.trimProperties(profile);
  let existingProfileIndex = -1;

  if (oldProfileId) {
    // user is updating existing profile, no need to make changes to selected field
    existingProfileIndex = profiles.findIndex((x) => {
      if (x.id) {
        return x.id === oldProfileId;
      } else {
        // for backward compatibility with old profiles without id
        return x.label.toLowerCase() === oldProfileId.toLowerCase();
      }
    });
  } else {
    // user is making a selection of profile (not updating the profile)
    existingProfileIndex = profiles.findIndex((x) => {
      if (x.id) {
        return x.id === profile.id;
      } else {
        // for backward compatibility with old profiles without id
        return x.label.toLowerCase() === profile.label.toLowerCase();
      }
    });

    if (existingProfileIndex > -1) {
      // Gradually migrate away from global "selected" flags
      // Remove selected flag from all profiles and clean up labels
      profiles.forEach((x) => {
        delete x.selected;
        x.label = x.label.replace("$(check)", "").trim();
      });

      // Remove selected from the profile we're saving too
      delete profile.selected;
      profile.label = profile.label.replace("$(check)", "").trim();
    }
  }

  if (existingProfileIndex > -1) {
    profiles[existingProfileIndex] = profile;
  } else {
    profiles.push(profile);
  }

  // Save profiles to global scope (without selected flags)
  await vscode.workspace.getConfiguration("gitConfigUser").update("profiles", profiles, vscode.ConfigurationTarget.Global);

  // If this is a profile selection (not an update), save the selection to workspace scope
  if (!oldProfileId && profile.id) {
    await setSelectedProfileId(profile.id, workspaceFolder);
    util.Logger.instance.logTrace(LogCategory.WORKSPACE_STATUS, "Profile selection saved to workspace scope and removed global selected flags", {
      profileId: profile.id,
      profileLabel: profile.label,
    });
  }
}

export function getVscProfile(profileName: string): Profile | undefined {
  const filtered = getProfilesInSettings().filter((x) => x.label.toLowerCase() === profileName.toLowerCase());
  if (filtered && filtered.length > 0) {
    return Object.assign({}, filtered[0]);
  }
  return undefined;
}
