import { basename } from "path";
import { MarkdownString, StatusBarAlignment, StatusBarItem, ThemeColor, window, workspace } from "vscode";
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
    this.createStatusBarItem();
    Logger.instance.logInfo("Initializing status bar complete.");
  }

  /**
   * Get the status bar alignment from user configuration
   */
  private getStatusBarAlignment(): StatusBarAlignment {
    const config = workspace.getConfiguration("gitConfigUser").get<string>("statusBarAlignment") || "right";
    return config === "left" ? StatusBarAlignment.Left : StatusBarAlignment.Right;
  }

  /**
   * Create or recreate the status bar item with current configuration
   */
  private createStatusBarItem() {
    const alignment = this.getStatusBarAlignment();
    // For Left alignment: high priority (1000000) places it at the far left (first item)
    // For Right alignment: low priority (0) places it at the far right (first item from right edge)
    const priority = alignment === StatusBarAlignment.Left ? 1000000 : 0;

    // If status bar already exists, dispose it first
    if (ProfileStatusBar._statusBar) {
      ProfileStatusBar._statusBar.dispose();
    }

    ProfileStatusBar._statusBar = window.createStatusBarItem(alignment, priority);
    Logger.instance.logDebug(LogCategory.STATUS_BAR, "Status bar item created/recreated", {
      alignment: alignment === StatusBarAlignment.Left ? "left" : "right",
      priority,
    });
  }

  /**
   * Recreate the status bar item when alignment configuration changes
   */
  public recreateStatusBarItem() {
    const wasVisible = ProfileStatusBar._statusBar ? ProfileStatusBar._statusBar.text.length > 0 : false;
    const previousText = ProfileStatusBar._statusBar?.text;
    const previousTooltip = ProfileStatusBar._statusBar?.tooltip;
    const previousCommand = ProfileStatusBar._statusBar?.command;
    const previousBackgroundColor = ProfileStatusBar._statusBar?.backgroundColor;

    this.createStatusBarItem();

    // Restore previous state
    if (wasVisible && previousText) {
      ProfileStatusBar._statusBar.text = previousText;
      ProfileStatusBar._statusBar.tooltip = previousTooltip;
      ProfileStatusBar._statusBar.command = previousCommand;
      ProfileStatusBar._statusBar.backgroundColor = previousBackgroundColor;
      ProfileStatusBar._statusBar.show();
    }
  }

  /**
   * Helper method to clean profile label by removing status icons
   */
  private cleanProfileLabel(label: string): string {
    return label.replace(ICONS.CHECK, "").replace(ICONS.ALERT, "").trim();
  }

  /**
   * Helper method to build the status bar text based on user's format preference
   */
  private buildStatusText(profile: Profile | undefined, repoFolder: string | undefined, status: StatusBarStatus): string {
    const format = workspace.getConfiguration("gitConfigUser").get<string>("statusBarFormat") || "full";
    const repoName = repoFolder ? basename(repoFolder) : Constants.Application.APPLICATION_NAME;
    const cleanLabel = profile ? this.cleanProfileLabel(profile.label) : "No Profile";
    const statusIcon = status === StatusBarStatus.Warning ? ICONS.ALERT : "";

    // Handle different display formats
    switch (format) {
      case "compact":
        // Format: git-icon profile [status-icon]
        if (!profile) {
          return `${ICONS.SOURCE_CONTROL} ${cleanLabel} ${ICONS.QUESTION}`;
        }
        return statusIcon ? `${ICONS.SOURCE_CONTROL} ${cleanLabel} ${statusIcon}` : `${ICONS.SOURCE_CONTROL} ${cleanLabel}`;

      case "full":
      default:
        // Format: git-icon repo-name > profile [status-icon]
        if (!profile) {
          return `${ICONS.SOURCE_CONTROL} ${repoName} ${ICONS.ARROW} ${cleanLabel} ${ICONS.QUESTION}`;
        }
        return statusIcon ? `${ICONS.SOURCE_CONTROL} ${repoName} ${ICONS.ARROW} ${cleanLabel} ${statusIcon}` : `${ICONS.SOURCE_CONTROL} ${repoName} ${ICONS.ARROW} ${cleanLabel}`;
    }
  }

  /**
   * Helper method to build the tooltip text
   * When using compact display modes, the tooltip shows more details
   */
  private buildTooltip(
    profile: Profile | undefined,
    status: StatusBarStatus,
    customTooltip?: string,
    currentGitConfig?: { userName: string; email: string; signingKey: string },
    repoFolder?: string
  ): string | MarkdownString {
    // Log what we're building
    Logger.instance.logTrace(LogCategory.STATUS_BAR, "Building tooltip", {
      hasCustomTooltip: !!customTooltip,
      customTooltipValue: customTooltip,
      hasProfile: !!profile,
      profileLabel: profile?.label,
      status: StatusBarStatus[status],
      hasCurrentGitConfig: !!currentGitConfig,
    });

    if (customTooltip) {
      Logger.instance.logTrace(LogCategory.STATUS_BAR, "Using custom tooltip", { customTooltip });

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
      Logger.instance.logTrace(LogCategory.STATUS_BAR, "No profile and no custom tooltip - unexpected state", {
        status: StatusBarStatus[status],
        hasCurrentGitConfig: !!currentGitConfig,
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
      Logger.instance.logTrace(LogCategory.STATUS_BAR, "Building normal status tooltip with profile details", {
        userName: profile.userName,
        email: profile.email,
        hasSigningKey: !!profile.signingKey,
      });

      const format = workspace.getConfiguration("gitConfigUser").get<string>("statusBarFormat") || "full";

      // Build descriptive tooltip for in-sync profiles
      tooltip.appendMarkdown(`✅ **Profile Active: ${this.cleanProfileLabel(profile.label)}**\n\n`);
      tooltip.appendMarkdown(`Your git config is in sync with this profile.\n\n`);

      // Add repository name in compact mode
      if (format === "compact" && repoFolder) {
        const repoName = basename(repoFolder);
        tooltip.appendMarkdown(`📁 Repository: \`${repoName}\`\n\n`);
      }

      tooltip.appendMarkdown(`💡 *Click to switch profiles*`);
      return tooltip;
    }

    // Warning status - show detailed comparison between profile and git config
    if (status === StatusBarStatus.Warning && currentGitConfig && profile) {
      tooltip.appendMarkdown(`⚠️ **Git Config Out of Sync**\n\n`);
      tooltip.appendMarkdown(`**Selected Profile:** ${this.cleanProfileLabel(profile.label)}\n\n`);

      // Compare and show differences
      const differences: string[] = [];

      // Normalize values to handle undefined/null
      const profileUserName = profile.userName || "(none)";
      const gitUserName = currentGitConfig.userName || "(none)";
      const profileEmail = (profile.email || "").toLowerCase();
      const gitEmail = (currentGitConfig.email || "").toLowerCase();

      if (profileUserName !== gitUserName) {
        differences.push(`• **User Name:**\n  - Profile: \`${profileUserName}\`\n  - Git Config: \`${gitUserName}\``);
      }

      if (profileEmail !== gitEmail) {
        differences.push(`• **Email:**\n  - Profile: \`${profile.email || "(none)"}\`\n  - Git Config: \`${currentGitConfig.email || "(none)"}\``);
      }

      const normalizeKey = (key: string | undefined): string => (key || "").trim();
      if (normalizeKey(profile.signingKey) !== normalizeKey(currentGitConfig.signingKey)) {
        const profileKey = profile.signingKey || "(none)";
        const gitConfigKey = currentGitConfig.signingKey || "(none)";
        differences.push(`• **Signing Key:**\n  - Profile: \`${profileKey}\`\n  - Git Config: \`${gitConfigKey}\``);
      }

      if (differences.length > 0) {
        tooltip.appendMarkdown(`**Differences:**\n\n${differences.join("\n\n")}\n\n`);
      }

      tooltip.appendMarkdown(`\n💡 *Click to apply the profile or update git config*`);
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
    const finalTooltip = this.buildTooltip(content, status, tooltip, currentGitConfig, repoFolder);
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
