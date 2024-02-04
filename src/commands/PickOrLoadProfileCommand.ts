import * as controls from "../controls";
import { Profile } from "../models";
import * as util from "../util";
import { ICommand, Result } from "./ICommand";

export class PickOrLoadProfileCommand implements ICommand<Profile> {
  private preloadedProfile: Profile | undefined;
  private state: Partial<controls.State> = {};

  private createNewProfile: boolean = true;

  constructor(prelodedProfile?: Profile) {
    this.preloadedProfile = prelodedProfile;
    if (this.preloadedProfile) {
      this.createNewProfile = false;
      this.state = {
        // give existing profile as default values to the state for editing
        profileEmail: this.preloadedProfile.email,
        profileUserName: this.preloadedProfile.userName,
        profileName: this.preloadedProfile.label,
        profileId: this.preloadedProfile.id,
        profileSelected: this.preloadedProfile.selected,
      };
    }
  }

  async execute(): Promise<Result<Profile>> {
    await controls.MultiStepInput.run(async (input) => await this.pickProfileName(input, this.state, this.createNewProfile));
    if (this.createNewProfile) {
      const profile: Profile = new Profile(this.state.profileName || "", this.state.profileUserName || "", this.state.profileEmail || "", false);
      return { result: profile };
    } else {
      // get the profile from the state with the updated values
      const profile: Profile = {
        label: this.state.profileName || "",
        userName: this.state.profileUserName || "",
        email: this.state.profileEmail || "",
        selected: this.state.profileSelected || false,
        detail: undefined,
        id: this.state.profileId || "",
      };
      return { result: profile };
    }
  }

  private async shouldResume() {
    // Could show a notification with the option to resume.
    return new Promise<boolean>(() => {});
  }

  private async pickProfileName(input: controls.MultiStepInput, state: Partial<controls.State>, create = true) {
    state.profileName = await input.showInputBox({
      title: create ? "Create a profile" : "Edit profile",
      step: 1,
      totalSteps: 3,
      prompt: "Enter name for the profile",
      value: state.profileName || "",
      placeholder: "Work",
      validate: (input) => util.validateProfileName(input, create),
      shouldResume: this.shouldResume,
      ignoreFocusOut: true,
    });
    return (input: controls.MultiStepInput) => this.pickUserName(input, state, create);
  }

  private async pickUserName(input: controls.MultiStepInput, state: Partial<controls.State>, create = true) {
    state.profileUserName = await input.showInputBox({
      title: create ? "Create a profile" : "Edit profile",
      step: 2,
      totalSteps: 3,
      prompt: "Enter the user name",
      value: state.profileUserName || "",
      placeholder: "John Smith",
      validate: util.validateUserName,
      shouldResume: this.shouldResume,
      ignoreFocusOut: true,
    });
    return (input: controls.MultiStepInput) => this.pickEmail(input, state, create);
  }

  private async pickEmail(input: controls.MultiStepInput, state: Partial<controls.State>, create = true) {
    state.profileEmail = await input.showInputBox({
      title: create ? "Create a profile" : "Edit profile",
      step: 3,
      totalSteps: 3,
      prompt: "Enter the email",
      value: state.profileEmail || "",
      placeholder: "john.smith@myorg.com",
      validate: util.validateEmail,
      shouldResume: this.shouldResume,
      ignoreFocusOut: true,
    });
  }
}
