import { ExtensionContext, StatusBarAlignment, window, StatusBarItem, Selection, workspace, TextEditor, commands } from "vscode";
import { setUserProfile, getUserProfile } from "./commands";
import { Action } from "./Action";
import { Commands } from "./constants";
import { onDidChangeConfiguration, getProfiles } from "./config";
import { Profile } from "./Profile";
import { ProfileStatusBar as statusBar } from "./profileStatusBar";

export async function activate(context: ExtensionContext) {
    workspace.onDidChangeConfiguration(() => onDidChangeConfiguration());
    statusBar.instance.attachCommand(Commands.GET_USER_PROFILE);
    context.subscriptions.push(statusBar.instance.StatusBar);
    context.subscriptions.push(commands.registerCommand(Commands.SET_USER_PROFILE, setUserProfile));

    context.subscriptions.push(
        commands.registerCommand(Commands.GET_USER_PROFILE, async (fromStatusBar: boolean = true) => {
            let selectedProfile: {
                profile: Profile;
                action: Action;
            } = await getUserProfile(fromStatusBar);

            if (selectedProfile.action === Action.ShowCreateConfig) {
                let selected = await window.showInformationMessage("No user profiles defined. Do you want to define one now?", "Yes", "No");
                if (selected === "Yes") {
                    await commands.executeCommand(Commands.SET_USER_PROFILE);
                }
                return;
            }

            if (selectedProfile.action === Action.Silent) {
                //loading silently noprofile or profile
                // user clicked but escaped OR no profile
                statusBar.instance.updateStatus(selectedProfile.profile);
            }

            if (selectedProfile.action === Action.FromPicklist) {
                statusBar.instance.updateStatus(selectedProfile.profile);
            }

            if (selectedProfile.action === Action.PickFirstSelected) {
                statusBar.instance.updateStatus(selectedProfile.profile);
            }
        })
    );

    // see if any config already present, if so check if selected=true and pick that.
    // if not, show "No profile"
    //let profileFromConfig = await getUserProfile(false);

    await commands.executeCommand(Commands.GET_USER_PROFILE, false);
}

export function deactivate() {}

function getEditorInfo(): { text?: string; tooltip?: string; color?: string } | null {
    // If no workspace is opened or just a single folder, we return without any status label
    // because our extension only works when more than one folder is opened in a workspace.
    if (!workspace.workspaceFolders || workspace.workspaceFolders.length > 1) {
        // not supporting multi root workspace at the moment
        return null;
    }

    let text: string | undefined;
    let tooltip: string | undefined;
    let color: string | undefined;

    // If we have a file:// resource we resolve the WorkspaceFolder this file is from and update
    // the status accordingly.
    let rootFolder = workspace.workspaceFolders[0].uri;

    text = `$(repo) No config`;
    tooltip = rootFolder.fsPath;

    return { text, tooltip, color };
}
