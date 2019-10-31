import { ExtensionContext, StatusBarAlignment, window, StatusBarItem, Selection, workspace, TextEditor, commands } from "vscode";
import { setUserProfile, getUserProfile } from "./commands";
import { Commands } from "./constants";
import { Profile, onDidChangeConfiguration } from "./config";
import { ProfileStatusBar as statusBar } from "./profileStatusBar";

export function activate(context: ExtensionContext) {
    workspace.onDidChangeConfiguration(() => onDidChangeConfiguration());
    // Create a status bar item
    statusBar.instance.attachCommand(Commands.GET_USER_PROFILE);

    context.subscriptions.push(
        commands.registerCommand(Commands.GET_USER_PROFILE, async () => {
            let selectedProfile: Profile | undefined = await getUserProfile();
            if (selectedProfile) {
                statusBar.instance.updateStatus(selectedProfile);
            } else {
                window.showErrorMessage("The selected profile not found in configuration. Please verify");
            }
        })
    );
    context.subscriptions.push(commands.registerCommand(Commands.SET_USER_PROFILE, setUserProfile));

    context.subscriptions.push(statusBar.instance.StatusBar);
    statusBar.instance.updateStatus("No config");
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
