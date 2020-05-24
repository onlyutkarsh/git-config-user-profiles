import { commands, ExtensionContext, workspace } from "vscode";
import { createUserProfile, editUserProfile, getUserProfile } from "./commands";
import { Profile } from "./models";
import { ProfileStatusBar as statusBar } from "./controls";
import * as constants from "./constants";
import { getCurrentConfig, isValidWorkspace } from "./util";
import { Logger } from "./util/logger";
import * as Sentry from "@sentry/node";

export async function activate(context: ExtensionContext) {
    try {
        Sentry.init({
            dsn: "https://2c585484973d4e91952ee96cd3d1bcad@o188211.ingest.sentry.io/5251697"
        });

        Logger.instance.logInfo("Activating extension");

        Logger.instance.logInfo("Registering for config change event");
        workspace.onDidChangeConfiguration(
            async () => await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, false)
        );

        Logger.instance.logInfo("Initializing status bar");

        statusBar.instance.attachCommand(constants.CommandIds.GET_USER_PROFILE);

        Logger.instance.logInfo("Initializing commands");
        context.subscriptions.push(statusBar.instance.StatusBar);
        context.subscriptions.push(
            commands.registerCommand(constants.CommandIds.CREATE_USER_PROFILE, createUserProfile)
        );
        context.subscriptions.push(commands.registerCommand(constants.CommandIds.EDIT_USER_PROFILE, editUserProfile));
        context.subscriptions.push(
            commands.registerCommand(constants.CommandIds.GET_USER_PROFILE, async (fromStatusBar: boolean = true) => {
                let selectedProfile: Profile = await getUserProfile(fromStatusBar, true);
                let validWorkspace = await isValidWorkspace();
                let configInSync = false;
                if (validWorkspace.isValid && validWorkspace.folder) {
                    let currentConfig = await getCurrentConfig(validWorkspace.folder);
                    configInSync =
                        currentConfig.email.toLowerCase() === selectedProfile.email.toLowerCase() &&
                        currentConfig.userName.toLowerCase() === selectedProfile.userName.toLowerCase();
                }

                statusBar.instance.updateStatus(selectedProfile, configInSync);
            })
        );
        Logger.instance.logInfo("Initializing commands complete.");
        await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, false);
    } catch (error) {
        Sentry.captureException(error);
        Logger.instance.logError("Error ocurred", error);
    }
}

export function deactivate() {}
