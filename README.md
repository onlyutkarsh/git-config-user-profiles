# Git Config User Profiles

Ever wanted to use different username and email addresses for your commits at work and for your personal repositories? While it is easy to do using `git config` command, this extension allows you to maintain different username and email in named profiles and allows you to easily switch and apply to the repository you are working.

> Latest Changes in 2.2.0
>
> - ✅ **Multi-folder workspace support** - Open a parent folder with multiple git repositories, and the extension will automatically detect which repo you're working in based on the active file.
> - ✅ **Workspace-level profile selection** - Each workspace can now remember its own selected profile (stored in `.vscode/settings.json`), while profiles remain global and available across all workspaces. If no `.vscode/settings.json` is found, it will create it.
> - ✅ **Performance improvements** - Optimized extension loading and git operations for faster response times.


![demo](images/marketplace/demo.gif)

## Usage

### Creating the profiles
---
Once you install extension, click on 'Git Config Profiles' on the VSCode Status Bar and define few profiles. 

![status bar](images/marketplace/statusbar.png)

> Profiles defined are stored in global settings file in VSCode so that they are available for all other repositories.

<br/>

### Selecting the profile
---

Click on the status bar and if you have profiles you will presented with a dialog as below.

![status bar picker](images/marketplace/statusbar-picker.png)

Click `Pick a profile` and then select a profile you need.

![picker](images/marketplace/profile-picker.png)

<br/>

### Setting the profile selected to the repo
---

#### Auto selection of profile

When the extension loads up, it looks up the local git config and tries to match it with the profiles defined. If it finds a match, it selects the profile automatically (new behaviour). This behavior can be disabled in settings.

![auto select](images/marketplace/auto-select-profile-setting.png)

#### Manual selection of profile

If auto selection of profile is disabled, the status bar will show a warning if the repository's username and email do not match any of the profiles, and you can select a profile manually (old behaviour).

Once you select a profile, the status bar text changes to selected profile name [1 in image below]. 

> The icon might display a "warning" sign if the current repo is not using the username and email selected.

If you want to apply the username and email defined in the selected profile to the current repository, click on profile name in the status bar (e.g `Work` ) and then select `Yes, apply` in the dialog [2 image below].

![profile not in sync](images/marketplace/repo-not-in-sync.png)

Once the repository's username and email are in sync, you will see warning color go away confirming that repository config is in sync with the profile selected.

![repo in sync](images/marketplace/repo-in-sync.png)

### Deleting a profile
Open the Command Palette and type `git config user profiles` or `gcup` and select `Delete a profile`. You will be presented with a list of profiles to delete.

<br/>

## Supported Scenarios

The extension intelligently handles various workspace configurations and provides appropriate feedback through the status bar and tooltips.

### Workspace Configurations

| Scenario                                             | Status Bar Display                                                              | Tooltip                                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No editors open**                                  | Shows repo name → "No Profile" with question mark icon and warning background   | 📂 **No File Open**                                                                                                                                             |
| **Non-file schemes** (Output window, Settings, etc.) | Hidden                                                                          | Status bar is hidden as these are not associated with git repositories                                                                                         |
| **Jupyter Notebooks** (.ipynb)                       | Same as regular files - shows git profile information                           | Same as regular files - displays profile sync status                                                                                                           |
| **File in non-git folder**                           | Shows folder name → "No Profile" with question mark icon and warning background | ⚠️ **Not a Git Repository**                                                                                                                                     |
| **No profiles created**                              | Shows repo name → "No Profile" with question mark icon and warning background   | 📋 **No Profiles Created**                                                                                                                                      |
| **Git repo, no profile selected**                    | Shows repo name → "No Profile" with question mark icon and warning background   | ⚠️ **No Profile Selected**                                                                                                                                      |
| **Git repo, profile selected, in sync**              | Shows repo name → profile name with normal background (no icons)                | ✅ **Profile Name**                                                                                                                                             |
| **Git repo, profile selected, out of sync**          | Shows repo name → profile name with alert icon and warning background           | ⚠️ **Git Config Out of Sync**                                                                                                                                   |
| **Nested git repositories**                          | Works correctly by detecting git root from file location                        | Each nested git repo can have its own profile selection stored in its `.vscode/settings.json` file - reads directly from file to avoid parent folder conflicts |

### Multi-root and Nested Repository Support

The extension fully supports complex workspace configurations:

- **Parent folder with multiple git repos**: Open a parent folder containing multiple nested git repositories, and the extension will detect the correct git repo based on which file you have open.
- **Multi-root workspaces**: Each workspace folder can have its own profile selection.
- **Mono repositories**: Works correctly in mono repos by traversing up to find the git root from the opened file's location.

> **Technical Note**: Profile selections are stored in each git repository's `.vscode/settings.json` file using the `gitConfigUser.selectedProfileId` setting. This allows different git repositories to maintain their own profile selections even when opened from a common parent folder.

### Tooltip States

The extension provides concise tooltip information to help you understand the current state at a glance:

- **✅ Profile Name**: Profile is selected and git config is in sync
- **⚠️ Git Config Out of Sync**: Profile is selected but git config doesn't match the profile settings
- **📂 No File Open**: No file is currently open in the editor
- **⚠️ Not a Git Repository**: Current folder is not a git repository
- **📋 No Profiles Created**: No profiles have been created yet
- **⚠️ No Profile Selected**: No profile has been selected for this repository
- **❌ Profile Configuration Error**: Selected profile is missing required information

> All tooltips are kept minimal for quick readability. Click the status bar icon for detailed information and available actions.

<br/>

### Issues and feature requests

If you find any bug or have any suggestion/feature request, please submit the [issue](https://github.com/onlyutkarsh/git-config-user-profiles/issues) in the GitHub repo. 

