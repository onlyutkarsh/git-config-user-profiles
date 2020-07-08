import { window, StatusBarAlignment, StatusBarItem, ThemeColor } from "vscode";
import { Profile } from "../models";
import * as Constants from "../constants";
import { Logger } from "../util/logger";

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

    public updateStatus(status: Profile | undefined | string, usedInRepo: boolean = false) {
        let tooltip = `${Constants.Application.APPLICATION_NAME} - Click for more`;

        if ((status as Profile).label) {
            let profile = status as Profile;
            ProfileStatusBar._statusBar.text = `$(repo) ${profile.label}`;
            if (profile.label !== Constants.Application.APPLICATION_NAME) {
                if (usedInRepo) {
                    ProfileStatusBar._statusBar.text = `$(repo) ${profile.label.replace("$(check)", "").trim()} $(check)`;
                    tooltip = profile.signingKey ?
                        `${profile.userName} (${profile.email}) <${profile.signingKey}> - Click for more` :
                        `${profile.userName} (${profile.email}) - Click for more`;
                } else {
                    ProfileStatusBar._statusBar.text = `$(repo) ${profile.label.replace("$(alert)", "").trim()} $(alert)`;
                    tooltip = profile.signingKey ?
                    `${profile.userName} (${profile.email}) <${profile.signingKey}> - Click for more` :
                    `${profile.userName} (${profile.email}) - Click for more`;
                }
            }
        }
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
