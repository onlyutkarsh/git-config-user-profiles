import { basename } from "path";
import { LogCategory } from "../constants";
import { StatusBarStatus, ProfileStatusBar as statusBar } from "../controls";
import { Logger } from "../util";
import * as gm from "../util/gitManager";
import { ICommand, Result } from "./ICommand";

export class GetUserProfileCommand implements ICommand<void> {
  constructor() {}

  async execute(origin?: string): Promise<Result<void>> {
    Logger.instance.logDebug(LogCategory.PROFILE_MATCHING, "Getting user profiles from settings", { origin });

    const result = await gm.getWorkspaceStatus();

    // Hide status bar if not in a valid workspace (not a git repo)
    // but allow showing it when there's no active editor or no profiles
    const isNotValidGitRepo = result.status === gm.WorkspaceStatus.NotAValidWorkspace && !result.currentFolder;

    if (isNotValidGitRepo) {
      Logger.instance.logDebug(LogCategory.PROFILE_MATCHING, "Hiding status bar - not in a git repository", {
        status: gm.WorkspaceStatus[result.status],
        message: result.message,
      });
      await statusBar.instance.hide();
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

    Logger.instance.logDebug(LogCategory.PROFILE_MATCHING, "Updating status bar", {
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
