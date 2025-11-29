import { basename } from "path";
import { simpleGit, SimpleGit } from "simple-git";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import { Result } from "../commands/ICommand";
import { getProfilesInSettings } from "../config";
import * as constants from "../constants";
import { Messages } from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import { Logger } from "../util";

// Cache for workspace status to reduce redundant git config reads
interface WorkspaceStatusCache {
  status: WorkspaceStatus;
  message?: string;
  selectedProfile?: Profile;
  profilesInVSConfigCount?: number;
  configInSync?: boolean;
  currentFolder?: string;
  timestamp: number;
}

let workspaceStatusCache: WorkspaceStatusCache | null = null;
const CACHE_DURATION_MS = 1000; // Cache valid for 1 second

export function invalidateWorkspaceStatusCache(): void {
  const hadCache = workspaceStatusCache !== null;
  workspaceStatusCache = null;
  Logger.instance.logDebug("Cache", "Workspace status cache invalidated", { hadCache });
}

async function getCurrentFolder(): Promise<Result<string | undefined>> {
  const editor = vscode.window.activeTextEditor;
  let folder: vscode.WorkspaceFolder | undefined;
  if (!vscode.workspace.workspaceFolders) {
    return {
      result: undefined,
      message: Messages.NOT_A_VALID_REPO,
    };
  }
  if (vscode.workspace.workspaceFolders.length === 0) {
    return {
      result: undefined,
      message: "No workspace folder found.",
    };
  }
  if (editor) {
    // If we have a file:// resource we resolve the WorkspaceFolder this file is from and update
    // the status accordingly.
    const resource = editor.document.uri;

    // Silently ignore non-file schemes (notebooks, settings, extensions, etc.)
    if (resource.scheme !== "file") {
      return {
        result: undefined,
        message: "",  // Empty message to indicate silent ignore
      };
    }

    folder = vscode.workspace.getWorkspaceFolder(resource);
    if (!folder) {
      return {
        result: undefined,
        message: "This file is not part of a workspace folder.",
      };
    }
  } else {
    //if no file is open in the editor, we use the first workspace folder
    folder = vscode.workspace.workspaceFolders[0];
  }

  if (!folder) {
    return {
      result: undefined,
      message: Messages.NOT_A_VALID_REPO,
    };
  }
  return {
    result: folder.uri.fsPath,
    message: "",
  };
}

export async function isValidWorkspace(): Promise<{ isValid: boolean; message: string; folder?: string }> {
  const result = await getCurrentFolder();
  if (!result.result) {
    return {
      message: result.message || Messages.NOT_A_VALID_REPO,
      isValid: false,
    };
  }
  const isGitRepo = await isGitRepository(result.result as string);
  if (!isGitRepo) {
    return {
      message: Messages.NOT_A_VALID_REPO,
      isValid: false,
    };
  }
  return {
    message: "",
    isValid: true,
    folder: result.result as string,
  };
}

export async function getCurrentGitConfig(gitFolder: string): Promise<{ userName: string; email: string; signingKey: string }> {
  Logger.instance.logDebug("GitConfig", "Reading local git config", { folder: basename(gitFolder) });
  const git: SimpleGit = simpleGit(gitFolder);
  const rawUserName = await git.getConfig("user.name", "local");
  const rawEmail = await git.getConfig("user.email", "local");
  const rawSigningKey = await git.getConfig("user.signingkey", "local");

  const currentConfig = {
    userName: rawUserName.value || "",
    email: rawEmail.value || "",
    signingKey: rawSigningKey.value || "",
  };

  Logger.instance.logDebug("GitConfig", "Local git config retrieved", {
    folder: basename(gitFolder),
    userName: currentConfig.userName,
    email: currentConfig.email,
    hasSigningKey: !!currentConfig.signingKey
  });

  return currentConfig;
}

export async function getGlobalGitConfig(): Promise<{ userName: string; email: string; signingKey: string }> {
  Logger.instance.logDebug("GitConfig", "Reading global git config", {});
  const git: SimpleGit = simpleGit();
  const rawUserName = await git.getConfig("user.name", "global");
  const rawEmail = await git.getConfig("user.email", "global");
  const rawSigningKey = await git.getConfig("user.signingkey", "global");

  const currentConfig = {
    userName: rawUserName.value || "",
    email: rawEmail.value || "",
    signingKey: rawSigningKey.value || "",
  };

  Logger.instance.logDebug("GitConfig", "Global git config retrieved", {
    userName: currentConfig.userName,
    email: currentConfig.email,
    hasSigningKey: !!currentConfig.signingKey
  });

  return currentConfig;
}

export async function updateGitConfig(gitFolder: string, profile: Profile) {
  Logger.instance.logDebug("GitConfig", "Updating local git config", {
    folder: basename(gitFolder),
    profileLabel: profile.label,
    userName: profile.userName,
    email: profile.email,
    hasSigningKey: !!profile.signingKey
  });

  const git = simpleGit(gitFolder);
  await git.addConfig("user.name", profile.userName, false, "local");
  await git.addConfig("user.email", profile.email, false);
  await git.addConfig("user.signingkey", profile.signingKey, false, "local");

  Logger.instance.logInfo(`Git config updated for '${basename(gitFolder)}' with profile '${profile.label}'`);
}

export async function isGitRepository(path: string): Promise<boolean> {
  try {
    const isRepo = await simpleGit(path).checkIsRepo();
    Logger.instance.logDebug("GitRepository", "Git repository check", {
      path: basename(path),
      isRepository: isRepo
    });
    return isRepo;
  } catch (error) {
    Logger.instance.logDebug("GitRepository", "Git repository check failed", {
      path: basename(path),
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

export enum WorkspaceStatus {
  ConfigOutofSync,
  FieldsMissing,
  NoProfilesInConfig,
  NoSelectedProfilesInConfig,
  NotAValidWorkspace,
  NoIssues,
}

export async function validateWorkspace(result: { status: WorkspaceStatus; message?: string }): Promise<boolean> {
  //TODO: Show error if the user deliberately deletes the username or email property from config
  if (result.status === WorkspaceStatus.FieldsMissing) {
    vscode.window.showErrorMessage(result.message || "One of label, userName or email properties is missing in the config. Please verify.");
    await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "missing field in profile");
    return false;
  }

  if (result.status === WorkspaceStatus.NoProfilesInConfig) {
    //if no profiles in config, prompt user to create (even if its non git workspace)
    const selected = await vscode.window.showInformationMessage("No user profiles defined. Do you want to define one now?", "Yes", "No");
    if (selected === "Yes") {
      await vscode.commands.executeCommand(constants.CommandIds.CREATE_USER_PROFILE);
    }
    return false;
  }
  return true;
}

export async function getWorkspaceStatus(): Promise<{
  status: WorkspaceStatus;
  message?: string;
  selectedProfile?: Profile;
  profilesInVSConfigCount?: number;
  configInSync?: boolean;
  currentFolder?: string;
}> {
  // Check cache first
  const now = Date.now();
  if (workspaceStatusCache && now - workspaceStatusCache.timestamp < CACHE_DURATION_MS) {
    const cacheAge = now - workspaceStatusCache.timestamp;
    Logger.instance.logDebug("Cache", "Returning cached workspace status", {
      cacheAgeMs: cacheAge,
      status: WorkspaceStatus[workspaceStatusCache.status],
      configInSync: workspaceStatusCache.configInSync,
      selectedProfile: workspaceStatusCache.selectedProfile?.label
    });
    return {
      status: workspaceStatusCache.status,
      message: workspaceStatusCache.message,
      selectedProfile: workspaceStatusCache.selectedProfile,
      profilesInVSConfigCount: workspaceStatusCache.profilesInVSConfigCount,
      configInSync: workspaceStatusCache.configInSync,
      currentFolder: workspaceStatusCache.currentFolder,
    };
  }

  const result = await getCurrentFolder();
  if (!result.result) {
    Logger.instance.logDebug("WorkspaceStatus", "No valid workspace folder", {
      message: result.message
    });
    const statusResult = {
      status: WorkspaceStatus.NotAValidWorkspace,
      message: result.message || Messages.NOT_A_VALID_REPO,
    };
    // Cache the result
    workspaceStatusCache = { ...statusResult, timestamp: Date.now() };
    return statusResult;
  }
  const folder = result.result as string;
  const isGitRepo = await isGitRepository(folder);
  if (!isGitRepo) {
    Logger.instance.logDebug("WorkspaceStatus", "Folder is not a git repository", {
      folder: basename(folder)
    });
    const statusResult = {
      status: WorkspaceStatus.NotAValidWorkspace,
      message: Messages.NOT_A_VALID_REPO,
    };
    // Cache the result
    workspaceStatusCache = { ...statusResult, timestamp: Date.now() };
    return statusResult;
  }
  // if control reaches here, we have a valid git repo

  const profilesInVscConfig = getProfilesInSettings();
  //migrate all old profiles to new format
  await migrateOldProfilesToNew(profilesInVscConfig);

  const selectedProfileInVscConfig = profilesInVscConfig.filter((x) => x.selected === true) || [];
  const selectedVscProfile: Profile | undefined = selectedProfileInVscConfig.length > 0 ? selectedProfileInVscConfig[0] : undefined;
  const currentGitConfig = await getCurrentGitConfig(folder);

  if (profilesInVscConfig.length === 0) {
    // user does not have any profile defined in settings
    Logger.instance.logInfo(`No profiles found in settings.`);
    const statusResult = {
      status: WorkspaceStatus.NoProfilesInConfig,
      message: "No profiles found in settings.",
      profilesInVSConfigCount: 0,
      selectedProfile: selectedVscProfile,
      configInSync: false,
      currentFolder: folder,
    };
    // Cache the result
    workspaceStatusCache = { ...statusResult, timestamp: Date.now() };
    return statusResult;
  }
  if (selectedProfileInVscConfig.length === 0) {
    // user does not have have any profile selected in settings
    Logger.instance.logInfo(`No profiles selected in settings.`);
    const statusResult = {
      status: WorkspaceStatus.NoSelectedProfilesInConfig,
      message: "No profiles selected in settings.",
      profilesInVSConfigCount: profilesInVscConfig.length,
      selectedProfile: selectedVscProfile,
      configInSync: false,
      currentFolder: folder,
    };
    // Cache the result
    workspaceStatusCache = { ...statusResult, timestamp: Date.now() };
    return statusResult;
  }
  if (selectedVscProfile && (selectedVscProfile.label === undefined || selectedVscProfile.userName === undefined || selectedVscProfile.email === undefined)) {
    // user has a profile selected but one of the properties is missing
    Logger.instance.logInfo(`One of label, userName or email properties is missing in the config.`);
    const statusResult = {
      status: WorkspaceStatus.FieldsMissing,
      message: "One of label, userName or email properties is missing in the config. Please verify.",
      profilesInVSConfigCount: profilesInVscConfig.length,
      selectedProfile: selectedVscProfile,
      configInSync: false,
      currentFolder: folder,
    };
    // Cache the result
    workspaceStatusCache = { ...statusResult, timestamp: Date.now() };
    return statusResult;
  }
  // if the current config patches one of the profiles in the defined profiles, we should select it automatically. In case of multiple matches, we should select the first one. This will avoid user to select the profile manually.
  const matchedProfileToLocalConfig = profilesInVscConfig.find(
    (x) => x.userName === currentGitConfig.userName && x.email === currentGitConfig.email && x.signingKey === currentGitConfig.signingKey
  );
  const selectMatchedProfileAutomatically = await vscode.workspace.getConfiguration("gitConfigUser").get("selectMatchedProfileAutomatically");

  if (matchedProfileToLocalConfig) {
    Logger.instance.logDebug("ProfileMatch", "Found matching profile for current git config", {
      matchedProfile: matchedProfileToLocalConfig.label,
      autoSelectEnabled: selectMatchedProfileAutomatically === true,
      currentSelectedProfile: selectedVscProfile?.label
    });
  }

  if (matchedProfileToLocalConfig && selectMatchedProfileAutomatically === true) {
    if (selectedVscProfile && selectedVscProfile.id !== matchedProfileToLocalConfig.id) {
      // if matching profile exists, but the selected profile is different, we should select matched profile automatically
      Logger.instance.logInfo(`Auto-selecting matching profile '${matchedProfileToLocalConfig.label}' for '${basename(folder)}'`);
      await vscode.workspace.getConfiguration("gitConfigUser").update(
        "profiles",
        profilesInVscConfig.map((x) => ({ ...x, selected: x.id === matchedProfileToLocalConfig.id })),
        true
      );
      const statusResult = {
        status: WorkspaceStatus.NoIssues,
        message: "",
        profilesInVSConfigCount: profilesInVscConfig.length,
        selectedProfile: matchedProfileToLocalConfig,
        configInSync: true,
        currentFolder: folder,
      };
      // Invalidate cache when we update the configuration
      // Don't cache this result as it's a transient state
      return statusResult;
    }
  }
  const configInSync = util.isConfigInSync(currentGitConfig, selectedVscProfile);

  Logger.instance.logDebug("WorkspaceStatus", "Workspace status evaluated", {
    folder: basename(folder),
    selectedProfile: selectedVscProfile?.label,
    configInSync: configInSync.result,
    totalProfiles: profilesInVscConfig.length
  });

  if (!configInSync.result) {
    Logger.instance.logWarning("Git config is out of sync with selected profile", {
      folder: basename(folder),
      selectedProfile: selectedVscProfile?.label,
      reason: configInSync.message
    });
    const statusResult = {
      status: WorkspaceStatus.ConfigOutofSync,
      message: configInSync.message || "Git config is not in sync with the selected profile.",
      profilesInVSConfigCount: profilesInVscConfig.length,
      selectedProfile: selectedVscProfile,
      configInSync: configInSync.result,
      currentFolder: folder,
    };
    // Cache the result
    workspaceStatusCache = { ...statusResult, timestamp: Date.now() };
    return statusResult;
  }
  const statusResult = {
    status: WorkspaceStatus.NoIssues,
    message: "",
    profilesInVSConfigCount: profilesInVscConfig.length,
    selectedProfile: selectedVscProfile,
    configInSync: configInSync.result,
    currentFolder: folder,
  };
  // Cache the result
  workspaceStatusCache = { ...statusResult, timestamp: Date.now() };
  return statusResult;
}
async function migrateOldProfilesToNew(profilesInVscConfig: Profile[]) {
  let saveConfig = false;
  profilesInVscConfig.forEach((x) => {
    if (x.id === undefined || x.id === "" || x.signingKey == undefined || x.signingKey == null) {
      saveConfig = true;
    }
    if (!x.id) {
      x.id = uuidv4();
    }
    if (!x.signingKey) {
      x.signingKey = "";
    }
  });
  if (saveConfig) {
    await vscode.workspace.getConfiguration("gitConfigUser").update("profiles", profilesInVscConfig, true);
  }
}
