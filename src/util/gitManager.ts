import { basename, dirname } from "path";
import { simpleGit, SimpleGit } from "simple-git";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import { Result } from "../commands/ICommand";
import { getProfilesInSettings, getSelectedProfileId, setSelectedProfileId } from "../config";
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
  currentGitConfig?: { userName: string; email: string; signingKey: string };
  timestamp: number;
}

// Cache is now per-folder to support multi-root workspaces
const workspaceStatusCacheMap = new Map<string, WorkspaceStatusCache>();
const CACHE_DURATION_MS = 1000; // Cache valid for 1 second

export function invalidateWorkspaceStatusCache(folder?: string): void {
  if (folder) {
    // Invalidate cache for specific folder
    const hadCache = workspaceStatusCacheMap.has(folder);
    workspaceStatusCacheMap.delete(folder);
    Logger.instance.logDebug("Cache", "Workspace status cache invalidated for folder", {
      folder: basename(folder),
      hadCache
    });
  } else {
    // Invalidate all caches
    const cacheSize = workspaceStatusCacheMap.size;
    workspaceStatusCacheMap.clear();
    Logger.instance.logDebug("Cache", "All workspace status caches invalidated", {
      clearedEntries: cacheSize
    });
  }
}

async function getCurrentFolder(): Promise<Result<string | undefined>> {
  const editor = vscode.window.activeTextEditor;
  let folder: vscode.WorkspaceFolder | undefined;

  if (!vscode.workspace.workspaceFolders) {
    Logger.instance.logDebug("CurrentFolder", "No workspace folders available", {});
    return {
      result: undefined,
      message: Messages.NOT_A_VALID_REPO,
    };
  }

  if (vscode.workspace.workspaceFolders.length === 0) {
    Logger.instance.logDebug("CurrentFolder", "Workspace folders array is empty", {});
    return {
      result: undefined,
      message: "No workspace folder found.",
    };
  }

  Logger.instance.logDebug("CurrentFolder", "Workspace folders available", {
    count: vscode.workspace.workspaceFolders.length,
    folders: vscode.workspace.workspaceFolders.map(f => f.uri.fsPath)
  });

  if (editor) {
    // If we have a file:// resource we resolve the WorkspaceFolder this file is from and update
    // the status accordingly.
    const resource = editor.document.uri;

    Logger.instance.logDebug("CurrentFolder", "Active editor detected", {
      fileName: editor.document.fileName,
      scheme: resource.scheme
    });

    // Handle non-file schemes
    if (resource.scheme !== "file") {
      Logger.instance.logDebug("CurrentFolder", "Non-file scheme detected", {
        scheme: resource.scheme,
        path: resource.fsPath
      });

      // For vscode-notebook-cell (Jupyter notebooks), we can still get the file path
      // and show git profile information even though we can't edit the notebook metadata
      if (resource.scheme === "vscode-notebook-cell") {
        // Notebook cells have a fragment with the cell path, but fsPath gives us the notebook file
        const notebookPath = resource.fsPath;
        if (notebookPath) {
          const notebookDir = dirname(notebookPath);
          Logger.instance.logDebug("CurrentFolder", "Using notebook directory for git search", {
            notebookPath,
            notebookDir
          });
          return {
            result: notebookDir,
            message: "",
          };
        }
      }

      // For other non-file schemes (output, settings, etc.), silently hide
      return {
        result: undefined,
        message: "",  // Empty message to indicate silent hide
      };
    }

    folder = vscode.workspace.getWorkspaceFolder(resource);
    if (!folder) {
      Logger.instance.logDebug("CurrentFolder", "File is not part of any workspace folder", {
        filePath: resource.fsPath
      });
      return {
        result: undefined,
        message: "This file is not part of a workspace folder.",
      };
    }

    Logger.instance.logDebug("CurrentFolder", "Resolved workspace folder for file", {
      workspaceFolder: folder.uri.fsPath,
      filePath: resource.fsPath
    });

    // Return the file's directory path so git root search can traverse up from the actual file location
    // This allows the extension to work when a parent folder is opened that contains multiple git repos
    const filePath = resource.fsPath;
    const fileDir = dirname(filePath);

    Logger.instance.logDebug("CurrentFolder", "Using file directory for git search", {
      filePath,
      fileDir
    });

    return {
      result: fileDir,
      message: "",
    };
  } else {
    // No file is open in the editor
    // In this case, we cannot determine which git repo to use if there are multiple nested repos
    Logger.instance.logDebug("CurrentFolder", "No active editor", {
      workspaceFoldersCount: vscode.workspace.workspaceFolders.length
    });

    // Return undefined with a friendly message
    // The status bar will show this message instead of hiding
    return {
      result: undefined,
      message: "Open a file from a git repository", // Friendly message for status bar tooltip
    };
  }
}

export async function isValidWorkspace(): Promise<{ isValid: boolean; message: string; folder?: string }> {
  const result = await getCurrentFolder();
  if (!result.result) {
    return {
      message: result.message || Messages.NOT_A_VALID_REPO,
      isValid: false,
    };
  }
  const gitRoot = await getGitRoot(result.result as string);
  if (!gitRoot) {
    return {
      message: Messages.NOT_A_VALID_REPO,
      isValid: false,
    };
  }
  return {
    message: "",
    isValid: true,
    folder: gitRoot,
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

export async function getGitRoot(path: string): Promise<string | null> {
  try {
    Logger.instance.logDebug("GitRepository", "Searching for git repository", { path });

    const git = simpleGit(path);

    // Check if the path is inside a git repository (not necessarily the root)
    const isRepo = await git.checkIsRepo();

    if (!isRepo) {
      Logger.instance.logDebug("GitRepository", "Path is not within a git repository", { path });
      return null;
    }

    // Get the actual repository root by traversing up the directory tree
    // This works even if 'path' is not the repo root itself
    const root = (await git.revparse(['--show-toplevel'])).trim();

    Logger.instance.logInfo(`[GitRepository] Found git root: '${root}'`);

    return root;
  } catch (error) {
    Logger.instance.logDebug("GitRepository", "Could not find git root", {
      path,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export async function isGitRepository(path: string): Promise<boolean> {
  const root = await getGitRoot(path);
  return root !== null;
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
  currentGitConfig?: { userName: string; email: string; signingKey: string };
}> {
  const result = await getCurrentFolder();
  if (!result.result) {
    Logger.instance.logDebug("WorkspaceStatus", "No valid workspace folder", {
      message: result.message
    });
    const statusResult = {
      status: WorkspaceStatus.NotAValidWorkspace,
      message: result.message || Messages.NOT_A_VALID_REPO,
    };
    // Don't cache this as there's no folder to key on
    return statusResult;
  }
  const workspaceFolder = result.result as string;
  const gitRoot = await getGitRoot(workspaceFolder);
  if (!gitRoot) {
    Logger.instance.logDebug("WorkspaceStatus", "Folder is not a git repository", {
      folder: basename(workspaceFolder)
    });
    const statusResult = {
      status: WorkspaceStatus.NotAValidWorkspace,
      message: Messages.NOT_A_VALID_REPO,
    };
    // Don't cache this as there's no git root to key on
    return statusResult;
  }
  // if control reaches here, we have a valid git repo
  const folder = gitRoot;

  // Check cache for this specific folder
  const now = Date.now();
  const cached = workspaceStatusCacheMap.get(folder);
  if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
    const cacheAge = now - cached.timestamp;
    Logger.instance.logDebug("Cache", "Returning cached workspace status", {
      folder: basename(folder),
      cacheAgeMs: cacheAge,
      status: WorkspaceStatus[cached.status],
      configInSync: cached.configInSync,
      selectedProfile: cached.selectedProfile?.label
    });
    return {
      status: cached.status,
      message: cached.message,
      selectedProfile: cached.selectedProfile,
      profilesInVSConfigCount: cached.profilesInVSConfigCount,
      configInSync: cached.configInSync,
      currentFolder: cached.currentFolder,
      currentGitConfig: cached.currentGitConfig,
    };
  }

  const profilesInVscConfig = getProfilesInSettings();
  //migrate all old profiles to new format
  await migrateOldProfilesToNew(profilesInVscConfig);

  // Get workspace folder URI for this git root
  const vscWorkspaceFolder = vscode.workspace.workspaceFolders?.find(wf =>
    folder.startsWith(wf.uri.fsPath)
  );

  // Use the git root folder as the scope for reading settings, not the workspace folder
  // This ensures we read settings from the git repo's .vscode/settings.json
  const gitRootUri = vscode.Uri.file(folder);

  Logger.instance.logDebug("WorkspaceStatus", "Looking up workspace folder for git root", {
    gitRoot: folder,
    workspaceFolders: vscode.workspace.workspaceFolders?.map(wf => wf.uri.fsPath),
    matchedWorkspaceFolder: vscWorkspaceFolder?.uri.fsPath,
    gitRootUri: gitRootUri.fsPath
  });

  // Get selected profile using workspace-scoped setting (with fallback to legacy global selected flag)
  // Pass the git root URI instead of workspace folder URI to read settings from the git repo's .vscode/settings.json
  const selectedProfileId = getSelectedProfileId(gitRootUri);

  Logger.instance.logDebug("WorkspaceStatus", "Profile resolution", {
    selectedProfileId: selectedProfileId || "<none>",
    totalProfiles: profilesInVscConfig.length,
    profileIds: profilesInVscConfig.map(p => ({ id: p.id, label: p.label }))
  });

  const selectedVscProfile: Profile | undefined = selectedProfileId
    ? profilesInVscConfig.find(p => p.id === selectedProfileId)
    : undefined;

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
      currentGitConfig: currentGitConfig,
    };
    // Cache the result for this folder
    workspaceStatusCacheMap.set(folder, { ...statusResult, timestamp: Date.now() });
    return statusResult;
  }
  if (!selectedVscProfile) {
    // user does not have have any profile selected in settings
    Logger.instance.logInfo(`No profile selected in settings for this workspace.`);
    const statusResult = {
      status: WorkspaceStatus.NoSelectedProfilesInConfig,
      message: "No profile selected in settings for this workspace.",
      profilesInVSConfigCount: profilesInVscConfig.length,
      selectedProfile: selectedVscProfile,
      configInSync: false,
      currentFolder: folder,
      currentGitConfig: currentGitConfig,
    };
    // Cache the result for this folder
    workspaceStatusCacheMap.set(folder, { ...statusResult, timestamp: Date.now() });
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
      currentGitConfig: currentGitConfig,
    };
    // Cache the result for this folder
    workspaceStatusCacheMap.set(folder, { ...statusResult, timestamp: Date.now() });
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

      // Save the auto-selected profile to workspace scope (git root's .vscode/settings.json)
      if (matchedProfileToLocalConfig.id) {
        await setSelectedProfileId(matchedProfileToLocalConfig.id, gitRootUri);
      }

      const statusResult = {
        status: WorkspaceStatus.NoIssues,
        message: "",
        profilesInVSConfigCount: profilesInVscConfig.length,
        selectedProfile: matchedProfileToLocalConfig,
        configInSync: true,
        currentFolder: folder,
        currentGitConfig: currentGitConfig,
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
      currentGitConfig: currentGitConfig,
    };
    // Cache the result for this folder
    workspaceStatusCacheMap.set(folder, { ...statusResult, timestamp: Date.now() });
    return statusResult;
  }
  const statusResult = {
    status: WorkspaceStatus.NoIssues,
    message: "",
    profilesInVSConfigCount: profilesInVscConfig.length,
    selectedProfile: selectedVscProfile,
    configInSync: configInSync.result,
    currentFolder: folder,
    currentGitConfig: currentGitConfig,
  };
  // Cache the result for this folder
  workspaceStatusCacheMap.set(folder, { ...statusResult, timestamp: Date.now() });
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
