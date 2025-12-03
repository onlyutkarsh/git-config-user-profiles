import * as vscode from "vscode";
import { CreateUserProfileCommand } from "./commands/CreateUserProfileCommand";
import { DeleteUserProfileCommand } from "./commands/DeleteUserProfileCommand";
import { EditUserProfileCommand } from "./commands/EditUserProfileCommand";
import { GetUserProfileCommand } from "./commands/GetUserProfileCommand";
import { PickUserProfileCommand } from "./commands/PickUserProfileCommand";
import { ShowStatusCommand } from "./commands/ShowStatusCommand";
import { StatusBarClickCommand } from "./commands/StatusBarClickCommand";
import { SyncVscProfilesWithGitConfig } from "./commands/SyncVscProfilesWithGitConfig";
import * as constants from "./constants";
import { LogCategory } from "./constants";
import { ProfileStatusBar as statusBar } from "./controls";
import { debounce } from "./util/debounce";
import { invalidateWorkspaceStatusCache } from "./util/gitManager";
import { Logger } from "./util/logger";

const _fileWatchersBySrc = new Map</* src: */ string, vscode.FileSystemWatcher>();

export async function activate(context: vscode.ExtensionContext) {
  try {
    Logger.instance.logInfo("Activating extension");

    registerCommands(context);

    createGitConfigFileWatcher();

    Logger.instance.logInfo("Initializing commands complete.");

    // Now register event listeners before initial load
    registerForVSCodeEditorEvents(context);

    // Get the initial user profile after everything is set up
    // Use setImmediate to allow extension to fully activate first
    setImmediate(async () => {
      try {
        await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "extension activated");
      } catch (error) {
        Logger.instance.logError("Error occurred during initial profile load", error as Error);
      }
    });
  } catch (error) {
    Logger.instance.logError("Error occurred during extension activation", error as Error);
  }
}

function registerCommands(context: vscode.ExtensionContext) {
  Logger.instance.logInfo("Initializing commands");
  context.subscriptions.push(vscode.commands.registerCommand(constants.CommandIds.STATUS_BAR_CLICK, new StatusBarClickCommand().execute));
  context.subscriptions.push(statusBar.instance.StatusBar);
  context.subscriptions.push(vscode.commands.registerCommand(constants.CommandIds.CREATE_USER_PROFILE, new CreateUserProfileCommand().execute));
  context.subscriptions.push(vscode.commands.registerCommand(constants.CommandIds.SYNC_VSC_PROFILES_WITH_GIT_CONFIG, new SyncVscProfilesWithGitConfig().execute));
  context.subscriptions.push(vscode.commands.registerCommand(constants.CommandIds.EDIT_USER_PROFILE, new EditUserProfileCommand().execute));
  context.subscriptions.push(vscode.commands.registerCommand(constants.CommandIds.GET_USER_PROFILE, new GetUserProfileCommand().execute));
  context.subscriptions.push(vscode.commands.registerCommand(constants.CommandIds.DELETE_USER_PROFILE, new DeleteUserProfileCommand().execute));
  context.subscriptions.push(vscode.commands.registerCommand(constants.CommandIds.PICK_USER_PROFILE, new PickUserProfileCommand().execute));
  context.subscriptions.push(vscode.commands.registerCommand(constants.CommandIds.SHOW_STATUS, new ShowStatusCommand().execute));
  statusBar.instance.attachCommand(constants.CommandIds.STATUS_BAR_CLICK);
}

function registerForVSCodeEditorEvents(context: vscode.ExtensionContext) {
  Logger.instance.logInfo("Registering for vs settings change event");

  // Debounced handler for editor changes to prevent flickering
  const debouncedGetUserProfile = debounce(async (origin: string) => {
    await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, origin);
  }, 300);

  // Debounce configuration changes to prevent multiple rapid calls
  const debouncedConfigChange = debounce(async () => {
    invalidateWorkspaceStatusCache();
    await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "changed settings");
  }, 300);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      // Only react to changes in our extension's configuration
      if (e.affectsConfiguration("gitConfigUser")) {
        Logger.instance.logDebug(LogCategory.SETTINGS_CHANGE, "Extension configuration changed", {
          affectsProfiles: e.affectsConfiguration("gitConfigUser.profiles"),
          affectsAutoSelect: e.affectsConfiguration("gitConfigUser.selectMatchedProfileAutomatically"),
        });
        debouncedConfigChange();
      }
    })
  );

  // Debounce editor changes to prevent flickering when switching between multiple editors
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      const editorInfo = editor
        ? {
            uri: editor.document.uri.toString(),
            scheme: editor.document.uri.scheme,
            fileName: editor.document.fileName,
            languageId: editor.document.languageId,
          }
        : { message: "No active editor" };

      Logger.instance.logDebug(LogCategory.WORKSPACE_STATUS, "Active text editor changed", editorInfo);
      debouncedGetUserProfile("changed active editor");
    })
  );

  // Keep workspace folder changes without debouncing as they're infrequent but important
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
      const changeInfo = {
        added: event.added.map((f) => ({ name: f.name, uri: f.uri.toString() })),
        removed: event.removed.map((f) => ({ name: f.name, uri: f.uri.toString() })),
        totalFolders: vscode.workspace.workspaceFolders?.length || 0,
      };

      Logger.instance.logDebug(LogCategory.WORKSPACE_STATUS, "Workspace folders changed", changeInfo);

      // Invalidate cache when workspace folders change
      invalidateWorkspaceStatusCache();
      await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "changed workspace folders");
    })
  );

  // Removed onDidOpenTextDocument and onDidCloseTextDocument as they are redundant
  // These events are already covered by onDidChangeActiveTextEditor
}

function createGitConfigFileWatcher() {
  // Delete stale file watchers.
  _fileWatchersBySrc.clear();

  const fsWatcher = vscode.workspace.createFileSystemWatcher("**/.git/config");
  fsWatcher.onDidChange(async (uri) => {
    Logger.instance.logDebug(LogCategory.GIT_CONFIG_FILE, "Git config file changed", { uri: uri.toString() });
    // Invalidate cache when git config file changes
    invalidateWorkspaceStatusCache();
    await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "changed git config");
  });
  fsWatcher.onDidCreate(async (uri) => {
    Logger.instance.logDebug(LogCategory.GIT_CONFIG_FILE, "Git config file created", { uri: uri.toString() });
    // Invalidate cache when git config file is created
    invalidateWorkspaceStatusCache();
    await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "created git config");
  });
  fsWatcher.onDidDelete(async (uri) => {
    Logger.instance.logDebug(LogCategory.GIT_CONFIG_FILE, "Git config file deleted", { uri: uri.toString() });
    // Invalidate cache when git config file is deleted
    invalidateWorkspaceStatusCache();
    await vscode.commands.executeCommand(constants.CommandIds.GET_USER_PROFILE, "deleted git config");
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
