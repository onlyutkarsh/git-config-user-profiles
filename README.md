# Git Config User Profiles

Ever wanted to use different username and email addresses for your commits at work and for your personal repositories? While it is easy to do using `git config` command, this extension allows you to maintain different username and email in named profiles and allows you to easily switch and apply to the repository you are working.

> Latest Changes
> 
> - ✅ If the repository's git config matches a defined profile, extension now selects it automatically. Don't like this behaviour and prefer the old way? You can disable it in settings.
>   ![auto select](images/marketplace/auto-select-profile-setting.png)
> - ✅ Store `signingkey` in the profile.
> - ✅ Delete Profile - Type 'git config profiles' in command palette and select 'Delete a profile'.

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

### Issues and feature requests

If you find any bug or have any suggestion/feature request, please submit the [issue](https://github.com/onlyutkarsh/git-config-user-profiles/issues) in the GitHub repo. 

