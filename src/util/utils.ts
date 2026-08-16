import * as vscode from "vscode";
import { window } from "vscode";
import { Result } from "../commands/ICommand";
import { getProfilesInSettings, getVscProfile } from "../config";
import * as constants from "../constants";
import * as controls from "../controls";
import { Profile } from "../models";
import * as util from "../util";
import { getGlobalGitConfig } from "./gitManager";

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
    commitGpgSign: profile.commitGpgSign,
    gpgFormat: profile.gpgFormat?.trim() || undefined,
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
  profile1: { email?: string; userName?: string; signingKey?: string; commitGpgSign?: boolean; gpgFormat?: string },
  profile2: { email?: string; userName?: string; signingKey?: string; commitGpgSign?: boolean; gpgFormat?: string }
): boolean {
  // Normalize empty/undefined values to empty strings for comparison
  const userName1 = (profile1.userName || "").trim();
  const userName2 = (profile2.userName || "").trim();
  const email1 = (profile1.email || "").trim().toLowerCase();
  const email2 = (profile2.email || "").trim().toLowerCase();

  return (
    userName1 === userName2 &&
    email1 === email2 &&
    normalizeSigningKey(profile1.signingKey) === normalizeSigningKey(profile2.signingKey) &&
    profile1.commitGpgSign === profile2.commitGpgSign &&
    (profile1.gpgFormat || undefined) === (profile2.gpgFormat || undefined)
  );
}

export function isConfigInSync(
  profile1?: { email: string; userName: string; signingKey: string; commitGpgSign?: boolean; gpgFormat?: string },
  profile2?: { email: string; userName: string; signingKey: string; commitGpgSign?: boolean; gpgFormat?: string }
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

  if (profile1.commitGpgSign !== profile2.commitGpgSign) {
    return {
      result: false,
      message: `Commit signing preferences are different.`,
    };
  }

  if ((profile1.gpgFormat || undefined) !== (profile2.gpgFormat || undefined)) {
    return {
      result: false,
      message: `GPG formats are different.`,
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
        commitGpgSign: x.commitGpgSign,
        gpgFormat: x.gpgFormat,
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
    const config = vscode.workspace.getConfiguration("gitConfigUser");

    profiles.splice(index, 1);
    await config.update("profiles", profiles, vscode.ConfigurationTarget.Global);
    await cleanupStaleWorkspaceProfileSelections();
  }
}

export async function cleanupStaleWorkspaceProfileSelections(): Promise<number> {
  const config = vscode.workspace.getConfiguration("gitConfigUser");
  const profiles = getProfilesInSettings();
  const validProfileIds = new Set(profiles.flatMap((profile) => (profile.id ? [profile.id] : [])));
  const selections = config.get<Record<string, string>>("workspaceProfileSelections") || {};
  const updatedSelections = Object.fromEntries(Object.entries(selections).filter(([, profileId]) => validProfileIds.has(profileId)));
  const removedCount = Object.keys(selections).length - Object.keys(updatedSelections).length;

  if (removedCount > 0) {
    await config.update("workspaceProfileSelections", updatedSelections, vscode.ConfigurationTarget.Global);
  }

  return removedCount;
}

export async function loadProfileInWizard(preloadedProfile: Profile): Promise<Profile> {
  const createNewProfile = false;
  const globalGitConfig = await getGlobalGitConfig();
  const state: Partial<controls.State> = {
    // give existing profile as default values to the state for editing
    profileEmail: preloadedProfile.email,
    profileUserName: preloadedProfile.userName,
    profileName: preloadedProfile.label || "",
    profileId: preloadedProfile.id || "",
    profileSelected: preloadedProfile.selected,
    profileSigningKey: preloadedProfile.signingKey,
    profileCommitGpgSign: preloadedProfile.commitGpgSign,
    profileGpgFormat: preloadedProfile.gpgFormat,
    globalSigningKey: globalGitConfig.signingKey,
    globalCommitGpgSign: globalGitConfig.commitGpgSign,
    globalGpgFormat: globalGitConfig.gpgFormat,
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
    commitGpgSign: state.profileCommitGpgSign,
    gpgFormat: state.profileGpgFormat,
  };
  //await saveVscProfile(profile);
  return profile;
}
export async function createProfileWithWizard(): Promise<Profile> {
  const createNewProfile = true;
  const globalGitConfig = await getGlobalGitConfig();
  const state: Partial<controls.State> = {
    globalSigningKey: globalGitConfig.signingKey,
    globalCommitGpgSign: globalGitConfig.commitGpgSign,
    globalGpgFormat: globalGitConfig.gpgFormat,
  };
  await controls.MultiStepInput.run(async (input) => await pickProfileName(input, state, createNewProfile));
  const profile: Profile = new Profile(
    state.profileName || "Unknown",
    state.profileUserName || "",
    state.profileEmail || "",
    false,
    state.profileSigningKey || "",
    undefined,
    state.profileCommitGpgSign,
    state.profileGpgFormat
  );
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
    totalSteps: 7,
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
    totalSteps: 7,
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
    totalSteps: 7,
    prompt: "Enter the email",
    value: state.profileEmail || "",
    placeholder: "john.smith@myorg.com",
    validate: util.validateEmail,
    shouldResume: shouldResume,
    ignoreFocusOut: true,
  });
  return (input: controls.MultiStepInput) => pickCommitGpgSign(input, state, create);
}
async function pickSigningKey(input: controls.MultiStepInput, state: Partial<controls.State>, create = true) {
  const globalSigningKeyDescription = state.globalSigningKey ? `Global signing key: ${state.globalSigningKey}` : "No global signing key is configured";
  const options: Array<vscode.QuickPickItem & { action: "global" | "copy-global" | "custom" }> = [
    { label: "$(globe) Use global Git signing key", description: globalSigningKeyDescription, action: "global" },
    ...(state.globalSigningKey
      ? [{ label: "$(copy) Copy global signing key to this profile", description: `Use ${state.globalSigningKey} for this profile`, action: "copy-global" as const }]
      : []),
    { label: "$(key) Set a signing key for this profile", description: "Enter a key to use with this profile", action: "custom" },
  ];
  const activeAction = state.profileSigningKey ? (state.profileSigningKey === state.globalSigningKey ? "copy-global" : "custom") : "global";
  const selected = (await input.showQuickPick({
    title: create ? "Create a profile" : "Edit profile",
    step: 6,
    totalSteps: 7,
    placeholder: create ? "Choose the signing key source" : "Do you want to copy or set a signing key for this profile?",
    items: options,
    activeItem: options.find((option) => option.action === activeAction),
    shouldResume: shouldResume,
  })) as (typeof options)[number];

  if (selected.action === "global") {
    state.profileSigningKey = "";
    return;
  }

  if (selected.action === "copy-global") {
    state.profileSigningKey = state.globalSigningKey || "";
    return;
  }

  const signingKeyHints: Record<string, { prompt: string; placeholder: string }> = {
    ssh: { prompt: "Enter the SSH public key (or path to it) used to sign commits", placeholder: "ssh-ed25519 AAAA... or ~/.ssh/id_ed25519.pub" },
    x509: { prompt: "Enter the X.509 signing key identity (matches a certificate in your keychain/smimesign store)", placeholder: "user@example.com" },
    openpgp: { prompt: "Enter the GPG key ID used to sign commits", placeholder: "0123ABCD or long key ID" },
  };
  const hint = signingKeyHints[state.profileGpgFormat || "openpgp"];

  state.profileSigningKey = await input.showInputBox({
    title: create ? "Create a profile" : "Edit profile",
    step: 7,
    totalSteps: 7,
    prompt: hint.prompt,
    value: state.profileSigningKey || "",
    placeholder: hint.placeholder,
    validate: () => undefined,
    shouldResume: shouldResume,
    ignoreFocusOut: true,
  });
  return;
}

async function pickCommitGpgSign(input: controls.MultiStepInput, state: Partial<controls.State>, create = true) {
  const globalSigningDescription = state.globalCommitGpgSign === undefined ? "Global commit.gpgSign is not set" : `Global commit.gpgSign is ${state.globalCommitGpgSign}`;
  const options: Array<vscode.QuickPickItem & { value?: boolean }> = [
    { label: "$(settings-gear) Use global Git setting", description: globalSigningDescription },
    { label: create ? "$(check) Sign commits for this profile" : "$(check) Enable signing for this profile", description: "Set commit.gpgSign to true", value: true },
    {
      label: create ? "$(circle-slash) Don't sign commits for this profile" : "$(circle-slash) Disable signing for this profile",
      description: "Set commit.gpgSign to false",
      value: false,
    },
  ];
  const activeItem = options.find((option) => option.value === state.profileCommitGpgSign);
  const selected = (await input.showQuickPick({
    title: create ? "Create a profile" : "Edit profile",
    step: 4,
    totalSteps: 7,
    placeholder: create ? "Choose the commit signing preference" : "Do you want to enable signing in this profile?",
    items: options,
    activeItem,
    shouldResume: shouldResume,
  })) as (typeof options)[number];
  state.profileCommitGpgSign = selected.value;

  if (selected.value === false) {
    state.profileSigningKey = "";
    return;
  }

  return (input: controls.MultiStepInput) => pickGpgFormat(input, state, create);
}

async function pickGpgFormat(input: controls.MultiStepInput, state: Partial<controls.State>, create = true) {
  const globalGpgFormatDescription = state.globalGpgFormat ? `Global gpg.format is ${state.globalGpgFormat}` : "Global gpg.format is not set (defaults to openpgp)";
  const options: Array<vscode.QuickPickItem & { value?: string }> = [
    { label: "$(settings-gear) Use global Git setting", description: globalGpgFormatDescription },
    { label: "$(key) openpgp (GPG key)", description: "Set gpg.format to openpgp", value: "openpgp" },
    { label: "$(key) ssh (SSH signing key)", description: "Set gpg.format to ssh", value: "ssh" },
    { label: "$(key) x509 (X.509 signing key)", description: "Set gpg.format to x509", value: "x509" },
  ];
  const activeItem = options.find((option) => option.value === state.profileGpgFormat);
  const selected = (await input.showQuickPick({
    title: create ? "Create a profile" : "Edit profile",
    step: 5,
    totalSteps: 7,
    placeholder: create ? "Choose the gpg.format for this profile" : "Do you want to set a gpg.format for this profile?",
    items: options,
    activeItem,
    shouldResume: shouldResume,
  })) as (typeof options)[number];
  state.profileGpgFormat = selected.value;

  return (input: controls.MultiStepInput) => pickSigningKey(input, state, create);
}
