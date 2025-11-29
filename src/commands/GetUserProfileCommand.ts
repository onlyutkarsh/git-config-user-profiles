import { StatusBarStatus, ProfileStatusBar as statusBar } from "../controls";
import { Logger } from "../util";
import * as gm from "../util/gitManager";
import { ICommand, Result } from "./ICommand";

export class GetUserProfileCommand implements ICommand<void> {
  constructor() {}

  async execute(origin?: string): Promise<Result<void>> {
    Logger.instance.logInfo(`Getting user profiles from settings [${origin}]`);

    const result = await gm.getWorkspaceStatus();

    // Don't show warnings if the message is empty (indicates non-file scheme or other silent ignore case)
    const shouldShowWarning = result.message && result.message.length > 0 && !result.configInSync;

    await statusBar.instance.updateStatus(result.selectedProfile, result.currentFolder, shouldShowWarning ? StatusBarStatus.Warning : StatusBarStatus.Normal, result.message);
    return {};
  }
}
