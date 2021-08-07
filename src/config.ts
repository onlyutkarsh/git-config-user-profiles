import { ConfigurationTarget, workspace } from "vscode";
import { Profile } from "./models";
import { trimProperties, trimLabelIcons as trimCheckIcon } from "./util";

export function getVscProfiles(): Profile[] {
    let profiles = workspace.getConfiguration("gitConfigUser").get<Profile[]>("profiles");

    if (profiles) {
        return profiles.map(x => {
            return {
                label: trimCheckIcon(x.label),
                userName: x.userName,
                email: x.email,
                selected: x.selected,
                detail: undefined,
            };
        });
    }
    return [];
}

export async function saveVscProfile(profile: Profile, oldProfileLabel?: string): Promise<void> {
    //get existing profiles
    let profiles = getVscProfiles();
    profile = trimProperties(profile);
    let existingProfileIndex = -1;
    if (oldProfileLabel) {
        existingProfileIndex = profiles.findIndex(x => x.label.toLowerCase() === oldProfileLabel.toLowerCase());
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

export function getVscProfile(profileName: string): Profile | undefined {
    let filtered = getVscProfiles().filter(x => x.label.toLowerCase() === profileName.toLowerCase());
    if (filtered && filtered.length > 0) {
        return Object.assign({}, filtered[0]);
    }
    return undefined;
}
