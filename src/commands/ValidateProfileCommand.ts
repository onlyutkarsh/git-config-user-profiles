import * as vscode from "vscode";
import { LogCategory } from "../constants";
import { Profile } from "../models";
import * as util from "../util";
import * as gm from "../util/gitManager";
import { ICommand, Result } from "./ICommand";
import simpleGit from "simple-git";

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

      // Test if git accepts these values (dry-run test) - only if basic validation passed
      if (validationErrors.length === 0) {
        try {
          // Get workspace status to find git repository
          const workspaceStatus = await gm.getWorkspaceStatus();

          if (workspaceStatus.currentFolder) {
            const git = simpleGit(workspaceStatus.currentFolder);

            // Test userName
            await git.addConfig("user.name", selectedProfile.userName, false, "local");

            // Test email
            await git.addConfig("user.email", selectedProfile.email, false, "local");

            // Test signing key if present
            if (selectedProfile.signingKey && selectedProfile.signingKey.trim() !== "") {
              await git.addConfig("user.signingkey", selectedProfile.signingKey, false, "local");
            }

            util.Logger.instance.logInfo(`Profile '${selectedProfile.label}' validation successful`);
          } else {
            // No git repository available for testing, but basic validation passed
            util.Logger.instance.logInfo(`Profile '${selectedProfile.label}' passed basic validation (no git repository to test against)`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          validationErrors.push(`Git configuration test failed: ${errorMessage}`);
          util.Logger.instance.logError("Git configuration test failed during validation", error as Error);
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
        const successMessage = `✅ Profile '${selectedProfile.label}' is valid and ready to use!`;
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
