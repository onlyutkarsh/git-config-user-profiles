import { window, commands } from "vscode";
import { getProfiles } from "./config";
export async function setUserProfile(
    fromStatusBar: boolean | undefined = false
): Promise<{ profileName: string | undefined; userName: string | undefined; email: string | undefined }> {
    let profileName = await window.showInputBox({
        prompt: "Enter name for the profile",
        placeHolder: "Work",
    });

    let userName = await window.showInputBox({
        prompt: `Enter user name for '${profileName}'`,
        placeHolder: "John Smith",
    });

    let email = await window.showInputBox({
        prompt: `Enter email for '${profileName}'`,
        placeHolder: "john.smith@work.com",
    });
    return { profileName, userName, email };
}

export async function getUserProfile() {
    let profilesInConfig = getProfiles();
    if (profilesInConfig.length > 0) {
        let selected = await window.showQuickPick(profilesInConfig.map(x => x.name), {
            canPickMany: false,
            matchOnDetail: true,
            placeHolder: "Select a profile",
        });
        window.showInformationMessage(selected ? selected : "No item selected");
    } else {
        let selected = await window.showInformationMessage("No config user profiles defined. Do you want to define one now?", "Yes", "No");
        if (selected === "Yes") {
            await commands.executeCommand("git-config-user.setUserProfile", true);
        }
    }
}
