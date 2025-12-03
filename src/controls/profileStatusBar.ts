import { basename } from "path";
import { MarkdownString, StatusBarAlignment, StatusBarItem, ThemeColor, window } from "vscode";
import * as Constants from "../constants";
import { LogCategory } from "../constants";
import { Profile } from "../models";
import { Logger } from "../util";

export enum StatusBarStatus {
  Normal = "Normal",
  Warning = "Warning",
}

// Icon constants
const ICONS = {
  SOURCE_CONTROL: "$(source-control)",
  ARROW: "$(arrow-small-right)",
  QUESTION: "$(question)",
  CHECK: "$(check)",
  ALERT: "$(alert)",
} as const;

export class ProfileStatusBar {
  private static _instance: ProfileStatusBar;
  private static _statusBar: StatusBarItem;

  // Lazy-initialized theme colors to avoid creating objects during module load
  private static _normalBackground?: ThemeColor;
  private static _warningBackground?: ThemeColor;

  private static get NORMAL_BACKGROUND(): ThemeColor {
    if (!this._normalBackground) {
      this._normalBackground = new ThemeColor("statusBarItem.activeBackground");
    }
    return this._normalBackground;
  }

  private static get WARNING_BACKGROUND(): ThemeColor {
    if (!this._warningBackground) {
      this._warningBackground = new ThemeColor("statusBarItem.warningBackground");
    }
    return this._warningBackground;
  }

  static get instance(): ProfileStatusBar {
    if (!ProfileStatusBar._instance) {
      ProfileStatusBar._instance = new ProfileStatusBar();
    }
    return ProfileStatusBar._instance;
  }

  private constructor() {
    ProfileStatusBar._statusBar = window.createStatusBarItem(StatusBarAlignment.Right, 1000000);
    Logger.instance.logInfo("Initializing status bar complete.");
  }

  /**
   * Helper method to clean profile label by removing status icons
   */
  private cleanProfileLabel(label: string): string {
    return label.replace(ICONS.CHECK, "").replace(ICONS.ALERT, "").trim();
  }

  /**
   * Helper method to build the status bar text
   */
  private buildStatusText(profile: Profile | undefined, repoFolder: string | undefined, status: StatusBarStatus): string {
    const repoName = repoFolder ? basename(repoFolder) : Constants.Application.APPLICATION_NAME;

    if (!profile) {
      return `${ICONS.SOURCE_CONTROL} ${repoName} ${ICONS.ARROW} No Profile ${ICONS.QUESTION}`;
    }

    const cleanLabel = this.cleanProfileLabel(profile.label);

    // Show alert icon when profile is out of sync (warning status)
    if (status === StatusBarStatus.Warning) {
      return `${ICONS.SOURCE_CONTROL} ${repoName} ${ICONS.ARROW} ${cleanLabel} ${ICONS.ALERT}`;
    }

    return `${ICONS.SOURCE_CONTROL} ${repoName} ${ICONS.ARROW} ${cleanLabel}`;
  }

  /**
   * Helper method to build the tooltip text
   */
  private buildTooltip(
    profile: Profile | undefined,
    status: StatusBarStatus,
    customTooltip?: string,
    currentGitConfig?: { userName: string; email: string; signingKey: string }
  ): string | MarkdownString {
    // Log what we're building
    Logger.instance.logDebug(LogCategory.STATUS_BAR, "Building tooltip", {
      hasCustomTooltip: !!customTooltip,
      customTooltipValue: customTooltip,
      hasProfile: !!profile,
      profileLabel: profile?.label,
      status: StatusBarStatus[status],
      hasCurrentGitConfig: !!currentGitConfig
    });

    if (customTooltip) {
      Logger.instance.logDebug(LogCategory.STATUS_BAR, "Using custom tooltip", { customTooltip });

      // Beautify all custom messages with markdown formatting
      const beautifiedTooltip = new MarkdownString();
      beautifiedTooltip.isTrusted = true;
      beautifiedTooltip.supportHtml = false;

      // Handle different custom tooltip scenarios
      if (customTooltip === "Open a file from a git repository") {
        beautifiedTooltip.appendMarkdown(`📂 **No File Open**`);
        return beautifiedTooltip;
      }

      if (customTooltip === "This does not seem to be a valid git repository") {
        beautifiedTooltip.appendMarkdown(`⚠️ **Not a Git Repository**`);
        return beautifiedTooltip;
      }

      if (customTooltip === "No profiles found in settings.") {
        beautifiedTooltip.appendMarkdown(`📋 **No Profiles Created**`);
        return beautifiedTooltip;
      }

      if (customTooltip === "No profile selected in settings for this workspace.") {
        beautifiedTooltip.appendMarkdown(`⚠️ **No Profile Selected**`);
        return beautifiedTooltip;
      }

      if (customTooltip.includes("One of label, userName or email properties is missing")) {
        beautifiedTooltip.appendMarkdown(`❌ **Profile Configuration Error**`);
        return beautifiedTooltip;
      }

      // For any other custom tooltip, still use markdown formatting for consistency
      beautifiedTooltip.appendMarkdown(`ℹ️ **${customTooltip}**`);
      return beautifiedTooltip;
    }

    if (!profile) {
      // This should rarely be hit now - only if there's an unexpected state
      // Log it so we can track if this happens
      Logger.instance.logDebug(LogCategory.STATUS_BAR, "No profile and no custom tooltip - unexpected state", {
        status: StatusBarStatus[status],
        hasCurrentGitConfig: !!currentGitConfig
      });
      const genericTooltip = new MarkdownString();
      genericTooltip.isTrusted = true;
      genericTooltip.supportHtml = false;
      genericTooltip.appendMarkdown(`ℹ️ **${Constants.Application.APPLICATION_NAME}**`);
      return genericTooltip;
    }

    const tooltip = new MarkdownString();
    tooltip.isTrusted = true;
    tooltip.supportHtml = false;

    if (status === StatusBarStatus.Normal) {
      Logger.instance.logDebug(LogCategory.STATUS_BAR, "Building normal status tooltip with profile details", {
        userName: profile.userName,
        email: profile.email,
        hasSigningKey: !!profile.signingKey
      });
      tooltip.appendMarkdown(`✅ **${this.cleanProfileLabel(profile.label)}**`);
      return tooltip;
    }

    // Warning status - show comparison between profile and git config
    if (status === StatusBarStatus.Warning && currentGitConfig) {
      tooltip.appendMarkdown(`⚠️ **Git Config Out of Sync**`);
      return tooltip;
    }

    // Fallback for any other case - show a helpful tooltip with markdown formatting
    const fallbackTooltip = new MarkdownString();
    fallbackTooltip.isTrusted = true;
    fallbackTooltip.supportHtml = false;
    fallbackTooltip.appendMarkdown(`ℹ️ **${Constants.Application.APPLICATION_NAME}**`);
    return fallbackTooltip;
  }

  public async updateStatus(
    content: Profile | undefined,
    repoFolder: string | undefined,
    status: StatusBarStatus = StatusBarStatus.Normal,
    tooltip?: string,
    currentGitConfig?: { userName: string; email: string; signingKey: string }
  ) {
    // Hide status bar when dealing with non-file schemes or when not applicable
    // Empty tooltip with no profile and no repo folder indicates a silent ignore case (e.g., non-file scheme)
    if (!content && !repoFolder && (!tooltip || tooltip.length === 0)) {
      ProfileStatusBar._statusBar.hide();
      return;
    }

    const text = this.buildStatusText(content, repoFolder, status);
    const finalTooltip = this.buildTooltip(content, status, tooltip, currentGitConfig);
    const backgroundColor = status === StatusBarStatus.Normal ? ProfileStatusBar.NORMAL_BACKGROUND : ProfileStatusBar.WARNING_BACKGROUND;

    ProfileStatusBar._statusBar.text = text;
    ProfileStatusBar._statusBar.backgroundColor = backgroundColor;
    ProfileStatusBar._statusBar.tooltip = finalTooltip;
    ProfileStatusBar._statusBar.show();
  }

  public hide() {
    ProfileStatusBar._statusBar.hide();
  }

  public attachCommand(commandId: string) {
    ProfileStatusBar._statusBar.command = commandId;
  }

  public get StatusBar(): StatusBarItem {
    return ProfileStatusBar._statusBar;
  }
}
