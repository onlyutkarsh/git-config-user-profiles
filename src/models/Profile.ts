import { v4 as uuidv4 } from "uuid";
import { QuickPickItem } from "vscode";

export class Profile implements QuickPickItem {
  label: string;
  userName: string;
  email: string;
  selected?: boolean; // Optional: being migrated to workspace-scoped selectedProfileId
  detail?: string | undefined;
  id?: string;
  signingKey: string;
  signingKeyMode?: "global" | "copy-global" | "custom" | "local";
  commitGpgSign?: boolean;
  commitGpgSignMode?: "global" | "sign" | "dont-sign" | "local";
  gpgFormat?: string;
  gpgFormatMode?: "global" | "custom" | "local";

  constructor(label: string, userName: string, email: string, selected: boolean, signingKey: string, detail?: string, commitGpgSign?: boolean, gpgFormat?: string) {
    this.label = label;
    this.userName = userName;
    this.email = email;
    this.selected = selected;
    this.detail = detail;
    this.id = uuidv4();
    this.signingKey = signingKey;
    this.commitGpgSign = commitGpgSign;
    this.gpgFormat = gpgFormat;
  }
}
