import * as sgit from "simple-git/promise";
import { workspace, window } from "vscode";
import { getProfile } from "./config";

export async function isGitRepository(path: string): Promise<boolean> {
    try {
        return await sgit(path).checkIsRepo();
    } catch (error) {
        return false;
    }
}

export async function isValidWorkspace(): Promise<{ result: boolean; message: string; folder?: string }> {
    if (workspace.workspaceFolders) {
        let foldersCount = workspace.workspaceFolders.length;
        if (foldersCount > 1) {
            return {
                message: "Sorry, the extension does not support multi root workspaces at the moment",
                result: false,
            };
        }
        if (foldersCount === 0) {
            return {
                message: "Sorry, you need to open a git repository first",
                result: false,
            };
        }
        if (foldersCount === 1) {
            let validGitRepo = await isGitRepository(workspace.workspaceFolders[0].uri.fsPath);
            if (!validGitRepo) {
                return {
                    message: "This does not seem to be a valid git repository",
                    result: false,
                };
            }
            return {
                message: "",
                result: true,
                folder: workspace.workspaceFolders[0].uri.fsPath,
            };
        }
    }
    return {
        message: "This does not seem to be a valid git repository",
        result: false,
    };
}

export function isEmpty(str: string | undefined | null) {
    return !str || 0 === str.length;
}

export function isBlank(str: string) {
    return !str || /^\s*$/.test(str);
}

export function validateProfileName(input: string, checkForDuplicates: boolean = true) {
    if (isEmpty(input) || isBlank(input)) {
        return "Please enter a valid string";
    }
    if (checkForDuplicates) {
        let existingProfile = getProfile(input);
        if (existingProfile) {
            return `Oops! Profile with the same name '${input}' already exists!`;
        }
    }
    return undefined;
}

export function validateUserName(input: string) {
    if (isEmpty(input) || isBlank(input)) {
        return "Please enter a valid string";
    }
    return undefined;
}

export function validateEmail(input: string) {
    let validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!validEmail.test(input)) {
        return "Oops! That does not seem to be a valid email. Please verify";
    }
    return undefined;
}
