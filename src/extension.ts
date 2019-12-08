import { commands, ExtensionContext, workspace } from "vscode";
import { createUserProfile, editUserProfile, getUserProfile } from "./commands";
import { Commands } from "./constants";
import { Profile } from "./Profile";
import { ProfileStatusBar as statusBar } from "./profileStatusBar";

export async function activate(context: ExtensionContext) {
    workspace.onDidChangeConfiguration(async () => await commands.executeCommand(Commands.GET_USER_PROFILE, false));

    statusBar.instance.attachCommand(Commands.GET_USER_PROFILE);
    context.subscriptions.push(statusBar.instance.StatusBar);

    context.subscriptions.push(commands.registerCommand(Commands.CREATE_USER_PROFILE, createUserProfile));
    context.subscriptions.push(commands.registerCommand(Commands.EDIT_USER_PROFILE, editUserProfile));
    context.subscriptions.push(
        commands.registerCommand(Commands.GET_USER_PROFILE, async (fromStatusBar: boolean = true) => {
            let selectedProfile: Profile = await getUserProfile(fromStatusBar);
            statusBar.instance.updateStatus(selectedProfile);
        })
    );

    await commands.executeCommand(Commands.GET_USER_PROFILE, false);
}

export function deactivate() {}
