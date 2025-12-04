export const CommandIds = {
  CREATE_USER_PROFILE: "git-config-user-profiles.createUserProfile",
  GET_USER_PROFILE: "git-config-user-profiles.getUserProfile",
  PICK_USER_PROFILE: "git-config-user-profiles.pickUserProfile",
  EDIT_USER_PROFILE: "git-config-user-profiles.editUserProfile",
  DELETE_USER_PROFILE: "git-config-user-profiles.deleteUserProfile",
  VALIDATE_USER_PROFILE: "git-config-user-profiles.validateUserProfile",
  SYNC_VSC_PROFILES_WITH_GIT_CONFIG: "git-config-user-profiles.syncVscProfilesWithGitConfig",
  STATUS_BAR_CLICK: "git-config-user-profiles.statusBarClick",
  SHOW_STATUS: "git-config-user-profiles.showStatus",
};

export const Application = {
  APPLICATION_NAME: "Git Config User Profiles",
};

export const Messages = {
  DOES_NOT_SUPPORT_MULTI_ROOT: "Sorry, the extension does not support multi root workspaces at the moment",
  OPEN_REPO_FIRST: "Sorry, you need to open a git repository first",
  NOT_A_VALID_REPO: "This does not seem to be a valid git repository",
  ENTER_A_VALID_STRING: "Please enter a valid string",
  NOT_A_VALID_EMAIL: "That does not seem to be a valid email. Please verify",
};

export const LogCategory = {
  PICK_PROFILE: "PickProfile",
  CREATE_PROFILE: "CreateProfile",
  EDIT_PROFILE: "EditProfile",
  DELETE_PROFILE: "DeleteProfile",
  GIT_CONFIG_FILE: "GitConfigFile",
  GIT_REPOSITORY: "GitRepository",
  PROFILE_MATCHING: "ProfileMatching",
  SETTINGS_CHANGE: "SettingsChange",
  STATUS_BAR: "StatusBar",
  WORKSPACE_STATUS: "WorkspaceStatus",
} as const;
