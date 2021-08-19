import { commands, ExtensionContext, workspace } from "vscode";
import * as cmd from "./commands";
import * as constants from "./constants";
import { ProfileStatusBar as statusBar } from "./controls";
import { Profile } from "./models";
import * as util from "./util";
import { Logger } from "./util/logger";

export async function activate(context: ExtensionContext) {
  try {
    Logger.instance.logInfo("Activating extension");

    Logger.instance.logInfo("Registering for config change event");
    workspace.onDidChangeConfiguration(async () => await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, false));

    Logger.instance.logInfo("Initializing status bar");

    statusBar.instance.attachCommand(constants.CommandIds.GET_USER_PROFILE);

    Logger.instance.logInfo("Initializing commands");
    context.subscriptions.push(statusBar.instance.StatusBar);
    context.subscriptions.push(commands.registerCommand(constants.CommandIds.CREATE_USER_PROFILE, cmd.createUserProfile));
    context.subscriptions.push(commands.registerCommand(constants.CommandIds.SYNC_VSC_PROFILES_WITH_GIT_CONFIG, cmd.syncVscProfilesWithGitConfig));
    context.subscriptions.push(commands.registerCommand(constants.CommandIds.EDIT_USER_PROFILE, cmd.editUserProfile));
    context.subscriptions.push(
      commands.registerCommand(constants.CommandIds.GET_USER_PROFILE, async (fromStatusBar = true) => {
        const selectedProfile: Profile = await cmd.getUserProfile(fromStatusBar, true);
        const validWorkspace = await util.isValidWorkspace();
        let configInSync = false;
        if (validWorkspace.isValid && validWorkspace.folder) {
          const currentConfig = await util.getCurrentGitConfig(validWorkspace.folder);
          configInSync =
            currentConfig.email.toLowerCase() === selectedProfile.email.toLowerCase() && currentConfig.userName.toLowerCase() === selectedProfile.userName.toLowerCase();
        }

        statusBar.instance.updateStatus(selectedProfile, configInSync);
      })
    );
    Logger.instance.logInfo("Initializing commands complete.");
    await commands.executeCommand(constants.CommandIds.SYNC_VSC_PROFILES_WITH_GIT_CONFIG);
    await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, false);
  } catch (error) {
    Logger.instance.logError("Error ocurred", error);
  }
}

export function deactivate() {}
