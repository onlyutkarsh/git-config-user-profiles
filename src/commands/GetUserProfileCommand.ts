import { basename } from "path";
import sgit from "simple-git";
import { commands, window } from "vscode";
import { getVscProfiles, saveVscProfile } from "../config";
import * as constants from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import { Logger } from "../util";
import { EditUserProfileCommand } from "./EditUserProfileCommand";
import { ICommand, Result } from "./ICommand";
import { SelectProfileCommand } from "./SelectProfileCommand";

export class GetUserProfileCommand implements ICommand<Profile> {
  private fromStatusBar: boolean;
  private noProfileSwitch: boolean;

  constructor(fromStatusBar: boolean = false, notProfileSwitch: boolean = true) {
    this.fromStatusBar = fromStatusBar;
    this.noProfileSwitch = notProfileSwitch;
  }

  async execute(): Promise<Result<Profile>> {
    Logger.instance.logInfo(`Getting user profiles. Triggerred from status bar = ${this.fromStatusBar}`);
    const profilesInVscConfig = getVscProfiles();
    const emptyProfile = <Profile>{
      label: constants.Application.APPLICATION_NAME,
      selected: false,
      email: "NA",
      userName: "NA",
    };

    const selectedProfileInVscConfig = profilesInVscConfig.filter((x) => x.selected) || [];
    let selectedVscProfile: Profile = selectedProfileInVscConfig.length > 0 ? selectedProfileInVscConfig[0] : emptyProfile;

    //TODO: Show error if the user deliberately deletes the username or email property from config
    if (selectedVscProfile.label === undefined || selectedVscProfile.userName === undefined || selectedVscProfile.email === undefined) {
      window.showErrorMessage("One of label, userName or email properties is missing in the config. Please verify.");
      return {
        result: emptyProfile,
      };
    }

    const validatedWorkspace = await util.isValidWorkspace();

    let configInSync = false;
    if (validatedWorkspace.isValid && validatedWorkspace.folder) {
      const currentGitConfig = await util.getCurrentGitConfig(validatedWorkspace.folder);
      configInSync = !util.isNameAndEmailEmpty(currentGitConfig) && util.hasSameNameAndEmail(currentGitConfig, selectedVscProfile);
    }

    if (!this.fromStatusBar) {
      if (profilesInVscConfig.length === 0) {
        //if profile loaded automatically and no config found
        //OR if no config found and user clicks on "no profile" on status bar, send undefined to show picklist
        return {
          result: emptyProfile,
        };
      }

      if (validatedWorkspace.isValid === false) {
        return {
          result: emptyProfile,
        };
      }
      //if configs found, compare it with current git config
      const workspaceFolder = validatedWorkspace.folder ? validatedWorkspace.folder : ".\\";
      if (validatedWorkspace.isValid && validatedWorkspace.folder) {
        const currentGitConfig = await util.getCurrentGitConfig(validatedWorkspace.folder);
        configInSync = !util.isNameAndEmailEmpty(currentGitConfig) && util.hasSameNameAndEmail(currentGitConfig, selectedVscProfile);
      }
      //if configs found, but none are selected, if from statusbar show picklist else silent
      //if multiple items have selected = true (due to manual change) return the first one
      return {
        result: selectedVscProfile,
      };
    }

    if (this.fromStatusBar) {
      if (profilesInVscConfig.length === 0) {
        //if no profiles in config, prompt user to create (even if its non git workspace)
        const selected = await window.showInformationMessage("No user profiles defined. Do you want to define one now?", "Yes", "No");
        if (selected === "Yes") {
          await commands.executeCommand(constants.CommandIds.CREATE_USER_PROFILE);
        }
        selectedVscProfile;
      }

      let response;

      if (validatedWorkspace.isValid === false) {
        window.showErrorMessage(validatedWorkspace.message);
        return {
          result: emptyProfile,
        };
      }
      const workspaceFolder = validatedWorkspace.folder ? validatedWorkspace.folder : ".\\";
      if (selectedProfileInVscConfig.length === 0) {
        response = await window.showInformationMessage(
          `You have ${profilesInVscConfig.length} profile(s) in settings. What do you want to do?`,
          "Pick a profile",
          "Edit existing",
          "Create new"
        );
      } else if (this.noProfileSwitch) {
        const notSyncOptions = ["Yes, apply", "No, pick another", "Edit existing", "Create new"];
        const syncOptions = ["Apply again", "Pick a profile", "Edit existing", "Create new"];

        const options = configInSync ? syncOptions : notSyncOptions;
        const message = configInSync
          ? `Repo '${basename(workspaceFolder)}' is already using user details from the profile '${util.trimLabelIcons(selectedVscProfile.label)}'. What do you want to do?`
          : `You have selected profile '${util.trimLabelIcons(selectedVscProfile.label)}', but the repo '${basename(
              workspaceFolder
            )}' is not using user details from this profile. Do you want to apply the user details from profile '${util.trimLabelIcons(selectedVscProfile.label)}'?`;

        response = await window.showInformationMessage(message, ...options);
      }

      if (response === undefined) {
        return {
          result: selectedVscProfile,
        };
      }
      if (response === "Edit existing") {
        await EditUserProfileCommand.Instance().execute();
        return {
          result: selectedVscProfile,
        };
      }
      if (response === "Yes, apply" || response === "Apply again") {
        //no chance of getting undefined value here as validWorkSpace.result will always be true
        await sgit(workspaceFolder).addConfig("user.name", selectedVscProfile.userName);
        await sgit(workspaceFolder).addConfig("user.email", selectedVscProfile.email);

        //TTTT window.showInformationMessage("User name and email updated in git config file.");
        return {
          result: selectedVscProfile,
        };
      }
      if (response === "Create new") {
        await commands.executeCommand(constants.CommandIds.CREATE_USER_PROFILE);
        return {
          result: selectedVscProfile,
        };
      }
      if (response === "No, pick another" || response === "Pick a profile") {
        //show picklist only if no profile is marked as selected in config.
        //this can happen only when setting up config for the first time or user deliberately changed config
        const result = await new SelectProfileCommand().execute();
        const pickedProfile = result.result as Profile;
        if (pickedProfile) {
          pickedProfile.detail = undefined;
          pickedProfile.label = pickedProfile.label;
          pickedProfile.selected = true;
          await saveVscProfile(Object.assign({}, pickedProfile));
          this.fromStatusBar = true;
          this.noProfileSwitch = false;
          const result = await this.execute(); //dont show popup if user is switching profile
          selectedVscProfile = result.result as Profile;
          return {
            result: selectedVscProfile,
          };
        } else {
          // profile is already set in the statusbar,
          // user clicks statusbar, picklist is shown to switch profiles, but user does not pick anything
          // leave selected as is
          if (selectedProfileInVscConfig.length > 0 && this.fromStatusBar) {
            return {
              result: selectedVscProfile,
            };
          }
        }
      }
    }
    return {
      result: emptyProfile,
    };
  }
}
