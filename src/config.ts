import { commands, ConfigurationTarget, workspace } from "vscode";
import { Profile } from "./models";
import { trimProperties, trimLabelIcons as trimCheckIcon } from "./util";

export function getProfiles(): Profile[] {
    let profiles = workspace.getConfiguration("gitConfigUser").get<Profile[]>("profiles");

    if (profiles) {
        return profiles.map(x => {
            return {
                label: trimCheckIcon(x.label),
                userName: x.userName,
                email: x.email,
                signingKey: x.signingKey,
                selected: x.selected,
                detail: undefined,
            };
        });
    }
    return [];
}

export async function saveProfile(profile: Profile, oldProfileName?: string): Promise<void> {
    //get existing profiles
    let profiles = getProfiles();
    profile = trimProperties(profile);
    let existingProfileIndex = -1;
    if (oldProfileName) {
        existingProfileIndex = profiles.findIndex(x => x.label.toLowerCase() === oldProfileName.toLowerCase());
    } else {
        existingProfileIndex = profiles.findIndex(x => x.label.toLowerCase() === profile.label.toLowerCase());
        if (existingProfileIndex > -1) {
            // set existing to false if user is making a selection of profile (not updating the profile)
            profiles.forEach(x => {
                x.selected = false;
                x.label = x.label.replace("$(check)", "").trim();
            });
        }
    }
    if (existingProfileIndex > -1) {
        profiles[existingProfileIndex] = profile;
    } else {
        profiles.push(profile);
    }
    await workspace.getConfiguration("gitConfigUser").update("profiles", profiles, ConfigurationTarget.Global);
}

export function getProfile(profileName: string): Profile | undefined {
    let filtered = getProfiles().filter(x => x.label.toLowerCase() === profileName.toLowerCase());
    if (filtered && filtered.length > 0) {
        return Object.assign({}, filtered[0]);
    }
    return undefined;
}
