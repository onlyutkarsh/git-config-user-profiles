import { window, commands } from "vscode";
import { getProfiles, Profile, saveProfile, getProfile } from "./config";
import { Commands } from "./constants";

export async function setUserProfile() {
    let profileName = await window.showInputBox({
        prompt: "Enter name for the profile",
        placeHolder: "Work",
        ignoreFocusOut: true,
        validateInput: input => {
            if (input && input.trim().length === 0) {
                return "Please enter a valid string";
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
        profileName: profileName,
        email: email,
        userName: userName,
        selected: false,
    };

    saveProfile(profile);
}

export async function getUserProfile(fromStatusBar: boolean = false): Promise<Profile | undefined> {
    let profilesInConfig = getProfiles();
    if (profilesInConfig.length > 0) {
        let selectedProfileFromConfig = profilesInConfig.filter(x => x.selected);
        let picked: string | undefined = "";

        if (selectedProfileFromConfig && selectedProfileFromConfig.length > 0 && !fromStatusBar) {
            //if multiple items have selected = true (due fo manual change) return the first one
            picked = selectedProfileFromConfig[0].profileName;
        } else {
            //show picklist only if no profile is marked as selected in config.
            //this can happen only when setting up config for the first time or user deliberately changed config
            picked = await window.showQuickPick(profilesInConfig.map(x => x.profileName), {
                canPickMany: false,
                matchOnDetail: true,
                ignoreFocusOut: true,
                placeHolder: "Select a user profile. ",
            });
        }

        if (picked) {
            let selectedProfile = getProfile(picked);
            if (selectedProfile && !selectedProfile.selected) {
                //update the selected profile as selected and save to the config
                selectedProfile.selected = true;
                saveProfile(selectedProfile);
            }
            return selectedProfile;
        }
        //TODO: return "No profile" if user skips selection
        return <Profile>{
            profileName: "No profile",
        };
    }

    return undefined;
}
