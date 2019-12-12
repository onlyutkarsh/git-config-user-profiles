import { commands, ConfigurationTarget, workspace } from "vscode";
import { Profile } from "./models";

export function getProfiles(): Profile[] {
    let profiles = workspace.getConfiguration("gitConfigUser").get<Profile[]>("profiles");

    if (profiles) {
        return profiles;
    }
    return [];
}

export function saveProfile(profile: Profile, oldProfileName?: string) {
    //get existing profiles
    let profiles = getProfiles();

    let existingProfileIndex = -1;
    if (oldProfileName) {
        existingProfileIndex = profiles.findIndex(x => x.label.toLowerCase() === oldProfileName.toLowerCase());
    } else {
        existingProfileIndex = profiles.findIndex(x => x.label.toLowerCase() === profile.label.toLowerCase());
        if (existingProfileIndex > -1) {
            // set existing to false if user is making a selection of profile (not updating the profile)
            profiles.forEach(x => (x.selected = false));
        }
    }
    if (existingProfileIndex > -1) {
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
