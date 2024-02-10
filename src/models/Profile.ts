import { v4 as uuidv4 } from "uuid";
import { QuickPickItem } from "vscode";

export class Profile implements QuickPickItem {
  label: string;
  userName: string;
  email: string;
  selected: boolean;
  detail?: string | undefined;
  id?: string;
  signingKey: string;

  constructor(label: string, userName: string, email: string, selected: boolean, signingKey: string, detail?: string) {
    this.label = label;
    this.userName = userName;
    this.email = email;
    this.selected = selected;
    this.detail = detail;
    this.id = uuidv4();
    this.signingKey = signingKey;
  }
}
