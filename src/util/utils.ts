import * as vscode from "vscode";
import { window } from "vscode";
import { Result } from "../commands/ICommand";
import { getProfilesInSettings, getVscProfile } from "../config";
import * as constants from "../constants";
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
    return constants.Messages.ENTER_A_VALID_STRING;
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
    return constants.Messages.ENTER_A_VALID_STRING;
  }
  return undefined;
}
export function validateEmail(input: string) {
  // More comprehensive email validation regex that supports:
  // - Plus addressing (user+tag@example.com)
  // - Dots in username (first.last@example.com)
  // - Multiple subdomains (user@mail.example.co.uk)
  // - Numbers and hyphens
  // Note: This is a practical regex, not full RFC 5322 compliant (which is extremely complex)
  const validEmail = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

  if (!validEmail.test(input)) {
    return "Invalid email format. Expected format: user@example.com (supports +, dots, and subdomains)";
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

/**
 * Normalizes a signing key by trimming whitespace and treating undefined, null, and empty string as equivalent.
 */
export function normalizeSigningKey(key: string | undefined): string {
  return (key || "").trim();
}

/**
 * Compares two profiles for equality based on userName, email, and signingKey.
 * Email comparison is case-insensitive. Signing keys are normalized before comparison.
 * Handles undefined/null values gracefully.
 */
export function profilesMatch(
  profile1: { email?: string; userName?: string; signingKey?: string },
  profile2: { email?: string; userName?: string; signingKey?: string }
): boolean {
  // Normalize empty/undefined values to empty strings for comparison
  const userName1 = (profile1.userName || "").trim();
  const userName2 = (profile2.userName || "").trim();
  const email1 = (profile1.email || "").trim().toLowerCase();
  const email2 = (profile2.email || "").trim().toLowerCase();

  return (
    userName1 === userName2 &&
    email1 === email2 &&
    normalizeSigningKey(profile1.signingKey) === normalizeSigningKey(profile2.signingKey)
  );
}

export function isConfigInSync(
  profile1?: { email: string; userName: string; signingKey: string },
  profile2?: { email: string; userName: string; signingKey: string }
): Result<boolean> {
  if (profile1 === null || profile1 === undefined || profile2 === null || profile2 === undefined) {
    return {
      result: false,
      message: "One of the profiles is undefined. Cannot compare.",
    };
  }

  // Check userName first
  if (profile1.userName !== profile2.userName) {
    return {
      result: false,
      message: `User names are different.`,
    };
  }

  // Check email (case-insensitive)
  if (profile1.email.toLowerCase() !== profile2.email.toLowerCase()) {
    return {
      result: false,
      message: `Emails are different.`,
    };
  }

  // Check signing key (normalized)
  if (normalizeSigningKey(profile1.signingKey) !== normalizeSigningKey(profile2.signingKey)) {
    return {
      result: false,
      message: `Signing keys are different.`,
    };
  }

  return {
    result: true,
    message: `Profiles are in sync.`,
  };
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
