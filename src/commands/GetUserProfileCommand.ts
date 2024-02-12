import { StatusBarStatus, ProfileStatusBar as statusBar } from "../controls";
import { Logger } from "../util";
import * as gm from "../util/gitManager";
import { ICommand, Result } from "./ICommand";

export class GetUserProfileCommand implements ICommand<void> {
  constructor() {}

  async execute(origin?: string): Promise<Result<void>> {
    Logger.instance.logInfo(`Getting user profiles from settings [${origin}]`);

    const result = await gm.getWorkspaceStatus();

    await statusBar.instance.updateStatus(result.selectedProfile, result.currentFolder, result.configInSync ? StatusBarStatus.Normal : StatusBarStatus.Warning, result.message);
    return {};
  }
}
