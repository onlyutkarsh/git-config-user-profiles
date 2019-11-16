import { window, commands, workspace } from "vscode";
import { getProfiles, saveProfile, getProfile } from "./config";
import { Profile } from "./Profile";
import { Commands } from "./constants";
import { Action } from "./Action";
import { isValidWorkspace } from "./utils";
import * as sgit from "simple-git/promise";

export async function setUserProfile() {
    let profileName = await window.showInputBox({
        prompt: "Enter name for the profile",
        placeHolder: "Work",
        ignoreFocusOut: true,
        validateInput: input => {
            if (input && input.trim().length === 0) {
                return "Please enter a valid string";
            }
            let existingProfile = getProfile(input);
            if (existingProfile) {
                return `Oops! Profile with the same name '${input}' already exists!`;
            }
            return undefined;
        },
    });

    if (!profileName) {
        return null;
    }

    let userName = await window.showInputBox({
        prompt: `Enter user name for '${profileName}'`,
        placeHolder: "John Smith",
        ignoreFocusOut: true,
        validateInput: input => {
            if (input && input.trim().length === 0) {
                return "Please enter a valid string";
            }
            return undefined;
        },
    });

    if (!userName) {
        return null;
    }

    let email = await window.showInputBox({
        prompt: `Enter email for '${profileName}'`,
        placeHolder: "john.smith@work.com",
        ignoreFocusOut: true,
        validateInput: input => {
            let validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!validEmail.test(input)) {
                return "Oops! That does not seem to be a valid email. Please verify";
            }
            return undefined;
        },
    });

    if (!email) {
        return null;
    }

    let profile: Profile = {
        label: profileName,
        email: email,
        userName: userName,
        selected: false,
    };

    saveProfile(profile);
}

export async function getUserProfile(fromStatusBar: boolean = false): Promise<{ profile: Profile; action: Action }> {
    let profilesInConfig = getProfiles();
    let emptyProfile = <Profile>{
        label: "No profile",
        selected: false,
        userName: "NA",
        email: "NA",
    };

    if (profilesInConfig.length === 0) {
        //if profile loaded automatically and no config found
        //OR if no config found and user clicks on "no profile" on status bar, send undefined to show picklist
        if (fromStatusBar) {
            return {
                profile: emptyProfile,
                action: Action.ShowCreateConfig,
            };
        }
        return {
            profile: emptyProfile,
            action: Action.LoadSilently,
        };
    }

    let selectedProfileFromConfig = profilesInConfig.filter(x => x.selected) || [];

    if (!fromStatusBar) {
        if (selectedProfileFromConfig.length === 0) {
            //if configs found, but none are selected, if from statusbar show picklist else silent
            return {
                profile: emptyProfile,
                action: Action.LoadSilently,
            };
        } else {
            //if multiple items have selected = true (due to manual change) return the first one
            return {
                profile: selectedProfileFromConfig[0],
                action: Action.PickedSelectedFromConfig,
            };
        }
    }

    let response;
    if (fromStatusBar) {
        if (selectedProfileFromConfig.length === 0) {
            response = "No, pick another";
        } else {
            response = await window.showInformationMessage("Do you want to use this profile for this repo?", "Yes, apply", "No, pick another", "Create new");
        }
    }
    if (response === "Yes, apply") {
        let validWorkSpace = await isValidWorkspace();
        if (validWorkSpace.result === false) {
            window.showErrorMessage(validWorkSpace.message);
            return {
                profile: selectedProfileFromConfig[0],
                action: Action.EscapedPicklist,
            };
        }
        if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
            let folder = workspace.workspaceFolders[0].uri.fsPath;
            sgit(folder).addConfig("user.name", selectedProfileFromConfig[0].userName);
            sgit(folder).addConfig("user.email", selectedProfileFromConfig[0].email);
        }
    }
    if (response === "Create new") {
        commands.executeCommand(Commands.SET_USER_PROFILE);
    } else if (response === "No, pick another") {
        //show picklist only if no profile is marked as selected in config.
        //this can happen only when setting up config for the first time or user deliberately changed config
        let quickPickResponse = await window.showQuickPick<Profile>(
            profilesInConfig.map(x => {
                return {
                    label: `${x.label}${x.selected ? " (selected)" : ""}`,
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

        if (quickPickResponse) {
            quickPickResponse.detail = undefined;
            quickPickResponse.label = quickPickResponse.label.replace(" (selected)", "");
            quickPickResponse.selected = true;
            saveProfile(Object.assign({}, quickPickResponse));
            return {
                profile: quickPickResponse,
                action: Action.ProfileQuickPickedAndSaved,
            };
        } else {
            // profile is already set in the statusbar,
            // user clicks statusbar, picklist is shown to switch profiles, but user does not pick anything
            // leave selected as is
            if (selectedProfileFromConfig.length > 0 && fromStatusBar) {
                return {
                    profile: selectedProfileFromConfig[0],
                    action: Action.EscapedPicklist,
                };
            }
        }
    }

    return {
        profile: emptyProfile,
        action: Action.NoOp,
    };
}
