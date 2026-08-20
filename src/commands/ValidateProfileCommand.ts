import * as vscode from "vscode";
import { LogCategory } from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import { ICommand, Result } from "./ICommand";

export class ValidateProfileCommand implements ICommand<boolean> {
  private static instance: ValidateProfileCommand | null = null;

  private getValidationErrors(profile: Profile): string[] {
    const validationErrors: string[] = [];

    if (!profile.userName || profile.userName.trim() === "") {
      validationErrors.push("User name is empty");
    }

    if (!profile.email || profile.email.trim() === "") {
      validationErrors.push("Email is empty");
      return validationErrors;
    }

    const emailValidationError = util.validateEmail(profile.email);
    if (emailValidationError) {
      validationErrors.push(emailValidationError);
    }

    return validationErrors;
  }

  public static Instance(): ValidateProfileCommand {
    if (this.instance === null) {
      this.instance = new ValidateProfileCommand();
    }
    return this.instance;
  }

  async execute(): Promise<Result<boolean>> {
    try {
      util.Logger.instance.logDebug(LogCategory.PROFILE_MATCHING, "Validate profile command started", {});

      // Show profile picker first - don't require valid workspace yet
      const pickedProfile = await util.showProfilePicker();
      const selectedProfile = pickedProfile.result as Profile;

      if (!selectedProfile) {
        util.Logger.instance.logDebug(LogCategory.PROFILE_MATCHING, "No profile selected for validation", {});
        return {};
      }

      util.Logger.instance.logDebug(LogCategory.PROFILE_MATCHING, "Validating profile", {
        profileLabel: selectedProfile.label,
        profileId: selectedProfile.id,
        userName: selectedProfile.userName,
        email: selectedProfile.email,
        hasSigningKey: !!selectedProfile.signingKey,
      });

      const validationErrors = this.getValidationErrors(selectedProfile);

      if (validationErrors.length > 0) {
        const errorMessage = `Profile '${selectedProfile.label}' validation failed:\n\n${validationErrors.map((errorMessageItem) => `• ${errorMessageItem}`).join("\n")}`;
        vscode.window.showErrorMessage(errorMessage);
        util.Logger.instance.logWarning("Profile validation failed", {
          profileLabel: selectedProfile.label,
          errors: validationErrors,
        });
        return { result: false };
      }

      const hasSigningKey = !!selectedProfile.signingKey && selectedProfile.signingKey.trim().length > 0;
      const signingKeyNote = hasSigningKey ? "" : " (Signing key not set; this optional field can be left blank.)";
      const successMessage = `✅ Profile '${selectedProfile.label}' is valid and ready to use!${signingKeyNote}`;
      vscode.window.showInformationMessage(successMessage);
      util.Logger.instance.logInfo(`Profile '${selectedProfile.label}' passed all validation checks`);
      return { result: true };
    } catch (error) {
      util.Logger.instance.logError("Validate profile command failed", error as Error);
      vscode.window.showErrorMessage("Failed to validate profile. Please check the extension logs for details.");
      return { error: error as Error };
    }
  }
}
