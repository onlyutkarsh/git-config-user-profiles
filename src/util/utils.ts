import sgit from "simple-git";
import { window, workspace, WorkspaceFolder } from "vscode";
import { Result } from "../commands/ICommand";
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

export async function getCurrentFolder(): Promise<Result<boolean>> {
  const editor = window.activeTextEditor;
  let folder: WorkspaceFolder | undefined;
  if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
    return {
      result: false,
      message: Messages.NOT_A_VALID_REPO,
    };
  }
  if (editor) {
    // If we have a file:// resource we resolve the WorkspaceFolder this file is from and update
    // the status accordingly.
    const resource = editor.document.uri;
    if (resource.scheme !== "file") {
      return {
        result: false,
        message: "${resource.scheme} is not supported.",
      };
    }
    folder = workspace.getWorkspaceFolder(resource);
    if (!folder) {
      return {
        result: false,
        message: "This file is not part of a workspace folder.",
      };
    }
  } else {
    //if no file is open in the editor, we use the first workspace folder
    folder = workspace.workspaceFolders[0];
  }

  if (!folder) {
    return {
      result: false,
      message: Messages.NOT_A_VALID_REPO,
    };
  }
  return {
    result: true,
    message: folder.uri.fsPath,
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
  const isGitRepo = await isGitRepository(result.message as string);
  if (!isGitRepo) {
    return {
      message: Messages.NOT_A_VALID_REPO,
      isValid: false,
    };
  }
  return {
    message: "",
    isValid: true,
    folder: result.message as string,
  };
}

export function isEmpty(str: string | undefined | null) {
  return !str || 0 === str.length;
}

export async function getCurrentGitConfig(gitFolder: string): Promise<{ userName: string; email: string }> {
  Logger.instance.logInfo(`Getting details from config file in ${gitFolder}`);
  const git = sgit(gitFolder);
  const userName = await git.getConfig("user.name", "local");
  const email = await git.getConfig("user.email", "local");
  if (userName && email) {
    const currentConfig = {
      userName: userName.value || "",
      email: email.value || "",
    };
    Logger.instance.logInfo(`Config details found: ${JSON.stringify(currentConfig)}`);
    return currentConfig;
  }
  Logger.instance.logInfo(`No config details found.`);
  return { userName: "", email: "" };
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
      return `Profile with the same name '${input}' already exists!`;
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
    id: profile.id,
  };
}

export function hasSameNameAndEmail(profile1: { email: string; userName: string }, profile2: { email: string; userName: string }): boolean {
  return profile1.email.toLowerCase() === profile2.email.toLowerCase() && profile1.userName.toLowerCase() === profile2.userName.toLowerCase();
}

export function isNameAndEmailEmpty(profile: { email: string; userName: string }): boolean {
  return !(profile.email || profile.userName);
}
