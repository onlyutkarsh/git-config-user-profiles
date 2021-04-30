import sgit from "simple-git/promise";
import { commands, window } from "vscode";
import { getProfiles, saveProfile } from "./config";
import * as Constants from "./constants";
import { MultiStepInput, State } from "./controls";
import { Profile } from "./models";
import { getCurrentConfig, isValidWorkspace, trimLabelIcons, validateEmail, validateProfileName, validateUserName } from "./util";
import { Logger } from "./util/logger";

export async function createUserProfile() {
  const state = {} as Partial<State>;
  await MultiStepInput.run(input => pickProfileName(input, state));

  const profile: Profile = {
    label: state.profileName || "",
    email: state.email || "",
    userName: state.userName || "",
    selected: false,
  };

  await saveProfile(profile);
}

function shouldResume() {
  // Could show a notification with the option to resume.
  return new Promise<boolean>((resolve, reject) => {});
}

async function pickProfileName(input: MultiStepInput, state: Partial<State>, create = true) {
  state.profileName = await input.showInputBox({
    title: create ? "Create a profile" : "Edit profile",
    step: 1,
    totalSteps: 3,
    prompt: "Enter name for the profile",
    value: state.profileName || "",
    placeholder: "Work",
    validate: input => validateProfileName(input, create),
    shouldResume: shouldResume,
    ignoreFocusOut: true,
  });
  return (input: MultiStepInput) => pickUserName(input, state, create);
}

async function pickUserName(input: MultiStepInput, state: Partial<State>, create = true) {
  state.userName = await input.showInputBox({
    title: create ? "Create a profile" : "Edit profile",
    step: 2,
    totalSteps: 3,
    prompt: "Enter the user name",
    value: state.userName || "",
    placeholder: "John Smith",
    validate: validateUserName,
    shouldResume: shouldResume,
    ignoreFocusOut: true,
  });
  return (input: MultiStepInput) => pickEmail(input, state, create);
}

async function pickEmail(input: MultiStepInput, state: Partial<State>, create = true) {
  state.email = await input.showInputBox({
    title: create ? "Create a profile" : "Edit profile",
    step: 3,
    totalSteps: 3,
    prompt: "Enter the email",
    value: state.email || "",
    placeholder: "john.smith@myorg.com",
    validate: validateEmail,
    shouldResume: shouldResume,
    ignoreFocusOut: true,
  });
}
export async function getUserProfile(fromStatusBar = false, notProfileSwitch = true): Promise<Profile> {
  Logger.instance.logInfo(`Getting user profiles. Triggerred from status bar = ${fromStatusBar}`);
  const profilesInConfig = getProfiles();
  const emptyProfile = <Profile>{
    label: Constants.Application.APPLICATION_NAME,
    selected: false,
    email: "NA",
    userName: "NA",
  };

  const selectedProfileFromConfig = profilesInConfig.filter(x => x.selected) || [];
  const selectedProfile: Profile = selectedProfileFromConfig.length > 0 ? selectedProfileFromConfig[0] : emptyProfile;

  //TODO: Show error if the user deliberately deletes the username or email property from config
  if (selectedProfile.label === undefined || selectedProfile.userName === undefined || selectedProfile.email === undefined) {
    window.showErrorMessage("One of label, userName or email properties is missing in the config. Please verify.");
    return emptyProfile;
  }

  const validWorkspace = await isValidWorkspace();

  let configInSync = false;
  let currentConfig;
  if (validWorkspace.isValid && validWorkspace.folder) {
    const currentConfig = await getCurrentConfig(validWorkspace.folder);
    configInSync = currentConfig.email.toLowerCase() === selectedProfile.email.toLowerCase() && currentConfig.userName.toLowerCase() === selectedProfile.userName.toLowerCase();
  }

  if (!fromStatusBar) {
    if (profilesInConfig.length === 0) {
      //if profile loaded automatically and no config found
      //OR if no config found and user clicks on "no profile" on status bar, send undefined to show picklist
      return emptyProfile;
    }

    if (validWorkspace.isValid === false) {
      return emptyProfile;
    }

    //issue #31
    if (!configInSync && currentConfig !== null && currentConfig !== undefined) {
      //make currently selected profile as false
      if (selectedProfile !== emptyProfile) {
        selectedProfile.selected = false;
        await saveProfile(Object.assign({}, selectedProfile));
      }

      //get the profile matching what is in git config
      const currentProfile: Profile = getProfileByEmail(currentConfig.email) || emptyProfile;
      currentProfile.selected = true;
      await saveProfile(Object.assign({}, currentProfile));

      const selectedProfile1 = await getUserProfile(false, false); //dont show popup if user is switching profile
      return selectedProfile1;
    }

    //if configs found, but none are selected, if from statusbar show picklist else silent
    //if multiple items have selected = true (due to manual change) return the first one
    return selectedProfile;
  }

  if (fromStatusBar) {
    if (profilesInConfig.length === 0) {
      //if no profiles in config, prompt user to create (even if its non git workspace)
      const selected = await window.showInformationMessage("No user profiles defined. Do you want to define one now?", "Yes", "No");
      if (selected === "Yes") {
        await commands.executeCommand(Constants.CommandIds.CREATE_USER_PROFILE);
      }
      return emptyProfile;
    }

    let response;

    if (validWorkspace.isValid === false) {
      window.showErrorMessage(validWorkspace.message);
      return emptyProfile;
    }
    const workspaceFolder = validWorkspace.folder ? validWorkspace.folder : ".\\";
    if (selectedProfileFromConfig.length === 0) {
      response = await window.showInformationMessage(
        `You have ${profilesInConfig.length} profile(s) in settings. What do you want to do?`,
        "Pick a profile",
        "Edit existing",
        "Create new"
      );
    } else if (notProfileSwitch) {
      const notSyncOptions = ["Yes, apply", "No, pick another", "Edit existing", "Create new"];
      const syncOptions = ["Apply again", "Pick a profile", "Edit existing", "Create new"];

      const options = configInSync ? syncOptions : notSyncOptions;
      const message = configInSync
        ? `Git config is already in sync with profile '${trimLabelIcons(selectedProfile.label)}'. What do you want to do?`
        : `Git config is not using this profile. Do you want to use profile '${trimLabelIcons(selectedProfile.label)}' for this repo? (user: ${selectedProfile.userName}, email: ${
            selectedProfile.email
          }) `;

      response = await window.showInformationMessage(message, ...options);
    }

    if (response === undefined) {
      return selectedProfile;
    }
    if (response === "Edit existing") {
      await editUserProfile();
      return selectedProfile;
    }
    if (response === "Yes, apply" || response === "Apply again") {
      //no chance of getting undefined value here as validWorkSpace.result will always be true
      await sgit(workspaceFolder).addConfig("user.name", selectedProfile.userName);
      await sgit(workspaceFolder).addConfig("user.email", selectedProfile.email);
      window.showInformationMessage("User name and email updated in git config file.");
      return selectedProfile;
    }
    if (response === "Create new") {
      await createUserProfile();
      return selectedProfile;
    }
    if (response === "No, pick another" || response === "Pick a profile") {
      //show picklist only if no profile is marked as selected in config.
      //this can happen only when setting up config for the first time or user deliberately changed config
      const pickedProfile = await window.showQuickPick<Profile>(
        profilesInConfig.map(x => {
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
        await saveProfile(Object.assign({}, pickedProfile));
        const selectedProfile = await getUserProfile(true, false); //dont show popup if user is switching profile
        return selectedProfile;
      } else {
        // profile is already set in the statusbar,
        // user clicks statusbar, picklist is shown to switch profiles, but user does not pick anything
        // leave selected as is
        if (selectedProfileFromConfig.length > 0 && fromStatusBar) {
          return selectedProfile;
        }
      }
    }
  }
  return emptyProfile;
}

export async function editUserProfile() {
  const profilesInConfig = getProfiles();

  if (profilesInConfig.length === 0) {
    window.showWarningMessage("No profiles found");
    return;
  }

  const pickedProfile = await window.showQuickPick<Profile>(
    profilesInConfig.map(x => {
      return {
        label: trimLabelIcons(x.label),
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
    const state: Partial<State> = {
      email: pickedProfile.email,
      userName: pickedProfile.userName,
      profileName: pickedProfile.label,
    };
    await MultiStepInput.run(input => pickProfileName(input, state, false));

    const profile: Profile = {
      label: state.profileName || "",
      email: state.email || "",
      userName: state.userName || "",
      selected: pickedProfile.selected,
    };

    await saveProfile(profile, pickedProfile.label);
  }
  return undefined;
}
