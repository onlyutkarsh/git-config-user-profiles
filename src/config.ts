import { workspace } from "vscode";

export class GitUserProfiles {
    private _profiles: Profile[];
    public get profiles(): Profile[] {
        return this._profiles;
    }
    public set profiles(v: Profile[]) {
        this._profiles = v;
    }
}

export class Profile {
    private _name: string;
    public get name(): string {
        return this._name;
    }
    public set name(v: string) {
        this._name = v;
    }


    private _userName: string;
    public get userName(): string {
        return this._userName;
    }
    public set userName(v: string) {
        this._userName = v;
    }


    private _email: string;
    public get email(): string {
        return this._email;
    }
    public set email(v: string) {
        this._email = v;
    }
}

export function getProfiles(): Profile[] {

    let profiles = workspace.getConfiguration("gitConfigUser").get<Profile[]>("profiles");

    if (profiles) {
        return profiles;
    }
    return [];
}