import * as vscode from "vscode";
import { window } from "vscode";
import { getProfilesInSettings, getVscProfile } from "../config";
import { Messages } from "../constants";
import * as controls from "../controls";
import { Profile } from "../models";
import * as util from "../util";

export function isEmpty(str: string | undefined | null) {
  return !str || 0 === str.length;
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
    signingKey: profile.signingKey?.trim(),
  };
}
export function isConfigInSync(profile1?: { email: string; userName: string; signingKey: string }, profile2?: { email: string; userName: string; signingKey: string }): boolean {
  if (!profile1 || !profile2) {
    return false;
  }
  let userNameSame = false;
  let emailSame = false;
  let signingKeySame = false;
  if (profile1.userName && profile2.userName) {
    userNameSame = profile1.userName.toLowerCase() === profile2.userName.toLowerCase();
  }
  if (profile1.email && profile2.email) {
    emailSame = profile1.email.toLowerCase() === profile2.email.toLowerCase();
  }
  if (profile1.signingKey && profile2.signingKey) {
    signingKeySame = profile1.signingKey.toLowerCase() === profile2.signingKey.toLowerCase();
  }
  if (profile1.signingKey === undefined || profile2.signingKey === undefined || profile1.signingKey === "" || profile2.signingKey === "") {
    // backward compatibility with old profiles without signingKey
    // if any profile does not have signing key, user is comparing old vs new profile, dont compare signing key
    signingKeySame = true;
  }

  return userNameSame && emailSame && signingKeySame;
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

export async function deleteProfile(profile: Profile) {
  const profiles = getProfilesInSettings();
  let index = -1;
  if (profile.id) {
    index = profiles.findIndex((x) => x.id?.toLowerCase() === profile.id?.toLowerCase());
  } else {
    // for backward compatibility with old profiles without id
    index = profiles.findIndex((x) => x.label.toLowerCase() === profile.label.toLowerCase());
  }
  if (index > -1) {
    profiles.splice(index, 1);
    await vscode.workspace.getConfiguration("gitConfigUser").update("profiles", profiles, vscode.ConfigurationTarget.Global);
  }
}

export async function loadProfileInWizard(preloadedProfile: Profile): Promise<Profile> {
  const createNewProfile = false;
  const state: Partial<controls.State> = {
    // give existing profile as default values to the state for editing
    profileEmail: preloadedProfile.email,
    profileUserName: preloadedProfile.userName,
    profileName: preloadedProfile.label || "",
    profileId: preloadedProfile.id || "",
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
  //await saveVscProfile(profile);
  return profile;
}
export async function createProfileWithWizard(): Promise<Profile> {
  const createNewProfile = true;
  const state: Partial<controls.State> = {};
  await controls.MultiStepInput.run(async (input) => await pickProfileName(input, state, createNewProfile));
  const profile: Profile = new Profile(state.profileName || "Unknown", state.profileUserName || "", state.profileEmail || "", false, state.profileSigningKey || "");
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
