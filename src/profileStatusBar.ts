import { window, StatusBarAlignment, StatusBarItem } from "vscode";
import { Profile } from "./Profile";

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
    }

    public updateStatus(status: Profile | undefined | string, usedInRepo: boolean = false) {
        if ((status as Profile).label) {
            let profile = status as Profile;
            ProfileStatusBar._statusBar.text = `$(person-filled) ${profile.label}`;
            if (profile.userName !== "NA") {
                ProfileStatusBar._statusBar.tooltip = `User name: ${profile.userName}\r\nEmail:${profile.email}`;
            }
        }
        ProfileStatusBar._statusBar.show();
    }

    public attachCommand(commandId: string) {
        ProfileStatusBar._statusBar.command = commandId;
    }

    public get StatusBar(): StatusBarItem {
        return ProfileStatusBar._statusBar;
    }
}
