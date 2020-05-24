import * as sgit from "simple-git/promise";
import { workspace, window } from "vscode";
import { getProfile } from "./../config";
import * as gitconfig from "gitconfiglocal";
import { Profile } from "../models";
import { Messages } from "../constants";
import { Logger } from "../util";

export async function isGitRepository(path: string): Promise<boolean> {
    try {
        return await sgit(path).checkIsRepo();
    } catch (error) {
        return false;
    }
}

export async function isValidWorkspace(): Promise<{ isValid: boolean; message: string; folder?: string }> {
    if (workspace.workspaceFolders) {
        let foldersCount = workspace.workspaceFolders.length;
        if (foldersCount > 1) {
            return {
                message: Messages.DOES_NOT_SUPPORT_MULTI_ROOT,
                isValid: false
            };
        }
        if (foldersCount === 0) {
            return {
                message: Messages.OPEN_REPO_FIRST,
                isValid: false
            };
        }
        if (foldersCount === 1) {
            let folderPath = workspace.workspaceFolders[0].uri.fsPath;

            let validGitRepo = await isGitRepository(folderPath);

            if (!validGitRepo) {
                return {
                    message: Messages.NOT_A_VALID_REPO,
                    isValid: false
                };
            }
            return {
                message: "",
                isValid: true,
                folder: folderPath
            };
        }
    }
    return {
        message: Messages.NOT_A_VALID_REPO,
        isValid: false
    };
}

export function isEmpty(str: string | undefined | null) {
    return !str || 0 === str.length;
}

export async function getCurrentConfig(gitFolder: string): Promise<{ userName: string; email: string }> {
    Logger.instance.logInfo(`Getting details from config file in ${gitFolder}`);
    return await new Promise((resolve, reject) => {
        gitconfig(gitFolder, (error, config) => {
            if (config.user && config.user.name && config.user.email) {
                let currentConfig = {
                    userName: config.user.name,
                    email: config.user.email
                };
                Logger.instance.logInfo(`Config details found: ${JSON.stringify(currentConfig)}`);
                resolve(currentConfig);
            } else {
                resolve({ userName: "", email: "" });
            }
        });
    });
}

export function trimLabelIcons(str: string) {
    if (str) {
        return str.replace("$(check)", "").trim();
    } else {
        return str;
    }
}

export function isBlank(str: string) {
    return !str || /^\s*$/.test(str);
}

export function validateProfileName(input: string, checkForDuplicates: boolean = true) {
    if (isEmpty(input) || isBlank(input)) {
        return Messages.ENTER_A_VALID_STRING;
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
        return Messages.ENTER_A_VALID_STRING;
    }
    return undefined;
}

export function validateEmail(input: string) {
    let validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!validEmail.test(input)) {
        return Messages.NOT_A_VALID_EMAIL;
    }
    return undefined;
}

export function trimProperties(profile: Profile): Profile {
    return <Profile>{
        label: profile.label.replace("$(check)", "").trim(),
        email: profile.email.trim(),
        userName: profile.userName.trim(),
        selected: profile.selected,
        detail: undefined
    };
}
