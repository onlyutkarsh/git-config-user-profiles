import { ConfigurationTarget, workspace } from "vscode";
import { Profile } from "./models";
import * as util from "./util";

export function getProfilesInSettings(): Profile[] {
  const profiles = workspace.getConfiguration("gitConfigUser").get<Profile[]>("profiles");

  if (profiles) {
    // map all profiles in to profiles entity and return
    return profiles;
  }
  return [];
}

export async function saveVscProfile(profile: Profile, oldProfileId?: string): Promise<void> {
  //get existing profiles
  const profiles = getProfilesInSettings();
  profile = util.trimProperties(profile);
  let existingProfileIndex = -1;
  if (oldProfileId) {
    // user is updating existing profile, no need to make changes to selected field
    existingProfileIndex = profiles.findIndex((x) => {
      if (x.id) {
        return x.id?.toLowerCase() === oldProfileId.toLowerCase();
      } else {
        // for backward compatibility with old profiles without id
        return x.label.toLowerCase() === oldProfileId.toLowerCase();
      }
    });
  } else {
    // user is making a selection of profile (not updating the profile), so set selected to false
    existingProfileIndex = profiles.findIndex((x) => {
      if (x.id) {
        return x.id?.toLowerCase() === profile.id?.toLowerCase();
      } else {
        // for backward compatibility with old profiles without id
        return x.label.toLowerCase() === profile.label.toLowerCase();
      }
    });
    if (existingProfileIndex > -1) {
      // set existing to false if user is making a selection of profile (not updating the profile)
      profiles.forEach((x) => {
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
  const filtered = getProfilesInSettings().filter((x) => x.label.toLowerCase() === profileName.toLowerCase());
  if (filtered && filtered.length > 0) {
    return Object.assign({}, filtered[0]);
  }
  return undefined;
}
