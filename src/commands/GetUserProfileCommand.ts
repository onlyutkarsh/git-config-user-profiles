import { basename } from "path";
import * as vscode from "vscode";
import { LogCategory, Messages } from "../constants";
import { StatusBarStatus, ProfileStatusBar as statusBar } from "../controls";
import { Logger } from "../util";
import * as gm from "../util/gitManager";
import { ICommand, Result } from "./ICommand";

export class GetUserProfileCommand implements ICommand<void> {
  constructor() {}

  async execute(origin?: string): Promise<Result<void>> {
    Logger.instance.logTrace(LogCategory.PROFILE_MATCHING, "Getting user profiles from settings", { origin });

    const result = await gm.getWorkspaceStatus();

    Logger.instance.logDebug(LogCategory.STATUS_BAR, "Workspace status evaluated", {
      origin,
      status: gm.WorkspaceStatus[result.status],
      message: result.message || "<none>",
      hasCurrentFolder: !!result.currentFolder,
      currentFolder: result.currentFolder ? basename(result.currentFolder) : "<none>",
      hasSelectedProfile: !!result.selectedProfile,
      selectedProfile: result.selectedProfile?.label ?? "<none>",
      configInSync: result.configInSync ?? "<n/a>",
      platform: process.platform,
    });

    const visibility = vscode.workspace.getConfiguration("gitConfigUser").get<string>("statusBarVisibility") ?? "always";

    Logger.instance.logDebug(LogCategory.STATUS_BAR, "Status bar visibility setting", { visibility });

    const isActuallyNotAGitRepo =
      result.status === gm.WorkspaceStatus.NotAValidWorkspace &&
      !result.currentFolder &&
      result.message === Messages.NOT_A_VALID_REPO;

    if (isActuallyNotAGitRepo) {
      if (visibility === "git-repos-only") {
        Logger.instance.logDebug(LogCategory.STATUS_BAR, "Hiding status bar - not a git repository (git-repos-only mode)", {
          platform: process.platform,
        });
        await statusBar.instance.hide();
      } else {
        // "always" mode: show with "not a git repo" tooltip instead of hiding
        Logger.instance.logDebug(LogCategory.STATUS_BAR, "Showing status bar with 'not a git repo' tooltip (always mode)", {
          platform: process.platform,
        });
        await statusBar.instance.updateStatus(undefined, undefined, StatusBarStatus.Normal, result.message);
      }
      return {};
    }

    // No active editor (or non-file scheme active)
    const isNoActiveEditor =
      result.status === gm.WorkspaceStatus.NotAValidWorkspace &&
      !result.currentFolder &&
      result.message !== Messages.NOT_A_VALID_REPO;

    if (isNoActiveEditor) {
      if (visibility === "git-repos-only") {
        Logger.instance.logDebug(LogCategory.STATUS_BAR, "Hiding status bar - no active editor (git-repos-only mode)", {
          platform: process.platform,
        });
        await statusBar.instance.hide();
      } else {
        const promptMessage = result.message || "Open a file from a git repository";
        Logger.instance.logDebug(LogCategory.STATUS_BAR, "No active editor - showing status bar with prompt tooltip (always mode)", {
          message: promptMessage,
          workspaceFolderCount: vscode.workspace.workspaceFolders?.length ?? 0,
          platform: process.platform,
        });
        await statusBar.instance.updateStatus(undefined, undefined, StatusBarStatus.Normal, promptMessage);
      }
      return {};
    }

    // Don't show warnings if the message is empty (indicates non-file scheme or other silent ignore case)
    const shouldShowWarning = result.message && result.message.length > 0 && !result.configInSync;

    // Pass custom tooltip if:
    // 1. There's a message AND config is in sync (profile applied successfully, etc.)
    // 2. There's a message AND no profile (NotAValidWorkspace cases: no editor, not git repo, etc.)
    // For out-of-sync cases with a profile, let buildTooltip create the detailed comparison
    const hasMessage = result.message && result.message.length > 0;
    const shouldUseCustomTooltip = hasMessage && (result.configInSync || !result.selectedProfile);
    const customTooltip = shouldUseCustomTooltip ? result.message : undefined;

    Logger.instance.logTrace(LogCategory.PROFILE_MATCHING, "Updating status bar", {
      hasProfile: !!result.selectedProfile,
      profileLabel: result.selectedProfile?.label,
      hasFolder: !!result.currentFolder,
      folder: result.currentFolder ? basename(result.currentFolder) : undefined,
      status: shouldShowWarning ? "Warning" : "Normal",
      customTooltip: customTooltip || "<none>",
      configInSync: result.configInSync,
    });

    await statusBar.instance.updateStatus(
      result.selectedProfile,
      result.currentFolder,
      shouldShowWarning ? StatusBarStatus.Warning : StatusBarStatus.Normal,
      customTooltip,
      result.currentGitConfig
    );
    return {};
  }
}
