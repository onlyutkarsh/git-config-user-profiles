import { QuickPickItem } from "vscode";
export class Profile implements QuickPickItem {
    label: string;
    userName: string;
    email: string;
    signingKey: string;
    selected: boolean;
    detail?: string | undefined;
}
