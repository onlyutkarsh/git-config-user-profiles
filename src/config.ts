import { workspace, window, ConfigurationTarget, commands } from "vscode";
import { ProfileStatusBar } from "./profileStatusBar";
import { Commands } from "./constants";
import { Profile } from "./Profile";

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

    let existingProfileIndex = profiles.findIndex(x => x.label.toLowerCase() === profile.label.toLowerCase());
    if (existingProfileIndex > -1) {
        profiles.forEach(x => (x.selected = false));
        profiles[existingProfileIndex] = profile;
    } else {
        profiles.push(profile);
    }

    workspace.getConfiguration("gitConfigUser").update("profiles", profiles, ConfigurationTarget.Global);
}

export function getProfile(profileName: string): Profile | undefined {
    let filtered = getProfiles().filter(x => x.label.toLowerCase() === profileName.toLowerCase());
    if (filtered && filtered.length > 0) {
        return Object.assign({}, filtered[0]);
    }
    return undefined;
}

export async function onDidChangeConfiguration() {
    await commands.executeCommand(Commands.GET_USER_PROFILE, false);
}
