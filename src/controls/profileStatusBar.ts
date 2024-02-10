import { basename } from "path";
import { StatusBarAlignment, StatusBarItem, ThemeColor, window } from "vscode";
import * as Constants from "../constants";
import { Profile } from "../models";
import { Logger } from "../util";

export enum StatusBarStatus {
  Normal = "Normal",
  Warning = "Warning",
}

export class ProfileStatusBar {
  private static _instance: ProfileStatusBar;
  private static _statusBar: StatusBarItem;

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

  public async updateStatus(content: Profile | undefined, repoFolder: string | undefined, status: StatusBarStatus = StatusBarStatus.Normal, tooltip?: string) {
    tooltip = tooltip || `${Constants.Application.APPLICATION_NAME} - Click status bar icon for more options`;

    const profile = content as Profile;
    const normalBackground = new ThemeColor("statusBarItem.activeBackground");
    const warningBackground = new ThemeColor("statusBarItem.warningBackground");
    let text = `$(source-control) ${Constants.Application.APPLICATION_NAME}`;

    if (profile) {
      if (repoFolder) {
        if (status === StatusBarStatus.Normal) {
          text = `$(source-control) ${basename(repoFolder)} $(arrow-small-right) ${profile.label.replace("$(check)", "").trim()}`;
          tooltip = `Profile: ${profile.userName} (${profile.email})\r\nClick status bar icon for more options`;
        } else {
          text = `$(source-control) ${basename(repoFolder)} $(arrow-small-right) ${profile.label.replace("$(alert)", "").trim()}`;
        }
      } else {
        if (status === StatusBarStatus.Normal) {
          text = `$(source-control) ${Constants.Application.APPLICATION_NAME} $(arrow-small-right) ${profile.label.replace("$(check)", "").trim()}`;
          tooltip = `Profile: ${profile.userName} (${profile.email})\r\nClick status bar icon for more options`;
        } else {
          text = `$(source-control) ${Constants.Application.APPLICATION_NAME} $(arrow-small-right) ${profile.label.replace("$(alert)", "").trim()}`;
        }
      }
    } else if (content === undefined) {
      text = `$(source-control) ${Constants.Application.APPLICATION_NAME}`;
      tooltip = tooltip;
    } else {
      text = `$(source-control) ${Constants.Application.APPLICATION_NAME}`;
      tooltip = tooltip;
    }
    ProfileStatusBar._statusBar.text = text;
    ProfileStatusBar._statusBar.backgroundColor = status === StatusBarStatus.Normal ? normalBackground : warningBackground;
    ProfileStatusBar._statusBar.tooltip = tooltip;
    ProfileStatusBar._statusBar.show();
  }

  public attachCommand(commandId: string) {
    ProfileStatusBar._statusBar.command = commandId;
  }

  public get StatusBar(): StatusBarItem {
    return ProfileStatusBar._statusBar;
  }
}
