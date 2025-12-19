import * as vscode from "vscode";
import { LogCategory } from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import { ICommand, Result } from "./ICommand";

export class ValidateProfileCommand implements ICommand<boolean> {
  private static instance: ValidateProfileCommand | null = null;

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

      // Validate the profile fields
      const validationErrors: string[] = [];

      // Validate userName
      if (!selectedProfile.userName || selectedProfile.userName.trim() === "") {
        validationErrors.push("User name is empty");
      }

      // Validate email
      if (!selectedProfile.email || selectedProfile.email.trim() === "") {
        validationErrors.push("Email is empty");
      } else {
        const emailValidationError = util.validateEmail(selectedProfile.email);
        if (emailValidationError) {
          validationErrors.push(emailValidationError);
        }
      }

      // Show validation results
      if (validationErrors.length > 0) {
        const errorMessage = `Profile '${selectedProfile.label}' validation failed:\n\n${validationErrors.map(e => `• ${e}`).join('\n')}`;
        vscode.window.showErrorMessage(errorMessage);
        util.Logger.instance.logWarning("Profile validation failed", {
          profileLabel: selectedProfile.label,
          errors: validationErrors,
        });
        return { result: false };
      } else {
        const hasSigningKey = !!selectedProfile.signingKey && selectedProfile.signingKey.trim().length > 0;
        const signingKeyNote = hasSigningKey ? "" : " (Signing key not set; this optional field can be left blank.)";
        const successMessage = `✅ Profile '${selectedProfile.label}' is valid and ready to use!${signingKeyNote}`;
        vscode.window.showInformationMessage(successMessage);
        util.Logger.instance.logInfo(`Profile '${selectedProfile.label}' passed all validation checks`);
        return { result: true };
      }
    } catch (error) {
      util.Logger.instance.logError("Validate profile command failed", error as Error);
      vscode.window.showErrorMessage("Failed to validate profile. Please check the extension logs for details.");
      return { error: error as Error };
    }
  }
}
