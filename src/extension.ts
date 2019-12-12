import { commands, ExtensionContext, workspace } from "vscode";
import { createUserProfile, editUserProfile, getUserProfile } from "./commands";
import { Profile } from "./models";
import { ProfileStatusBar as statusBar } from "./controls";
import * as constants from "./constants";

export async function activate(context: ExtensionContext) {
    workspace.onDidChangeConfiguration(async () => await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, false));

    statusBar.instance.attachCommand(constants.CommandIds.GET_USER_PROFILE);
    context.subscriptions.push(statusBar.instance.StatusBar);

    context.subscriptions.push(commands.registerCommand(constants.CommandIds.CREATE_USER_PROFILE, createUserProfile));
    context.subscriptions.push(commands.registerCommand(constants.CommandIds.EDIT_USER_PROFILE, editUserProfile));
    context.subscriptions.push(
        commands.registerCommand(constants.CommandIds.GET_USER_PROFILE, async (fromStatusBar: boolean = true) => {
            let selectedProfile: Profile = await getUserProfile(fromStatusBar);
            statusBar.instance.updateStatus(selectedProfile);
        })
    );

    await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, false);
}

export function deactivate() {}
