import gitconfig from "gitconfiglocal";
import sgit from "simple-git";
import { window, workspace, WorkspaceFolder } from "vscode";
import { Messages } from "../constants";
import { Profile } from "../models";
import { Logger } from "../util";
import { getVscProfile } from "./../config";

export async function isGitRepository(path: string): Promise<boolean> {
  try {
    return await sgit(path).checkIsRepo();
  } catch (error) {
    return false;
  }
}

export async function getCurrentFolder(): Promise<string | undefined> {
  const editor = window.activeTextEditor;
  let folder: WorkspaceFolder | undefined;
  if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
    return undefined;
  }
  if (editor) {
    // If we have a file:// resource we resolve the WorkspaceFolder this file is from and update
    // the status accordingly.
    const resource = editor.document.uri;
    if (resource.scheme !== "file") {
      return undefined;
    }
    folder = workspace.getWorkspaceFolder(resource);
  } else {
    //if no file is open in the editor, we use the first workspace folder
    folder = workspace.workspaceFolders[0];
  }

  if (!folder) {
    return undefined;
  }
  return folder.uri.fsPath;
}

export async function isValidWorkspace(): Promise<{ isValid: boolean; message: string; folder?: string }> {
  const folderPath = await getCurrentFolder();
  if (!folderPath) {
    return {
      message: Messages.OPEN_REPO_FIRST,
      isValid: false,
    };
  }
  const isGitRepo = await isGitRepository(folderPath);
  if (!isGitRepo) {
    return {
      message: Messages.NOT_A_VALID_REPO,
      isValid: false,
    };
  }
  return {
    message: "",
    isValid: true,
    folder: folderPath,
  };
}

export function isEmpty(str: string | undefined | null) {
  return !str || 0 === str.length;
}

export async function getCurrentGitConfig(gitFolder: string): Promise<{ userName: string; email: string }> {
  Logger.instance.logInfo(`Getting details from config file in ${gitFolder}`);
  return await new Promise((resolve) => {
    gitconfig(gitFolder, (_, config) => {
      if (config.user && config.user.name && config.user.email) {
        const currentConfig = {
          userName: config.user.name,
          email: config.user.email,
        };
        Logger.instance.logInfo(`Config details found: ${JSON.stringify(currentConfig)}`);
        resolve(currentConfig);
      } else {
        Logger.instance.logInfo(`No config details found.`);
        resolve({ userName: "", email: "" });
      }
    });
  });
}

export function trimLabelIcons(str: string) {
  if (str) {
    return str.replace("$(check)", "").trim();
  } else {
    return str;
  }
}

export function isBlank(str: string) {
  return !str || /^\s*$/.test(str);
}

export function validateProfileName(input: string, checkForDuplicates = true) {
  if (isEmpty(input) || isBlank(input)) {
    return Messages.ENTER_A_VALID_STRING;
  }
  if (checkForDuplicates) {
    const existingProfile = getVscProfile(input);
    if (existingProfile) {
      return `Oops! Profile with the same name '${input}' already exists!`;
    }
  }
  return undefined;
}

export function validateUserName(input: string) {
  if (isEmpty(input) || isBlank(input)) {
    return Messages.ENTER_A_VALID_STRING;
  }
  return undefined;
}

export function validateEmail(input: string) {
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!validEmail.test(input)) {
    return Messages.NOT_A_VALID_EMAIL;
  }
  return undefined;
}

export function trimProperties(profile: Profile): Profile {
  return <Profile>{
    label: profile.label.replace("$(check)", "").trim(),
    email: profile.email.trim(),
    userName: profile.userName.trim(),
    selected: profile.selected,
    detail: undefined,
  };
}

export function hasSameNameAndEmail(profile1: { email: string; userName: string }, profile2: { email: string; userName: string }): boolean {
  return profile1.email.toLowerCase() === profile2.email.toLowerCase() && profile1.userName.toLowerCase() === profile2.userName.toLowerCase();
}

export function isNameAndEmailEmpty(profile: { email: string; userName: string }): boolean {
  return !(profile.email || profile.userName);
}
