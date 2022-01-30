import gitconfig from "gitconfiglocal";
import sgit from "simple-git";
import { workspace } from "vscode";
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

export async function isValidWorkspace(): Promise<{ isValid: boolean; message: string; folder?: string }> {
  if (workspace.workspaceFolders) {
    const foldersCount = workspace.workspaceFolders.length;
    if (foldersCount > 1) {
      return {
        message: Messages.DOES_NOT_SUPPORT_MULTI_ROOT,
        isValid: false,
      };
    }
    if (foldersCount === 0) {
      return {
        message: Messages.OPEN_REPO_FIRST,
        isValid: false,
      };
    }
    if (foldersCount === 1) {
      const folderPath = workspace.workspaceFolders[0].uri.fsPath;

      const validGitRepo = await isGitRepository(folderPath);

      if (!validGitRepo) {
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
  }
  return {
    message: Messages.NOT_A_VALID_REPO,
    isValid: false,
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
