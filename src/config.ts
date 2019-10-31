import { workspace } from "vscode";

export interface Profile {
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
