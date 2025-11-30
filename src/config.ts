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
 * Directly reads the selectedProfileId from a .vscode/settings.json file at the given path.
 * This is needed when the folder is not a workspace folder but we still want to read its settings.
 */
function readSelectedProfileIdFromFile(folderPath: string): string | undefined {
  const settingsPath = path.join(folderPath, ".vscode", "settings.json");

  try {
    if (!fs.existsSync(settingsPath)) {
      util.Logger.instance.logDebug("Config", "No .vscode/settings.json file found", {
        settingsPath
      });
      return undefined;
    }

    const content = fs.readFileSync(settingsPath, "utf8");
    const settings = JSON.parse(content);
    const selectedId = settings["gitConfigUser.selectedProfileId"];

    util.Logger.instance.logDebug("Config", "Read selectedProfileId from .vscode/settings.json", {
      settingsPath,
      selectedId: selectedId || "<none>"
    });

    return selectedId;
  } catch (error) {
    util.Logger.instance.logDebug("Config", "Failed to read .vscode/settings.json", {
      settingsPath,
      error: error instanceof Error ? error.message : String(error)
    });
    return undefined;
  }
}

/**
 * Get the selected profile ID for the current workspace folder.
 * Returns workspace-scoped setting if available, otherwise falls back to global selected flag.
 */
export function getSelectedProfileId(workspaceFolder?: vscode.Uri): string | undefined {
  // IMPORTANT: Always try to read from the git root's .vscode/settings.json file first
  // This is because VSCode's getConfiguration() API may read from parent workspace folder's settings
  // when the git root is a nested folder, giving us the wrong profile
  if (workspaceFolder?.fsPath) {
    const fileSelectedId = readSelectedProfileIdFromFile(workspaceFolder.fsPath);
    if (fileSelectedId) {
      util.Logger.instance.logDebug("Config", "Found selected profile by reading .vscode/settings.json directly", {
        profileId: fileSelectedId,
        folderPath: workspaceFolder.fsPath
      });
      return fileSelectedId;
    }
  }

  // If no file-based setting found, try VSCode API as fallback
  const config = vscode.workspace.getConfiguration("gitConfigUser", workspaceFolder);
  const selectedId = config.get<string>("selectedProfileId");

  util.Logger.instance.logDebug("Config", "Getting selected profile ID from VSCode API", {
    workspaceFolder: workspaceFolder?.fsPath,
    selectedId: selectedId || "<none>",
    configInspect: config.inspect("selectedProfileId")
  });

  if (selectedId) {
    util.Logger.instance.logDebug("Config", "Found workspace-scoped selected profile from VSCode API", {
      profileId: selectedId,
      hasWorkspaceFolder: !!workspaceFolder,
      workspaceFolderPath: workspaceFolder?.fsPath
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

  util.Logger.instance.logDebug("Config", "No selected profile found", {
    hasWorkspaceFolder: !!workspaceFolder,
    totalProfiles: profiles.length
  });

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
 * Directly writes the selectedProfileId to a .vscode/settings.json file at the given path.
 * This is needed when the folder is not a workspace folder but we still want to write its settings.
 */
async function writeSelectedProfileIdToFile(folderPath: string, profileId: string): Promise<void> {
  const settingsPath = path.join(folderPath, ".vscode", "settings.json");

  try {
    // Ensure .vscode directory exists
    const vscodeDir = path.join(folderPath, ".vscode");
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
      util.Logger.instance.logDebug("Config", "Created .vscode directory", { vscodeDir });
    }

    // Read existing settings or create new object
    let settings: any = {};
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, "utf8");
      settings = JSON.parse(content);
    }

    // Update the selectedProfileId
    settings["gitConfigUser.selectedProfileId"] = profileId;

    // Write back to file
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");

    util.Logger.instance.logDebug("Config", "Wrote selectedProfileId to .vscode/settings.json", {
      settingsPath,
      profileId
    });
  } catch (error) {
    util.Logger.instance.logDebug("Config", "Failed to write .vscode/settings.json", {
      settingsPath,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Set the selected profile ID for the current workspace folder.
 */
export async function setSelectedProfileId(profileId: string, workspaceFolder?: vscode.Uri): Promise<void> {
  if (!workspaceFolder) {
    util.Logger.instance.logDebug("Config", "No workspace folder provided for setSelectedProfileId", {});
    return;
  }

  // Check if this folder is an actual VSCode workspace folder
  const isWorkspaceFolder = vscode.workspace.workspaceFolders?.some(wf => wf.uri.fsPath === workspaceFolder.fsPath);

  if (isWorkspaceFolder) {
    // Use VSCode API for actual workspace folders
    await ensureVscodeSettingsExists(workspaceFolder);
    const config = vscode.workspace.getConfiguration("gitConfigUser", workspaceFolder);
    await config.update("selectedProfileId", profileId, vscode.ConfigurationTarget.WorkspaceFolder);

    util.Logger.instance.logDebug("Config", "Updated workspace-scoped selected profile via VSCode API", {
      profileId,
      folderPath: workspaceFolder.fsPath
    });
  } else {
    // For non-workspace folders (nested git repos), write directly to file
    await writeSelectedProfileIdToFile(workspaceFolder.fsPath, profileId);

    util.Logger.instance.logDebug("Config", "Updated selected profile by writing to .vscode/settings.json directly", {
      profileId,
      folderPath: workspaceFolder.fsPath
    });
  }
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
