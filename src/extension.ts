import { ExtensionContext, StatusBarAlignment, window, StatusBarItem, Selection, workspace, TextEditor, commands } from "vscode";
import { basename } from "path";
import { getProfiles } from "./config";

export function activate(context: ExtensionContext) {

	// Create a status bar item
	const status = window.createStatusBarItem(StatusBarAlignment.Right, 1000000);

	let commandId = "git-config-user.selectUserProfile";

	context.subscriptions.push(commands.registerCommand(commandId, async () => {
		let profilesInConfig = getProfiles();
		if (profilesInConfig.length > 0) {
			let selected = await window.showQuickPick(profilesInConfig.map(x => x.name), {
				canPickMany: false,
				matchOnDetail: true,
				placeHolder: "Select a profile"
			});
			window.showInformationMessage(selected ? selected : "No item selected");
		}
		else {
			let sel = await window.showInformationMessage("No profiles defined. Do you want to?", "Yes", "No"
			);
			window.showInformationMessage(sel ? sel : "No item selected");

		}

	}));

	status.command = commandId;

	context.subscriptions.push(status);

	// Update status bar item based on events for multi root folder changes
	context.subscriptions.push(workspace.onDidChangeWorkspaceFolders(e => updateStatus(status)));

	updateStatus(status);
}

export function deactivate() { }

function updateStatus(status: StatusBarItem): void {
	const info = getEditorInfo();
	status.text = info ? info.text || "" : "";
	status.tooltip = info ? info.tooltip : undefined;
	status.color = info ? info.color : undefined;

	if (info) {
		status.show();
	} else {
		status.hide();
	}
}

function getEditorInfo(): { text?: string; tooltip?: string; color?: string; } | null {

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