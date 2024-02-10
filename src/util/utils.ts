import { basename } from "path";
import sgit from "simple-git";
import { window, workspace, WorkspaceFolder } from "vscode";
import { Result } from "../commands/ICommand";
import { getProfilesInSettings, getVscProfile, saveVscProfile } from "../config";
import { Messages } from "../constants";
import * as controls from "../controls";
import { Profile } from "../models";
import * as util from "../util";
import { Logger } from "../util";

export async function isGitRepository(path: string): Promise<boolean> {
  try {
    return await sgit(path).checkIsRepo();
  } catch (error) {
    return false;
  }
}

async function getCurrentFolder(): Promise<Result<string>> {
  const editor = window.activeTextEditor;
  let folder: WorkspaceFolder | undefined;
  if (!workspace.workspaceFolders) {
    return {
      result: "",
      message: Messages.NOT_A_VALID_REPO,
    };
  }
  if (workspace.workspaceFolders.length === 0) {
    return {
      result: "",
      message: "No workspace folder found.",
    };
  }
  if (editor) {
    // If we have a file:// resource we resolve the WorkspaceFolder this file is from and update
    // the status accordingly.
    const resource = editor.document.uri;
    if (resource.scheme !== "file") {
      return {
        result: "",
        message: `${resource.scheme} is not supported.`,
      };
    }
    folder = workspace.getWorkspaceFolder(resource);
    if (!folder) {
      return {
        result: "",
        message: "This file is not part of a workspace folder.",
      };
    }
  } else {
    //if no file is open in the editor, we use the first workspace folder
    folder = workspace.workspaceFolders[0];
  }

  if (!folder) {
    return {
      result: "",
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
  if (result.result && result.result === "") {
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

export function isEmpty(str: string | undefined | null) {
  return !str || 0 === str.length;
}

export async function getCurrentGitConfig(gitFolder: string): Promise<{ userName: string; email: string; signingKey: string }> {
  Logger.instance.logInfo(`Getting details from config file of '${basename(gitFolder)}'`);
  const git = sgit(gitFolder);
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

export async function updateGitConfig(gitFolder: string, profile: Profile) {
  const git = sgit(gitFolder);
  await git.addConfig("user.name", profile.userName, false, "local");
  await git.addConfig("user.email", profile.email, false);
  await git.addConfig("user.signingkey", profile.signingKey, false, "local");
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
    signingKey: profile.signingKey.trim(),
  };
}

export function isConfigInSync(profile1: { email: string; userName: string; signingKey: string }, profile2: { email: string; userName: string; signingKey: string }): boolean {
  return (
    !isNameAndEmailEmpty(profile1) &&
    profile1.email.toLowerCase() === profile2.email.toLowerCase() &&
    profile1.userName.toLowerCase() === profile2.userName.toLowerCase() &&
    profile1.signingKey.toLowerCase() === profile2.signingKey.toLowerCase()
  );
}

export function isNameAndEmailEmpty(profile: { email: string; userName: string }): boolean {
  return !(profile.email || profile.userName);
}

export async function showProfilePicker() {
  const profilesInVscConfig = getProfilesInSettings();

  //show picklist only if no profile is marked as selected in config.
  //this can happen only when setting up config for the first time or user deliberately changed config
  const pickedProfile = await window.showQuickPick<Profile>(
    profilesInVscConfig.map((x) => {
      return {
        label: x.label,
        userName: x.userName,
        email: x.email,
        selected: x.selected,
        detail: `${x.userName} (${x.email}) `,
        id: x.id,
        signingKey: x.signingKey,
      };
    }),
    {
      canPickMany: false,
      matchOnDetail: false,
      ignoreFocusOut: true,
      placeHolder: "Select a user profile.",
    }
  );
  return {
    result: pickedProfile,
  };
}

export async function loadProfileInWizard(preloadedProfile: Profile): Promise<Profile> {
  const createNewProfile = false;
  const state: Partial<controls.State> = {
    // give existing profile as default values to the state for editing
    profileEmail: preloadedProfile.email,
    profileUserName: preloadedProfile.userName,
    profileName: preloadedProfile.label || "",
    profileId: preloadedProfile.id,
    profileSelected: preloadedProfile.selected,
    profileSigningKey: preloadedProfile.signingKey,
  };
  await controls.MultiStepInput.run(async (input) => await pickProfileName(input, state, createNewProfile));
  const profile: Profile = {
    label: state.profileName || "",
    userName: state.profileUserName || "",
    email: state.profileEmail || "",
    selected: state.profileSelected || false,
    detail: undefined,
    id: state.profileId || "",
    signingKey: state.profileSigningKey || "",
  };
  await saveVscProfile(profile);
  return profile;
}
export async function createProfileWithWizard(): Promise<Profile> {
  const createNewProfile = true;
  const state: Partial<controls.State> = {};
  await controls.MultiStepInput.run(async (input) => await pickProfileName(input, state, createNewProfile));
  const profile: Profile = new Profile(state.profileName || "Unknown", state.profileUserName || "", state.profileEmail || "", false, state.profileSigningKey || "");
  await saveVscProfile(profile);
  return profile;
}
async function shouldResume() {
  // Could show a notification with the option to resume.
  return new Promise<boolean>(() => {});
}

async function pickProfileName(input: controls.MultiStepInput, state: Partial<controls.State>, create = true) {
  state.profileName = await input.showInputBox({
    title: create ? "Create a profile" : "Edit profile",
    step: 1,
    totalSteps: 4,
    prompt: "Enter name for the profile",
    value: state.profileName || "",
    placeholder: "Work",
    validate: (input) => util.validateProfileName(input, create),
    shouldResume: shouldResume,
    ignoreFocusOut: true,
  });
  return (input: controls.MultiStepInput) => pickUserName(input, state, create);
}

async function pickUserName(input: controls.MultiStepInput, state: Partial<controls.State>, create = true) {
  state.profileUserName = await input.showInputBox({
    title: create ? "Create a profile" : "Edit profile",
    step: 2,
    totalSteps: 4,
    prompt: "Enter the user name",
    value: state.profileUserName || "",
    placeholder: "John Smith",
    validate: util.validateUserName,
    shouldResume: shouldResume,
    ignoreFocusOut: true,
  });
  return (input: controls.MultiStepInput) => pickEmail(input, state, create);
}

async function pickEmail(input: controls.MultiStepInput, state: Partial<controls.State>, create = true) {
  state.profileEmail = await input.showInputBox({
    title: create ? "Create a profile" : "Edit profile",
    step: 3,
    totalSteps: 4,
    prompt: "Enter the email",
    value: state.profileEmail || "",
    placeholder: "john.smith@myorg.com",
    validate: util.validateEmail,
    shouldResume: shouldResume,
    ignoreFocusOut: true,
  });
  return (input: controls.MultiStepInput) => pickSigningKey(input, state, create);
}

async function pickSigningKey(input: controls.MultiStepInput, state: Partial<controls.State>, create = true) {
  state.profileSigningKey = await input.showInputBox({
    title: create ? "Create a profile" : "Edit profile",
    step: 4,
    totalSteps: 4,
    prompt: "Enter the signing key (optional)",
    value: state.profileSigningKey || "",
    placeholder: "MY_SIGNING_KEY",
    validate: () => undefined,
    shouldResume: shouldResume,
    ignoreFocusOut: true,
  });
}
