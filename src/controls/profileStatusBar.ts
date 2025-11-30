import { basename } from "path";
import { MarkdownString, StatusBarAlignment, StatusBarItem, ThemeColor, window } from "vscode";
import * as Constants from "../constants";
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
    Logger.instance.logDebug("Tooltip", "Building tooltip", {
      hasCustomTooltip: !!customTooltip,
      customTooltipValue: customTooltip,
      hasProfile: !!profile,
      profileLabel: profile?.label,
      status: StatusBarStatus[status],
      hasCurrentGitConfig: !!currentGitConfig
    });

    if (customTooltip) {
      Logger.instance.logDebug("Tooltip", "Using custom tooltip", { customTooltip });

      // Beautify all custom messages with markdown formatting
      const beautifiedTooltip = new MarkdownString();
      beautifiedTooltip.isTrusted = true;
      beautifiedTooltip.supportHtml = false;

      // Handle different custom tooltip scenarios
      if (customTooltip === "Open a file from a git repository") {
        beautifiedTooltip.appendMarkdown(`**${Constants.Application.APPLICATION_NAME}**\n\n`);
        beautifiedTooltip.appendMarkdown(`📂 No file is currently open\n\n`);
        beautifiedTooltip.appendMarkdown(`---\n\n`);
        beautifiedTooltip.appendMarkdown(`To use this extension:\n\n`);
        beautifiedTooltip.appendMarkdown(`1. Open a file from a git repository\n`);
        beautifiedTooltip.appendMarkdown(`2. Select a profile for that repository\n\n`);
        beautifiedTooltip.appendMarkdown(`_Click status bar icon for more options_`);
        return beautifiedTooltip;
      }

      if (customTooltip === "This does not seem to be a valid git repository") {
        beautifiedTooltip.appendMarkdown(`**${Constants.Application.APPLICATION_NAME}**\n\n`);
        beautifiedTooltip.appendMarkdown(`⚠️ Not a Git Repository\n\n`);
        beautifiedTooltip.appendMarkdown(`---\n\n`);
        beautifiedTooltip.appendMarkdown(`The current folder does not appear to be a git repository.\n\n`);
        beautifiedTooltip.appendMarkdown(`Make sure you have:\n`);
        beautifiedTooltip.appendMarkdown(`- Initialized git (\`git init\`)\n`);
        beautifiedTooltip.appendMarkdown(`- Or cloned a repository\n\n`);
        beautifiedTooltip.appendMarkdown(`_Click status bar icon for more options_`);
        return beautifiedTooltip;
      }

      if (customTooltip === "No profiles found in settings.") {
        beautifiedTooltip.appendMarkdown(`**${Constants.Application.APPLICATION_NAME}**\n\n`);
        beautifiedTooltip.appendMarkdown(`📋 No Profiles Created\n\n`);
        beautifiedTooltip.appendMarkdown(`---\n\n`);
        beautifiedTooltip.appendMarkdown(`You haven't created any profiles yet.\n\n`);
        beautifiedTooltip.appendMarkdown(`_Click status bar icon to create your first profile_`);
        return beautifiedTooltip;
      }

      if (customTooltip === "No profile selected in settings for this workspace.") {
        beautifiedTooltip.appendMarkdown(`**${Constants.Application.APPLICATION_NAME}**\n\n`);
        beautifiedTooltip.appendMarkdown(`⚠️ No Profile Selected\n\n`);
        beautifiedTooltip.appendMarkdown(`---\n\n`);
        beautifiedTooltip.appendMarkdown(`No profile has been selected for this repository.\n\n`);
        beautifiedTooltip.appendMarkdown(`_Click status bar icon to select a profile_`);
        return beautifiedTooltip;
      }

      if (customTooltip.includes("One of label, userName or email properties is missing")) {
        beautifiedTooltip.appendMarkdown(`**${Constants.Application.APPLICATION_NAME}**\n\n`);
        beautifiedTooltip.appendMarkdown(`❌ Profile Configuration Error\n\n`);
        beautifiedTooltip.appendMarkdown(`---\n\n`);
        beautifiedTooltip.appendMarkdown(`The selected profile is missing required information.\n\n`);
        beautifiedTooltip.appendMarkdown(`Please ensure your profile has:\n`);
        beautifiedTooltip.appendMarkdown(`- Label (profile name)\n`);
        beautifiedTooltip.appendMarkdown(`- Username\n`);
        beautifiedTooltip.appendMarkdown(`- Email address\n\n`);
        beautifiedTooltip.appendMarkdown(`_Click status bar icon to edit the profile_`);
        return beautifiedTooltip;
      }

      // For any other custom tooltip, still use markdown formatting for consistency
      beautifiedTooltip.appendMarkdown(`**${Constants.Application.APPLICATION_NAME}**\n\n`);
      beautifiedTooltip.appendMarkdown(`${customTooltip}\n\n`);
      beautifiedTooltip.appendMarkdown(`_Click status bar icon for more options_`);
      return beautifiedTooltip;
    }

    if (!profile) {
      // This should rarely be hit now - only if there's an unexpected state
      // Log it so we can track if this happens
      Logger.instance.logDebug("Tooltip", "No profile and no custom tooltip - unexpected state", {
        status: StatusBarStatus[status],
        hasCurrentGitConfig: !!currentGitConfig
      });
      const genericTooltip = new MarkdownString();
      genericTooltip.isTrusted = true;
      genericTooltip.supportHtml = false;
      genericTooltip.appendMarkdown(`**${Constants.Application.APPLICATION_NAME}**\n\n`);
      genericTooltip.appendMarkdown(`_Click status bar icon for more options_`);
      return genericTooltip;
    }

    const tooltip = new MarkdownString();
    tooltip.isTrusted = true;
    tooltip.supportHtml = false;

    if (status === StatusBarStatus.Normal) {
      Logger.instance.logDebug("Tooltip", "Building normal status tooltip with profile details", {
        userName: profile.userName,
        email: profile.email,
        hasSigningKey: !!profile.signingKey
      });
      tooltip.appendMarkdown(`**Name:** ${profile.userName}\n\n`);
      tooltip.appendMarkdown(`**Email:** ${profile.email}\n\n`);
      if (profile.signingKey) {
        tooltip.appendMarkdown(`**Signing Key:** \`${profile.signingKey}\`\n\n`);
      }
      tooltip.appendMarkdown(`---\n\n`);
      tooltip.appendMarkdown(`_Click status bar icon for more options_`);
      return tooltip;
    }

    // Warning status - show comparison between profile and git config
    if (status === StatusBarStatus.Warning && currentGitConfig) {
      tooltip.appendMarkdown(`**⚠️ Git Config Out of Sync**\n\n`);

      let hasDifferences = false;

      // Compare and show differences in compact format
      if (profile.userName !== currentGitConfig.userName) {
        tooltip.appendMarkdown(`- **Name:** \`${profile.userName || "<empty>"}\` → \`${currentGitConfig.userName || "<empty>"}\`\n`);
        hasDifferences = true;
      }

      if (profile.email.toLowerCase() !== currentGitConfig.email.toLowerCase()) {
        tooltip.appendMarkdown(`- **Email:** \`${profile.email || "<empty>"}\` → \`${currentGitConfig.email || "<empty>"}\`\n`);
        hasDifferences = true;
      }

      if ((profile.signingKey || currentGitConfig.signingKey) &&
          profile.signingKey.toLowerCase() !== currentGitConfig.signingKey.toLowerCase()) {
        tooltip.appendMarkdown(`- **Signing Key:** \`${profile.signingKey || "<not set>"}\` → \`${currentGitConfig.signingKey || "<not set>"}\`\n`);
        hasDifferences = true;
      }

      if (hasDifferences) {
        tooltip.appendMarkdown(`\n---\n\n`);
        tooltip.appendMarkdown(`_Click status bar icon to apply profile settings_`);
        return tooltip;
      }
    }

    // Fallback for any other case - show a helpful tooltip with markdown formatting
    const fallbackTooltip = new MarkdownString();
    fallbackTooltip.isTrusted = true;
    fallbackTooltip.supportHtml = false;
    fallbackTooltip.appendMarkdown(`**${Constants.Application.APPLICATION_NAME}**\n\n`);
    fallbackTooltip.appendMarkdown(`_Click status bar icon for more options_`);
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

  public attachCommand(commandId: string) {
    ProfileStatusBar._statusBar.command = commandId;
  }

  public get StatusBar(): StatusBarItem {
    return ProfileStatusBar._statusBar;
  }
}
