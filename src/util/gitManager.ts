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
    if (resource.scheme !== "file") {
      return {
        result: undefined,
        message: `Resource of type '${resource.scheme}' is not supported. Ensure cursor is in the editor.`,
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
  Logger.instance.logInfo(`Getting details from config file of '${basename(gitFolder)}'`);
  const git: SimpleGit = simpleGit(gitFolder);
  const rawUserName = await git.getConfig("user.name", "local");
  const rawEmail = await git.getConfig("user.email", "local");
  const rawSigningKey = await git.getConfig("user.signingkey", "local");

  const currentConfig = {
    userName: rawUserName.value || "",
    email: rawEmail.value || "",
    signingKey: rawSigningKey.value || "",
  };
  return currentConfig;
}

export async function getGlobalGitConfig(): Promise<{ userName: string; email: string; signingKey: string }> {
  Logger.instance.logInfo(`Getting details from global git config`);
  const git: SimpleGit = simpleGit();
  const rawUserName = await git.getConfig("user.name", "global");
  const rawEmail = await git.getConfig("user.email", "global");
  const rawSigningKey = await git.getConfig("user.signingkey", "global");

  const currentConfig = {
    userName: rawUserName.value || "",
    email: rawEmail.value || "",
    signingKey: rawSigningKey.value || "",
  };
  return currentConfig;
}

export async function updateGitConfig(gitFolder: string, profile: Profile) {
  const git = simpleGit(gitFolder);
  await git.addConfig("user.name", profile.userName, false, "local");
  await git.addConfig("user.email", profile.email, false);
  await git.addConfig("user.signingkey", profile.signingKey, false, "local");
}

export async function isGitRepository(path: string): Promise<boolean> {
  try {
    return await simpleGit(path).checkIsRepo();
  } catch (error) {
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
  const result = await getCurrentFolder();
  if (!result.result) {
    return {
      status: WorkspaceStatus.NotAValidWorkspace,
      message: result.message || Messages.NOT_A_VALID_REPO,
    };
  }
  const folder = result.result as string;
  const isGitRepo = await isGitRepository(folder);
  if (!isGitRepo) {
    return {
      status: WorkspaceStatus.NotAValidWorkspace,
      message: Messages.NOT_A_VALID_REPO,
    };
  }
  // if control reaches here, we have a valid git repo

  const profilesInVscConfig = getProfilesInSettings();
  //migrate all old profiles to new format
  await migrateOldProfilesToNew(profilesInVscConfig);

  const selectedProfileInVscConfig = profilesInVscConfig.filter((x) => x.selected === true) || [];
  const selectedVscProfile: Profile | undefined = selectedProfileInVscConfig.length > 0 ? selectedProfileInVscConfig[0] : undefined;
  const currentGitConfig = await getCurrentGitConfig(folder);
  const globalGitConfig = await getGlobalGitConfig();

  if (profilesInVscConfig.length === 0) {
    // user does not have any profile defined in settings
    Logger.instance.logInfo(`No profiles found in settings.`);
    return {
      status: WorkspaceStatus.NoProfilesInConfig,
      message: "No profiles found in settings.",
      profilesInVSConfigCount: 0,
      selectedProfile: selectedVscProfile,
      configInSync: false,
      currentFolder: folder,
    };
  }
  if (selectedProfileInVscConfig.length === 0) {
    // user does not have have any profile selected in settings
    Logger.instance.logInfo(`No profiles selected in settings.`);
    return {
      status: WorkspaceStatus.NoSelectedProfilesInConfig,
      message: "No profiles selected in settings.",
      profilesInVSConfigCount: profilesInVscConfig.length,
      selectedProfile: selectedVscProfile,
      configInSync: false,
      currentFolder: folder,
    };
  }
  if (selectedVscProfile && (selectedVscProfile.label === undefined || selectedVscProfile.userName === undefined || selectedVscProfile.email === undefined)) {
    // user has a profile selected but one of the properties is missing
    Logger.instance.logInfo(`One of label, userName or email properties is missing in the config.`);
    return {
      status: WorkspaceStatus.FieldsMissing,
      message: "One of label, userName or email properties is missing in the config. Please verify.",
      profilesInVSConfigCount: profilesInVscConfig.length,
      selectedProfile: selectedVscProfile,
      configInSync: false,
      currentFolder: folder,
    };
  }
  // if the current config patches one of the profiles in the defined profiles, we should select it automatically. In case of multiple matches, we should select the first one.
  const matchedProfileToLocalConfig = profilesInVscConfig.find(
    (x) => x.userName === currentGitConfig.userName && x.email === currentGitConfig.email && x.signingKey === currentGitConfig.signingKey
  );
  if (matchedProfileToLocalConfig) {
    if (selectedVscProfile && selectedVscProfile.id !== matchedProfileToLocalConfig.id) {
      // if the current config matches one of the profiles in the defined profiles, we should select it automatically. In case of multiple matches, we should select the first one.
      Logger.instance.logInfo(`Current git config matches one of the profiles in the defined profiles. Selecting it automatically.`);
      await vscode.workspace.getConfiguration("gitConfigUser").update(
        "profiles",
        profilesInVscConfig.map((x) => ({ ...x, selected: x.id === matchedProfileToLocalConfig.id })),
        true
      );
      return {
        status: WorkspaceStatus.NoIssues,
        message: "",
        profilesInVSConfigCount: profilesInVscConfig.length,
        selectedProfile: matchedProfileToLocalConfig,
        configInSync: true,
        currentFolder: folder,
      };
    }
  }
  const configInSync = util.isConfigInSync(currentGitConfig, selectedVscProfile);

  if (!configInSync.result) {
    return {
      status: WorkspaceStatus.ConfigOutofSync,
      message: configInSync.message || "Git config is not in sync with the selected profile.",
      profilesInVSConfigCount: profilesInVscConfig.length,
      selectedProfile: selectedVscProfile,
      configInSync: configInSync.result,
      currentFolder: folder,
    };
  }
  return {
    status: WorkspaceStatus.NoIssues,
    message: "",
    profilesInVSConfigCount: profilesInVscConfig.length,
    selectedProfile: selectedVscProfile,
    configInSync: configInSync.result,
    currentFolder: folder,
  };
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
