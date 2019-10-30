import { window } from "vscode";
import { getProfiles } from "./config";
export async function setUserProfile() {
    window.showInformationMessage("Set user profile");
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
        }
        window.showInformationMessage(selected ? selected : "No item selected");
    }
}
