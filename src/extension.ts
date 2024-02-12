import { commands, ExtensionContext, FileSystemWatcher, window, workspace } from "vscode";
import { CreateUserProfileCommand } from "./commands/CreateUserProfileCommand";
import { DeleteUserProfileCommand } from "./commands/DeleteUserProfileCommand";
import { EditUserProfileCommand } from "./commands/EditUserProfileCommand";
import { GetUserProfileCommand } from "./commands/GetUserProfileCommand";
import { PickUserProfileCommand } from "./commands/PickUserProfileCommand";
import { StatusBarClickCommand } from "./commands/StatusBarClickCommand";
import { SyncVscProfilesWithGitConfig } from "./commands/SyncVscProfilesWithGitConfig";
import * as constants from "./constants";
import { ProfileStatusBar as statusBar } from "./controls";
import { Logger } from "./util/logger";

const _fileWatchersBySrc = new Map</* src: */ string, FileSystemWatcher>();

export async function activate(context: ExtensionContext) {
  try {
    Logger.instance.logInfo("Activating extension");

    registerForVSCodeEditorEvents(context);

    registerCommands(context);

    createGitConfigFileWatcher();

    Logger.instance.logInfo("Initializing commands complete.");
  } catch (error) {
    Logger.instance.logError("Error ocurred", error as Error);
  }
}

function registerCommands(context: ExtensionContext) {
  Logger.instance.logInfo("Initializing commands");
  context.subscriptions.push(commands.registerCommand(constants.CommandIds.STATUS_BAR_CLICK, new StatusBarClickCommand().execute));
  context.subscriptions.push(statusBar.instance.StatusBar);
  context.subscriptions.push(commands.registerCommand(constants.CommandIds.CREATE_USER_PROFILE, new CreateUserProfileCommand().execute));
  context.subscriptions.push(commands.registerCommand(constants.CommandIds.SYNC_VSC_PROFILES_WITH_GIT_CONFIG, new SyncVscProfilesWithGitConfig().execute));
  context.subscriptions.push(commands.registerCommand(constants.CommandIds.EDIT_USER_PROFILE, new EditUserProfileCommand().execute));
  context.subscriptions.push(commands.registerCommand(constants.CommandIds.GET_USER_PROFILE, new GetUserProfileCommand().execute));
  context.subscriptions.push(commands.registerCommand(constants.CommandIds.DELETE_USER_PROFILE, new DeleteUserProfileCommand().execute));
  context.subscriptions.push(commands.registerCommand(constants.CommandIds.PICK_USER_PROFILE, new PickUserProfileCommand().execute));
  Logger.instance.logInfo("Initializing status bar");
  statusBar.instance.attachCommand(constants.CommandIds.STATUS_BAR_CLICK);
}

function registerForVSCodeEditorEvents(context: ExtensionContext) {
  Logger.instance.logInfo("Registering for vs settings change event");
  context.subscriptions.push(workspace.onDidChangeConfiguration(async () => await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "changed settings")));
  context.subscriptions.push(window.onDidChangeActiveTextEditor(async () => await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "changed active editor")));
  context.subscriptions.push(workspace.onDidChangeWorkspaceFolders(async () => await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "changed workspace folders")));

  context.subscriptions.push(workspace.onDidOpenTextDocument(async () => await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "opened text document")));
  context.subscriptions.push(workspace.onDidCloseTextDocument(async () => await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "closed text document")));
}

function createGitConfigFileWatcher() {
  // Delete stale file watchers.
  _fileWatchersBySrc.clear();

  const fsWatcher = workspace.createFileSystemWatcher("**/.git/config");
  fsWatcher.onDidChange(async () => {
    await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "changed git config");
  });
  fsWatcher.onDidCreate(async () => {
    await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "created git config");
  });
  fsWatcher.onDidDelete(async () => {
    await commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "deleted git config");
  });
  _fileWatchersBySrc.set("**/.git/config", fsWatcher);
  Logger.instance.logInfo("File watcher created for git config");
}

export function deactivate() {
  for (const entry of _fileWatchersBySrc.values()) {
    entry.dispose();
  }
  _fileWatchersBySrc.clear();
}
