import * as vscode from "vscode";
import { Profile } from "./models";
import * as util from "./util";
import * as fs from "fs";
import * as path from "path";

export function getProfilesInSettings(): Profile[] {
  const profiles = vscode.workspace.getConfiguration("gitConfigUser").get<Profile[]>("profiles");

  if (profiles && profiles.length > 0) {
    // map all profiles in to profiles entity and return
    return profiles;
  }
  return [];
}

/**
 * Get the selected profile ID for the current workspace folder.
 * Returns workspace-scoped setting if available, otherwise falls back to global selected flag.
 */
export function getSelectedProfileId(workspaceFolder?: vscode.Uri): string | undefined {
  // First, try to get workspace-scoped selectedProfileId
  const config = vscode.workspace.getConfiguration("gitConfigUser", workspaceFolder);
  const selectedId = config.get<string>("selectedProfileId");

  if (selectedId) {
    util.Logger.instance.logDebug("Config", "Found workspace-scoped selected profile", {
      profileId: selectedId,
      hasWorkspaceFolder: !!workspaceFolder
    });
    return selectedId;
  }

  // Fall back to legacy global "selected" flag for backwards compatibility
  const profiles = getProfilesInSettings();
  const selectedProfile = profiles.find(p => p.selected === true);

  if (selectedProfile?.id) {
    util.Logger.instance.logDebug("Config", "Using legacy global selected flag", {
      profileId: selectedProfile.id,
      profileLabel: selectedProfile.label
    });
    return selectedProfile.id;
  }

  return undefined;
}

/**
 * Ensures .vscode/settings.json exists in the workspace folder.
 * This is necessary because VS Code doesn't create the file automatically when using
 * ConfigurationTarget.WorkspaceFolder if the file doesn't already exist.
 */
async function ensureVscodeSettingsExists(workspaceFolder?: vscode.Uri): Promise<void> {
  if (!workspaceFolder) {
    util.Logger.instance.logDebug("Config", "Skipping .vscode/settings.json creation - no workspaceFolder provided", {});
    return;
  }

  const vscodeDir = path.join(workspaceFolder.fsPath, ".vscode");
  const settingsFile = path.join(vscodeDir, "settings.json");

  try {
    // Check if settings.json already exists
    if (fs.existsSync(settingsFile)) {
      util.Logger.instance.logDebug("Config", ".vscode/settings.json already exists", {
        folder: workspaceFolder.fsPath
      });
      return;
    }

    util.Logger.instance.logDebug("Config", "Creating .vscode/settings.json", {
      folder: workspaceFolder.fsPath,
      vscodeDir,
      settingsFile
    });

    // Create .vscode directory if it doesn't exist
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
      util.Logger.instance.logDebug("Config", "Created .vscode directory", {
        vscodeDir
      });
    }

    // Create an empty settings.json file with proper JSON structure
    fs.writeFileSync(settingsFile, "{\n}\n", "utf8");

    util.Logger.instance.logInfo(`Created .vscode/settings.json in ${workspaceFolder.fsPath} for workspace settings persistence`);
  } catch (error) {
    util.Logger.instance.logWarning("Failed to create .vscode/settings.json", {
      error: error instanceof Error ? error.message : String(error),
      folder: workspaceFolder.fsPath
    });
    // Don't throw - let VS Code handle storage in workspace state as fallback
  }
}

/**
 * Set the selected profile ID for the current workspace folder.
 */
export async function setSelectedProfileId(profileId: string, workspaceFolder?: vscode.Uri): Promise<void> {
  // Ensure .vscode/settings.json exists so the setting is persisted in the workspace
  await ensureVscodeSettingsExists(workspaceFolder);

  const config = vscode.workspace.getConfiguration("gitConfigUser", workspaceFolder);
  await config.update("selectedProfileId", profileId, vscode.ConfigurationTarget.WorkspaceFolder);

  util.Logger.instance.logDebug("Config", "Updated workspace-scoped selected profile", {
    profileId,
    hasWorkspaceFolder: !!workspaceFolder
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
    util.Logger.instance.logDebug("Config", "Profile selection saved to workspace scope and removed global selected flags", {
      profileId: profile.id,
      profileLabel: profile.label
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
