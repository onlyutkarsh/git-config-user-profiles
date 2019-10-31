import { window, commands } from "vscode";
import { getProfiles, Profile } from "./config";
export async function setUserProfile(fromStatusBar: boolean | undefined = false): Promise<Profile | null> {
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
    };

    return profile;
}

export async function getUserProfile() {
    let profilesInConfig = getProfiles();
    if (profilesInConfig.length > 0) {
        let selected = await window.showQuickPick(profilesInConfig.map(x => x.profileName), {
            canPickMany: false,
            matchOnDetail: true,
            placeHolder: "Select a profile",
        });
        window.showInformationMessage(selected ? selected : "No item selected");
    } else {
        let selected = await window.showInformationMessage("No config user profiles defined. Do you want to define one now?", "Yes", "No");
        if (selected === "Yes") {
            await commands.executeCommand("git-config-user.setUserProfile", true);
        }
    }
}
