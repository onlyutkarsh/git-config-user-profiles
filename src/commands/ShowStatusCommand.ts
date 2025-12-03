import { basename } from "path";
import * as vscode from "vscode";
import { LogCategory } from "../constants";
import { Logger } from "../util";
import * as gm from "../util/gitManager";
import { ICommand, Result } from "./ICommand";

export class ShowStatusCommand implements ICommand<void> {
  constructor() {}

  async execute(): Promise<Result<void>> {
    Logger.instance.logInfo("Showing extension status");

    const result = await gm.getWorkspaceStatus();

    let statusMessage = "";

    const isNotValidGitRepo = result.status === gm.WorkspaceStatus.NotAValidWorkspace && !result.currentFolder;

    if (isNotValidGitRepo) {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        Logger.instance.logDebug(LogCategory.STATUS_BAR, "No active editor open", {});
        statusMessage = "The status bar is hidden because no file is currently open. Open a file from a git repository to see profile information.";
      } else {
        const editorPath = editor.document.uri.fsPath;
        const scheme = editor.document.uri.scheme;
        Logger.instance.logDebug(LogCategory.STATUS_BAR, "Open file is not in a git repository", {
          filePath: editorPath,
          scheme: scheme,
        });

        // Provide specific message for notebooks
        if (scheme === "vscode-notebook-cell") {
          statusMessage = "The status bar is hidden because the notebook is not in a git repository.";
        } else {
          statusMessage = "The status bar is hidden because the current workspace is not a git repository.";
        }
      }
    } else if (result.currentFolder) {
      const repoName = basename(result.currentFolder);

      if (result.status === gm.WorkspaceStatus.NoProfilesInConfig) {
        Logger.instance.logDebug(LogCategory.STATUS_BAR, "No profiles in config", { repository: repoName });
        statusMessage = "No profiles created yet.";
      } else if (result.status === gm.WorkspaceStatus.NoSelectedProfilesInConfig) {
        Logger.instance.logDebug(LogCategory.STATUS_BAR, "No profile selected", {
          repository: repoName,
          availableProfiles: result.profilesInVSConfigCount,
        });
        statusMessage = `No profile selected. ${result.profilesInVSConfigCount} profile(s) available.`;
      } else if (result.status === gm.WorkspaceStatus.FieldsMissing) {
        Logger.instance.logDebug(LogCategory.STATUS_BAR, "Profile has missing fields", {
          repository: repoName,
          profileLabel: result.selectedProfile?.label,
        });
        statusMessage = `Selected profile has issues. ${result.message || "Missing required fields."}`;
      } else if (result.status === gm.WorkspaceStatus.ConfigOutofSync) {
        Logger.instance.logDebug(LogCategory.STATUS_BAR, "Profile out of sync", {
          repository: repoName,
          profileLabel: result.selectedProfile?.label,
          profileUser: result.selectedProfile?.userName,
          profileEmail: result.selectedProfile?.email,
          gitUser: result.currentGitConfig?.userName,
          gitEmail: result.currentGitConfig?.email,
        });
        statusMessage = `Profile '${result.selectedProfile?.label}' is out of sync. ${result.message || "Username or email does not match .gitconfig."}`;
      } else if (result.status === gm.WorkspaceStatus.NoIssues) {
        Logger.instance.logDebug(LogCategory.STATUS_BAR, "Profile active and in sync", {
          repository: repoName,
          profileLabel: result.selectedProfile?.label,
          userName: result.currentGitConfig?.userName,
          email: result.currentGitConfig?.email,
        });
        statusMessage = `Profile '${result.selectedProfile?.label}' is active because username and email match .gitconfig.`;
      }
    } else {
      statusMessage = "The extension is in an unexpected state.";
    }

    await vscode.window.showInformationMessage(statusMessage, "OK");

    return {};
  }
}
