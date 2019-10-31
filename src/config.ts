import { workspace } from "vscode";
import { ProfileStatusBar } from "./profileStatusBar";

export class Profile {
    profileName: string;
    userName: string;
    email: string;
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
    profiles.push(profile);
    workspace.getConfiguration("gitConfigUser").update("profiles", profiles);
}

export function getProfile(profileName: string | undefined): Profile | undefined {
    let filtered = getProfiles().filter(x => x.profileName === profileName);
    if (filtered && filtered.length > 0) {
        return filtered[0];
    }
    return undefined;
}

export function onDidChangeConfiguration() {
    let profiles = getProfiles();
    let text = ProfileStatusBar.instance.StatusBar.text.replace("$(repo) ", "");
    //if profile text from the statusbar does not match what is in config, warn
}
