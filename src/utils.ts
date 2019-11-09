import * as sgit from "simple-git/promise";
import { workspace, window } from "vscode";

export async function isGitRepository(path: string): Promise<boolean> {
    try {
        return await sgit(path).checkIsRepo();
    } catch (error) {
        return false;
    }
}

export function isValidWorkspace(): { result: boolean; message: string } {
    if (workspace.workspaceFolders) {
        if (workspace.workspaceFolders.length > 1) {
            return {
                message: "Sorry, the extension does not support multiple workspaces at the moment",
                result: false,
            };
        }
        if (workspace.workspaceFolders.length === 0) {
            return {
                message: "Sorry, you need to open a git repository first",
                result: false,
            };
        }
        if (workspace.workspaceFolders.length === 1) {
            return {
                message: "",
                result: true,
            };
        }
    }
    return {
        message: "Does not seem to be a workspace",
        result: true,
    };
}
