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
  private buildStatusText(profile: Profile | undefined, repoFolder: string | undefined): string {
    const repoName = repoFolder ? basename(repoFolder) : Constants.Application.APPLICATION_NAME;

    if (!profile) {
      return `${ICONS.SOURCE_CONTROL} ${repoName} ${ICONS.ARROW} ${ICONS.QUESTION}`;
    }

    const cleanLabel = this.cleanProfileLabel(profile.label);
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
    if (customTooltip) {
      return customTooltip;
    }

    if (!profile) {
      return `${Constants.Application.APPLICATION_NAME} - Click status bar icon for more options`;
    }

    const tooltip = new MarkdownString();
    tooltip.isTrusted = true;
    tooltip.supportHtml = false;

    if (status === StatusBarStatus.Normal) {
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
      tooltip.appendMarkdown(`**Profile vs Git Config**\n\n`);

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
        tooltip.appendMarkdown(`_Click status bar icon for more options_`);
        return tooltip;
      }
    }

    return `${Constants.Application.APPLICATION_NAME} - Click status bar icon for more options`;
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

    const text = this.buildStatusText(content, repoFolder);
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
