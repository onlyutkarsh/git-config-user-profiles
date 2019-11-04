import { workspace, window, ConfigurationTarget } from "vscode";
import { ProfileStatusBar } from "./profileStatusBar";

export class Profile {
    profileName: string;
    userName: string;
    email: string;
    selected: boolean;
}

export function getProfiles(): Profile[] {
    let profiles = workspace.getConfiguration("gitConfigUser").get<Profile[]>("profiles");

    if (profiles) {
        return profiles;
    }
    return [];
}

export function saveProfile(profile: Profile) {
    //get existing profiles
    let profiles = getProfiles();

    let existingProfileIndex = profiles.findIndex(x => x.profileName.toLowerCase() === profile.profileName.toLowerCase());
    if (existingProfileIndex > -1) {
        profiles.forEach(x => (x.selected = false));
        profiles[existingProfileIndex] = profile;
    } else {
        profiles.push(profile);
    }

    workspace.getConfiguration("gitConfigUser").update("profiles", profiles, ConfigurationTarget.Global);
}

export function getProfile(profileName: string): Profile | undefined {
    let filtered = getProfiles().filter(x => x.profileName.toLowerCase() === profileName.toLowerCase());
    if (filtered && filtered.length > 0) {
        return Object.assign({}, filtered[0]);
    }
    return undefined;
}

export function onDidChangeConfiguration() {
    // let text = ProfileStatusBar.instance.StatusBar.text.replace("$(repo) ", "");
    // //if profile text from the statusbar does not match what is in config, warn
    // let exists = getProfile(text);
    // if (!exists) {
    //     window.showErrorMessage("Profile seems to have been removed from configuration. Please verify");
    //     ProfileStatusBar.instance.updateStatus("No profile");
    // }
}
