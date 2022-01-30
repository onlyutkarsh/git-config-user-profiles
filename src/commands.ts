import sgit from "simple-git";
import { commands, window } from "vscode";
import { getVscProfiles, saveVscProfile } from "./config";
import * as constants from "./constants";
import * as controls from "./controls";
import { Profile } from "./models";
import * as util from "./util";
import { Logger } from "./util/logger";

export async function createUserProfile() {
  const state = {} as Partial<controls.State>;
  await controls.MultiStepInput.run((input) => pickProfileName(input, state));

  const profile: Profile = {
    label: state.profileName || "",
    email: state.email || "",
    userName: state.userName || "",
    selected: false,
  };

  await saveVscProfile(profile);
}

function shouldResume() {
  // Could show a notification with the option to resume.
  return new Promise<boolean>(() => {});
}

async function pickProfileName(input: controls.MultiStepInput, state: Partial<controls.State>, create = true) {
  state.profileName = await input.showInputBox({
    title: create ? "Create a profile" : "Edit profile",
    step: 1,
    totalSteps: 3,
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
  state.userName = await input.showInputBox({
    title: create ? "Create a profile" : "Edit profile",
    step: 2,
    totalSteps: 3,
    prompt: "Enter the user name",
    value: state.userName || "",
    placeholder: "John Smith",
    validate: util.validateUserName,
    shouldResume: shouldResume,
    ignoreFocusOut: true,
  });
  return (input: controls.MultiStepInput) => pickEmail(input, state, create);
}

async function pickEmail(input: controls.MultiStepInput, state: Partial<controls.State>, create = true) {
  state.email = await input.showInputBox({
    title: create ? "Create a profile" : "Edit profile",
    step: 3,
    totalSteps: 3,
    prompt: "Enter the email",
    value: state.email || "",
    placeholder: "john.smith@myorg.com",
    validate: util.validateEmail,
    shouldResume: shouldResume,
    ignoreFocusOut: true,
  });
}

/**
 * Get current saved profile & Switch between profiles & Apply profile
 * @description **The use of the parameters is just my personal assumption !** — *Shaokun-X*
 * @param fromStatusBar if the function is called from sidebar or not
 * @param notProfileSwitch when has selected profile and want to select new one
 */
export async function getUserProfile(fromStatusBar = false, notProfileSwitch = true): Promise<Profile> {
  Logger.instance.logInfo(`Getting user profiles. Triggerred from status bar = ${fromStatusBar}`);
  const profilesInVscConfig = getVscProfiles();
  const emptyProfile = <Profile>{
    label: constants.Application.APPLICATION_NAME,
    selected: false,
    email: "NA",
    userName: "NA",
  };

  const selectedProfileInVscConfig = profilesInVscConfig.filter((x) => x.selected) || [];
  const selectedVscProfile: Profile = selectedProfileInVscConfig.length > 0 ? selectedProfileInVscConfig[0] : emptyProfile;

  //TODO: Show error if the user deliberately deletes the username or email property from config
  if (selectedVscProfile.label === undefined || selectedVscProfile.userName === undefined || selectedVscProfile.email === undefined) {
    window.showErrorMessage("One of label, userName or email properties is missing in the config. Please verify.");
    return emptyProfile;
  }

  const validatedWorkspace = await util.isValidWorkspace();

  let configInSync = false;
  if (validatedWorkspace.isValid && validatedWorkspace.folder) {
    const currentGitConfig = await util.getCurrentGitConfig(validatedWorkspace.folder);
    configInSync = !util.isNameAndEmailEmpty(currentGitConfig) && util.hasSameNameAndEmail(currentGitConfig, selectedVscProfile);
  }

  if (!fromStatusBar) {
    if (profilesInVscConfig.length === 0) {
      //if profile loaded automatically and no config found
      //OR if no config found and user clicks on "no profile" on status bar, send undefined to show picklist
      return emptyProfile;
    }

    if (validatedWorkspace.isValid === false) {
      return emptyProfile;
    }

    //if configs found, but none are selected, if from statusbar show picklist else silent
    //if multiple items have selected = true (due to manual change) return the first one
    return selectedVscProfile;
  }

  if (fromStatusBar) {
    if (profilesInVscConfig.length === 0) {
      //if no profiles in config, prompt user to create (even if its non git workspace)
      const selected = await window.showInformationMessage("No user profiles defined. Do you want to define one now?", "Yes", "No");
      if (selected === "Yes") {
        await commands.executeCommand(constants.CommandIds.CREATE_USER_PROFILE);
      }
      return emptyProfile;
    }

    let response;

    if (validatedWorkspace.isValid === false) {
      window.showErrorMessage(validatedWorkspace.message);
      return emptyProfile;
    }
    const workspaceFolder = validatedWorkspace.folder ? validatedWorkspace.folder : ".\\";
    if (selectedProfileInVscConfig.length === 0) {
      response = await window.showInformationMessage(
        `You have ${profilesInVscConfig.length} profile(s) in settings. What do you want to do?`,
        "Pick a profile",
        "Edit existing",
        "Create new"
      );
    } else if (notProfileSwitch) {
      const notSyncOptions = ["Yes, apply", "No, pick another", "Edit existing", "Create new"];
      const syncOptions = ["Apply again", "Pick a profile", "Edit existing", "Create new"];

      const options = configInSync ? syncOptions : notSyncOptions;
      const message = configInSync
        ? `Git config is already in sync with profile '${util.trimLabelIcons(selectedVscProfile.label)}'. What do you want to do?`
        : `Git config is not using this profile. Do you want to use profile '${util.trimLabelIcons(selectedVscProfile.label)}' for this repo? (user: ${
            selectedVscProfile.userName
          }, email: ${selectedVscProfile.email}) `;

      response = await window.showInformationMessage(message, ...options);
    }

    if (response === undefined) {
      return selectedVscProfile;
    }
    if (response === "Edit existing") {
      await editUserProfile();
      return selectedVscProfile;
    }
    if (response === "Yes, apply" || response === "Apply again") {
      //no chance of getting undefined value here as validWorkSpace.result will always be true
      await sgit(workspaceFolder).addConfig("user.name", selectedVscProfile.userName);
      await sgit(workspaceFolder).addConfig("user.email", selectedVscProfile.email);
      window.showInformationMessage("User name and email updated in git config file.");
      return selectedVscProfile;
    }
    if (response === "Create new") {
      await createUserProfile();
      return selectedVscProfile;
    }
    if (response === "No, pick another" || response === "Pick a profile") {
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
          };
        }),
        {
          canPickMany: false,
          matchOnDetail: false,
          ignoreFocusOut: true,
          placeHolder: "Select a user profile.",
        }
      );

      if (pickedProfile) {
        pickedProfile.detail = undefined;
        pickedProfile.label = pickedProfile.label;
        pickedProfile.selected = true;
        await saveVscProfile(Object.assign({}, pickedProfile));
        const selectedProfile = await getUserProfile(true, false); //dont show popup if user is switching profile
        return selectedProfile;
      } else {
        // profile is already set in the statusbar,
        // user clicks statusbar, picklist is shown to switch profiles, but user does not pick anything
        // leave selected as is
        if (selectedProfileInVscConfig.length > 0 && fromStatusBar) {
          return selectedVscProfile;
        }
      }
    }
  }
  return emptyProfile;
}

export async function editUserProfile() {
  const profilesInConfig = getVscProfiles();

  if (profilesInConfig.length === 0) {
    window.showWarningMessage("No profiles found");
    return;
  }

  const pickedProfile = await window.showQuickPick<Profile>(
    profilesInConfig.map((x) => {
      return {
        label: util.trimLabelIcons(x.label),
        userName: x.userName,
        email: x.email,
        selected: x.selected,
        detail: `${x.userName} (${x.email}) `,
      };
    }),
    {
      canPickMany: false,
      matchOnDetail: false,
      ignoreFocusOut: true,
      placeHolder: "Select a user profile. ",
    }
  );

  if (pickedProfile) {
    pickedProfile.detail = undefined;
    pickedProfile.label = pickedProfile.label;
    const state: Partial<controls.State> = {
      email: pickedProfile.email,
      userName: pickedProfile.userName,
      profileName: pickedProfile.label,
    };
    await controls.MultiStepInput.run((input) => pickProfileName(input, state, false));

    const profile: Profile = {
      label: state.profileName || "",
      email: state.email || "",
      userName: state.userName || "",
      selected: pickedProfile.selected,
    };

    await saveVscProfile(profile, pickedProfile.label);
  }
  return undefined;
}

/**
 * Read local git `config` and update the profiles in VSC config. If git config profile exists,
 * only the corresponding profile in VSC config would be set `selected = true`. If git config profile
 * doesn't have corresponding profile in VSC config, then it would be added.
 * @returns local git config profile if exists, otherwise an object with `userName` and `email` are empty string.
 */
export async function syncVscProfilesWithGitConfig(): Promise<void> {
  // check if is valid git workspace
  const validatedWorkspace = await util.isValidWorkspace();
  if (!(validatedWorkspace.isValid && validatedWorkspace.folder)) {
    // window.showWarningMessage(Constants.Messages.NOT_A_VALID_REPO);
    return;
  }

  // get git config profile
  // let gitProfile: { userName: string; email: string };
  const gitProfile = await util.getCurrentGitConfig(validatedWorkspace.folder);

  // return an empty object if no git profile found
  if (util.isNameAndEmailEmpty(gitProfile)) {
    //TODO: ask user to create a local git config
    const response = await window.showInformationMessage("No local Git config file found. Do you want to create one now?", "Yes", "No");
    if (response == undefined || response == "No") {
      return;
    }
    await createUserProfile();
    return;
  }

  // get all existing vsc profiles
  const vscProfiles = getVscProfiles();

  // set selected = false for all selected vsc profiles
  await Promise.all(
    vscProfiles
      .filter((vscProfile) => vscProfile.selected)
      .map(async (vscProfile) => {
        vscProfile.selected = false;
        await saveVscProfile(vscProfile, vscProfile.label);
      })
  );

  // update corresponding vsc profile, if it exists, otherwise add it to vsc cofig
  const correspondingVscProfile = vscProfiles.filter((vscProfile) => util.hasSameNameAndEmail(vscProfile, gitProfile));

  if (correspondingVscProfile.length >= 1) {
    // only select the first appearance
    correspondingVscProfile[0].selected = true;
    await saveVscProfile(correspondingVscProfile[0], correspondingVscProfile[0].label);
  } else {
    // add the git config profile to vsc config
    const newProfile: Profile = {
      label: util.trimLabelIcons(gitProfile.userName),
      userName: gitProfile.userName,
      email: gitProfile.email,
      selected: true,
      detail: `${gitProfile.userName} (${gitProfile.email}) `,
    };
    await saveVscProfile(newProfile);
  }
}
