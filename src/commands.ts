import * as sgit from "simple-git/promise";
import { commands, window, workspace } from "vscode";
import { getProfiles, saveProfile } from "./config";
import {
    isValidWorkspace,
    validateEmail,
    validateProfileName,
    validateUserName,
    getCurrentGitConfig,
    trimLabelIcons,
    hasSameNameAndEmail,
} from "./util";
import * as Constants from "./constants";
import { MultiStepInput, State } from "./controls";
import { Profile } from "./models";
import { Logger } from "./util/logger";

export async function createUserProfile() {
    const state = {} as Partial<State>;
    await MultiStepInput.run(input => pickProfileName(input, state));

    let profile: Profile = {
        label: state.profileName || "",
        email: state.email || "",
        userName: state.userName || "",
        selected: false,
    };

    await saveProfile(profile);
}

function shouldResume() {
    // Could show a notification with the option to resume.
    return new Promise<boolean>((resolve, reject) => { });
}

async function pickProfileName(input: MultiStepInput, state: Partial<State>, create: boolean = true) {
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

async function pickUserName(input: MultiStepInput, state: Partial<State>, create: boolean = true) {
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

async function pickEmail(input: MultiStepInput, state: Partial<State>, create: boolean = true) {
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

/**
 * Get current saved profile & Switch between profiles & Apply profile
 * @description **The use of the parameters is just my personal assumption !** — *Shaokun-X*
 * @param fromStatusBar if the function is called from sidebar or not
 * @param notProfileSwitch when has selected profile and want to select new one
 */
export async function getUserProfile(fromStatusBar: boolean = false, notProfileSwitch: boolean = true): Promise<Profile> {
    Logger.instance.logInfo(`Getting user profiles. Triggerred from status bar = ${fromStatusBar}`);
    let profilesInVscConfig = getProfiles();
    let emptyProfile = <Profile>{
        label: Constants.Application.APPLICATION_NAME,
        selected: false,
        email: "NA",
        userName: "NA",
    };

    let selectedProfileInVscConfig = profilesInVscConfig.filter(x => x.selected) || [];
    let selectedVscProfile: Profile = selectedProfileInVscConfig.length > 0 ? selectedProfileInVscConfig[0] : emptyProfile;

    //TODO: Show error if the user deliberately deletes the username or email property from config
    if (selectedVscProfile.label === undefined || selectedVscProfile.userName === undefined || selectedVscProfile.email === undefined) {
        window.showErrorMessage("One of label, userName or email properties is missing in the config. Please verify.");
        return emptyProfile;
    }

    let validatedWorkspace = await isValidWorkspace();

    let configInSync = false;
    if (validatedWorkspace.isValid && validatedWorkspace.folder) {
        let currentGitConfig = await getCurrentGitConfig(validatedWorkspace.folder);
        configInSync = hasSameNameAndEmail(currentGitConfig, selectedVscProfile);
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
            let selected = await window.showInformationMessage("No user profiles defined. Do you want to define one now?", "Yes", "No");
            if (selected === "Yes") {
                await commands.executeCommand(Constants.CommandIds.CREATE_USER_PROFILE);
            }
            return emptyProfile;
        }

        let response;

        if (validatedWorkspace.isValid === false) {
            window.showErrorMessage(validatedWorkspace.message);
            return emptyProfile;
        }
        let workspaceFolder = validatedWorkspace.folder ? validatedWorkspace.folder : ".\\";
        if (selectedProfileInVscConfig.length === 0) {
            response = await window.showInformationMessage(
                `You have ${profilesInVscConfig.length} profile(s) in settings. What do you want to do?`,
                "Pick a profile",
                "Edit existing",
                "Create new"
            );
        } else if (notProfileSwitch) {
            let notSyncOptions = ["Yes, apply", "No, pick another", "Edit existing", "Create new"];
            let syncOptions = ["Apply again", "Pick a profile", "Edit existing", "Create new"];

            let options = configInSync ? syncOptions : notSyncOptions;
            let message = configInSync
                ? `Git config is already in sync with profile '${trimLabelIcons(selectedVscProfile.label)}'. What do you want to do?`
                : `Git config is not using this profile. Do you want to use profile '${trimLabelIcons(selectedVscProfile.label)}' for this repo? (user: ${selectedVscProfile.userName
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
            let pickedProfile = await window.showQuickPick<Profile>(
                profilesInVscConfig.map(x => {
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
                let selectedProfile = await getUserProfile(true, false); //dont show popup if user is switching profile
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
    let profilesInConfig = getProfiles();

    if (profilesInConfig.length === 0) {
        window.showWarningMessage("No profiles found");
        return;
    }

    let pickedProfile = await window.showQuickPick<Profile>(
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

        let profile: Profile = {
            label: state.profileName || "",
            email: state.email || "",
            userName: state.userName || "",
            selected: pickedProfile.selected,
        };

        await saveProfile(profile, pickedProfile.label);
    }
    return undefined;
}
