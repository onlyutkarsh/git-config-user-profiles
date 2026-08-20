import * as vscode from "vscode";
import { saveVscProfile } from "../config";
import { Profile } from "../models";
import * as util from "../util";

interface SaveManagedProfileParams {
  profile: Profile;
  actionVerb: "created" | "updated";
  profileIdToUpdate?: string;
  successMessage?: string;
}

interface CreateManagedProfileParams {
  profile: Profile;
  successMessage?: string;
}

interface UpdateManagedProfileParams {
  profile: Profile;
  profileIdToUpdate: string;
  successMessage?: string;
}

interface DeleteManagedProfileParams {
  profile: Profile;
  successMessage?: string;
}

async function saveManagedProfile({ profile, actionVerb, profileIdToUpdate, successMessage }: SaveManagedProfileParams): Promise<void> {
  if (profileIdToUpdate) {
    await saveVscProfile(profile, profileIdToUpdate);
  } else {
    await saveVscProfile(profile);
  }

  util.Logger.instance.logInfo(`Profile '${profile.label}' ${actionVerb} successfully`);

  if (successMessage) {
    await vscode.window.showInformationMessage(successMessage);
  }
}

export async function createManagedProfile({ profile, successMessage }: CreateManagedProfileParams): Promise<void> {
  await saveManagedProfile({
    profile,
    actionVerb: "created",
    successMessage,
  });
}

export async function updateManagedProfile({ profile, profileIdToUpdate, successMessage }: UpdateManagedProfileParams): Promise<void> {
  await saveManagedProfile({
    profile,
    actionVerb: "updated",
    profileIdToUpdate,
    successMessage,
  });
}

export async function deleteManagedProfile({ profile, successMessage }: DeleteManagedProfileParams): Promise<void> {
  await util.deleteProfile(profile);
  util.Logger.instance.logInfo(`Profile '${profile.label}' deleted successfully`);

  if (successMessage) {
    await vscode.window.showInformationMessage(successMessage);
  }
}
