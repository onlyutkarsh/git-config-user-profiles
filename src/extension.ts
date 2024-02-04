import { commands, ExtensionContext, window, workspace } from "vscode";
import * as cmd from "./commands";
import { CreateUserProfileCommand } from "./commands/CreateUserProfileCommand";
import { GetUserProfileCommand } from "./commands/GetUserProfileCommand";
import { SyncVscProfilesWithGitConfig } from "./commands/SyncVscProfilesWithGitConfig";
import * as constants from "./constants";
import { ProfileStatusBar as statusBar } from "./controls";
import { Profile } from "./models";
import * as util from "./util";
import { Logger } from "./util/logger";

export async function activate(context: ExtensionContext) {
  try {
    Logger.instance.logInfo("Activating extension");

    Logger.instance.logInfo("Registering for config change event");
    context.subscriptions.push(workspace.onDidChangeConfiguration(async () => await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, false)));

    context.subscriptions.push(window.onDidChangeActiveTextEditor(async () => await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, false)));
    context.subscriptions.push(workspace.onDidChangeWorkspaceFolders(async () => await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, false)));
    context.subscriptions.push(workspace.onDidOpenTextDocument(async () => await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, false)));
    context.subscriptions.push(workspace.onDidCloseTextDocument(async () => await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, false)));

    Logger.instance.logInfo("Initializing status bar");

    statusBar.instance.attachCommand(constants.CommandIds.GET_USER_PROFILE);

    Logger.instance.logInfo("Initializing commands");
    context.subscriptions.push(statusBar.instance.StatusBar);
    context.subscriptions.push(commands.registerCommand(constants.CommandIds.CREATE_USER_PROFILE, new CreateUserProfileCommand().execute));
    context.subscriptions.push(commands.registerCommand(constants.CommandIds.SYNC_VSC_PROFILES_WITH_GIT_CONFIG, new SyncVscProfilesWithGitConfig().execute));
    context.subscriptions.push(commands.registerCommand(constants.CommandIds.EDIT_USER_PROFILE, cmd.editUserProfile));
    context.subscriptions.push(
      commands.registerCommand(constants.CommandIds.GET_USER_PROFILE, async (fromStatusBar = true) => {
        const result = await new GetUserProfileCommand(fromStatusBar, true).execute();
        const selectedProfile = result.result as Profile;
        const validWorkspace = await util.isValidWorkspace();
        let configInSync = false;
        if (validWorkspace.isValid && validWorkspace.folder) {
          const currentConfig = await util.getCurrentGitConfig(validWorkspace.folder);
          configInSync =
            currentConfig.email.toLowerCase() === selectedProfile.email.toLowerCase() && currentConfig.userName.toLowerCase() === selectedProfile.userName.toLowerCase();
        }

        await statusBar.instance.updateStatus(selectedProfile, configInSync);
      })
    );
    Logger.instance.logInfo("Initializing commands complete.");
    await commands.executeCommand(constants.CommandIds.SYNC_VSC_PROFILES_WITH_GIT_CONFIG);
    await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, false);
  } catch (error) {
    Logger.instance.logError("Error ocurred", error as Error);
  }
}

export function deactivate() {}
