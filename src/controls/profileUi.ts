import * as vscode from "vscode";
import { getProfilesInSettings } from "../config";
import { Profile } from "../models";
import * as util from "../util";
import { getGlobalGitConfig } from "../util/gitManager";

export async function showProfileForm(
  initialProfile?: Profile,
  profiles: Profile[] = [],
  onSave?: (profile: Profile, oldProfileId?: string) => Promise<void>,
  onDelete?: (profile: Profile) => Promise<void>,
  selectedProfileId?: string,
  workspaceSelections: Record<string, string> = {},
  workspaceFolderPath?: string
): Promise<Profile | undefined> {
  const title = "Git Config User Profiles";
  const globalGitConfig = await getGlobalGitConfig();
  const panel = vscode.window.createWebviewPanel("gitConfigUserProfileEditor", title, vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
  });
  panel.webview.html = getProfileFormHtml(panel.webview, initialProfile, profiles, globalGitConfig.signingKey, selectedProfileId, workspaceSelections, workspaceFolderPath);
  const configurationListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("gitConfigUser.profiles") || event.affectsConfiguration("gitConfigUser.workspaceProfileSelections")) {
      panel.webview.postMessage({
        command: "profilesChanged",
        profiles: getProfilesInSettings().map((item) => ({ ...item, detail: undefined })),
        workspaceSelections: vscode.workspace.getConfiguration("gitConfigUser").get<Record<string, string>>("workspaceProfileSelections", {}),
        workspaceFolderPath,
      });
    }
  });

  let settled = false;
  let resolveForm: ((result: Profile | undefined) => void) | undefined;
  const finish = (result: Profile | undefined) => {
    if (!settled) {
      settled = true;
      resolveForm?.(result);
      if (!onSave) {
        panel.dispose();
      }
    }
  };

  panel.webview.onDidReceiveMessage(async (message) => {
    if (message.command === "cancel") {
      if (onSave) {
        panel.dispose();
      } else {
        finish(undefined);
      }
      return;
    }
    if (message.command === "delete") {
      const profileToDelete = profiles.find((item) => item.id === message.id || (!message.id && item.label === message.label));
      if (profileToDelete && onDelete) {
        try {
          await onDelete(profileToDelete);
          const profileIndex = profiles.indexOf(profileToDelete);
          if (profileIndex >= 0) {
            profiles.splice(profileIndex, 1);
          }
          panel.webview.postMessage({ command: "deleted", id: profileToDelete.id, label: profileToDelete.label });
          vscode.window.showInformationMessage(`Profile '${profileToDelete.label}' deleted.`);
        } catch (error) {
          vscode.window.showErrorMessage(error instanceof Error ? error.message : "Unable to delete profile.");
        }
      }
      return;
    }
    if (message.command === "removeWorkspaceSelection") {
      const config = vscode.workspace.getConfiguration("gitConfigUser");
      const selections = config.get<Record<string, string>>("workspaceProfileSelections", {});
      if (Object.prototype.hasOwnProperty.call(selections, message.folder)) {
        delete selections[message.folder];
        await config.update("workspaceProfileSelections", selections, vscode.ConfigurationTarget.Global);
      }
      return;
    }
    if (message.command !== "save") {
      return;
    }

    const values = message.profile as Profile & {
      signingKeySource?: "global" | "copy-global" | "custom" | "local";
      gpgFormatMode?: "global" | "custom" | "local";
      originalLabel?: string;
    };
    const normalizedOriginalLabel = values.originalLabel?.trim().toLowerCase();
    const currentProfile = profiles.find((item) => item.id === values.id || (!values.id && normalizedOriginalLabel && item.label.toLowerCase() === normalizedOriginalLabel));
    const nameError = util.validateProfileName(values.label, true, { id: currentProfile?.id, label: currentProfile?.label || values.originalLabel }, profiles);
    const userNameError = util.validateUserName(values.userName);
    const emailError = util.validateEmail(values.email);
    if (nameError || userNameError || emailError) {
      panel.webview.postMessage({
        command: "validationErrors",
        errors: {
          label: nameError,
          userName: userNameError,
          email: emailError,
        },
      });
      return;
    }

    const signingKeyMode = values.signingKeySource || "global";
    const signingKey = signingKeyMode === "copy-global" ? globalGitConfig.signingKey || "" : signingKeyMode === "custom" ? values.signingKey || "" : "";
    const commitGpgSignMode = values.commitGpgSignMode || (values.commitGpgSign === true ? "sign" : values.commitGpgSign === false ? "dont-sign" : "global");
    const commitGpgSign = commitGpgSignMode === "sign" ? true : commitGpgSignMode === "dont-sign" ? false : undefined;
    const gpgFormatMode =
      values.gpgFormatMode === "local" || values.gpgFormat === "__local__" ? "local" : values.gpgFormatMode === "custom" || Boolean(values.gpgFormat) ? "custom" : "global";
    const gpgFormat = gpgFormatMode === "custom" ? values.gpgFormat || undefined : undefined;
    const profile = new Profile(values.label, values.userName, values.email, currentProfile?.selected || false, signingKey, undefined, commitGpgSign, gpgFormat);
    if (currentProfile?.id) {
      profile.id = currentProfile.id;
    } else if (!currentProfile && values.id) {
      profile.id = values.id;
    }
    profile.signingKeyMode = signingKeyMode;
    profile.commitGpgSignMode = commitGpgSignMode;
    profile.gpgFormatMode = gpgFormatMode;
    if (onSave) {
      try {
        const oldProfileId = currentProfile?.id || currentProfile?.label;
        await onSave(profile, oldProfileId);
        const profileIndex = currentProfile ? profiles.indexOf(currentProfile) : -1;
        if (profileIndex >= 0) {
          profiles[profileIndex] = profile;
        } else {
          profiles.push(profile);
        }
        panel.webview.postMessage({ command: "saved", profile, previousProfileKey: oldProfileId });
        vscode.window.showInformationMessage(currentProfile ? `Profile '${profile.label}' updated.` : `Profile '${profile.label}' created. 🎉`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unable to save profile.";
        if (errorMessage.toLowerCase().includes("already exists")) {
          panel.webview.postMessage({ command: "validationErrors", errors: { label: errorMessage } });
        } else {
          vscode.window.showErrorMessage(errorMessage);
        }
      }
      return;
    }

    finish(profile);
  });
  if (!onSave) {
    panel.onDidDispose(() => {
      configurationListener.dispose();
      finish(undefined);
    });
  } else {
    panel.onDidDispose(() => configurationListener.dispose());
  }

  if (onSave) {
    return undefined;
  }

  return new Promise<Profile | undefined>((resolve) => {
    resolveForm = resolve;
  });
}

export async function showProfileDeleteUi(profiles: Profile[]): Promise<Profile | undefined> {
  const panel = vscode.window.createWebviewPanel("gitConfigUserProfileDelete", "Git Config User Profiles", vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
  });
  panel.webview.html = getDeleteHtml(panel.webview, profiles);

  return new Promise<Profile | undefined>((resolve) => {
    let settled = false;
    const finish = (result: Profile | undefined) => {
      if (!settled) {
        settled = true;
        resolve(result);
        panel.dispose();
      }
    };

    panel.webview.onDidReceiveMessage((message) => {
      if (message.command === "cancel") {
        finish(undefined);
      } else if (message.command === "delete") {
        finish(profiles[Number(message.index)]);
      }
    });
    panel.onDidDispose(() => finish(undefined));
  });
}

export function getProfileFormHtml(
  webview: vscode.Webview,
  profile?: Profile,
  profiles: Profile[] = [],
  globalSigningKey = "",
  selectedProfileId?: string,
  workspaceSelections: Record<string, string> = {},
  workspaceFolderPath?: string
): string {
  const nonce = Date.now().toString();
  const value = (input: string | undefined) => escapeHtml(input || "");
  const commitGpgSignMode = profile?.commitGpgSignMode || (profile?.commitGpgSign === true ? "sign" : profile?.commitGpgSign === false ? "dont-sign" : "global");
  const selected = (format: string) => (profile?.gpgFormat === format ? " selected" : "");
  const signingKeySource = profile?.signingKeyMode || (!profile?.signingKey ? "global" : profile.signingKey === globalSigningKey ? "copy-global" : "custom");
  const gpgFormatMode = profile?.gpgFormatMode || (profile?.gpgFormat ? "custom" : "global");
  const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;
  const profileItems = profiles
    .map(
      (item, index) =>
        `<li class="profile-item${item.id === profile?.id ? " active" : ""}" data-profile-index="${index}"><span class="avatar">${escapeHtml(item.label.charAt(0).toUpperCase())}</span><span class="profile-copy"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.email)}</small></span>${item.id === selectedProfileId ? '<span class="selected-badge">ACTIVE</span>' : ""}</li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${profile ? "Edit" : "Create"} profile</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
    .shell { display: grid; grid-template-columns: minmax(190px, 28%) 1fr; height: 100vh; min-height: 0; }
    .sidebar { display: flex; flex-direction: column; min-height: 0; height: 100%; padding: 28px 14px 20px; overflow: hidden; background: var(--vscode-sideBar-background); border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border)); }
    .brand { padding: 0 12px 18px; border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border)); }
    .eyebrow { margin: 0 0 5px; color: var(--vscode-descriptionForeground); font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
    .brand h1 { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: 0; }
    .profile-list { display: grid; gap: 4px; margin: 16px 0 0; padding: 0; list-style: none; }
    .profile-item { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 7px 10px; border-left: 2px solid transparent; color: var(--vscode-sideBar-foreground); }
    .profile-item.active { background: var(--vscode-list-activeSelectionBackground); border-left-color: var(--vscode-focusBorder); color: var(--vscode-list-activeSelectionForeground); }
    .profile-item.selected { border-left-color: var(--vscode-testing-iconPassed); }
    .profile-item.focused { background: var(--vscode-list-activeSelectionBackground); border-left-color: var(--vscode-focusBorder); color: var(--vscode-list-activeSelectionForeground); }
    .avatar { display: grid; place-items: center; flex: 0 0 28px; width: 28px; height: 28px; border-radius: 50%; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); font-size: 12px; font-weight: 600; }
    .profile-copy { display: grid; min-width: 0; gap: 3px; }
    .profile-copy strong, .profile-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .profile-copy strong { font-size: 13px; font-weight: 500; }
    .profile-copy small { color: var(--vscode-descriptionForeground); font-size: 11px; }
    .active .profile-copy small { color: inherit; opacity: .75; }
    .profile-delete { flex: 0 0 24px; width: 24px; min-height: 24px; margin-left: auto; padding: 0; border: 0; border-radius: 4px; color: var(--vscode-descriptionForeground); background: transparent; font-size: 17px; line-height: 1; }
    .profile-delete:hover, .profile-delete.confirming { color: var(--vscode-errorForeground); background: var(--vscode-inputValidation-errorBackground); }
    .profile-delete.confirming { width: auto; padding: 0 6px; font-size: 11px; }
    .profile-delete-cancel { display: none; min-height: 24px; padding: 2px 8px; border-color: transparent; border-radius: 4px; color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); font-size: 12px; }
    .profile-delete-cancel:hover { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryHoverBackground); }
    .profile-delete-cancel.visible { display: inline-flex; }
    .selected-badge { margin-left: auto; padding: 2px 7px; border: 1px solid color-mix(in srgb, var(--vscode-testing-iconPassed) 55%, transparent); border-radius: 999px; color: var(--vscode-testing-iconPassed); background: color-mix(in srgb, var(--vscode-testing-iconPassed) 10%, transparent); font-size: 9px; font-weight: 600; letter-spacing: .12em; line-height: 1.2; }
    .content { display: flex; flex-direction: column; min-width: 0; }
    .content-header { padding: 26px 40px 16px; border-bottom: 1px solid var(--vscode-panel-border); }
    .content-header h2 { margin: 0 0 6px; font-size: 24px; font-weight: 600; letter-spacing: 0; }
    .subtitle { margin: 0; color: var(--vscode-descriptionForeground); }
    .workspace-selections { display: grid; flex: 0 0 auto; gap: 8px; min-height: 0; }
    .workspace-selections h3 { margin: 0; font-size: 13px; font-weight: 600; }
    .workspace-selections p { margin: 0; color: var(--vscode-descriptionForeground); font-size: 12px; }
    .workspace-summary { min-height: 16px; }
    .workspace-selections ul { display: block; max-height: 190px; margin: 0; padding: 0; overflow-y: auto; border: 1px solid var(--vscode-panel-border); border-radius: 8px; list-style: none; scrollbar-color: var(--vscode-scrollbarSlider-background) transparent; }
    .workspace-selections li { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 48px; padding: 10px 12px; border-bottom: 1px solid var(--vscode-panel-border); }
    .workspace-selections li:last-child { border-bottom: 0; }
    .workspace-selections li::before { flex: 0 0 7px; width: 7px; height: 7px; border-radius: 1px; background: var(--vscode-descriptionForeground); content: ""; }
    .workspace-selections strong { flex: 1; min-width: 0; overflow: hidden; color: var(--vscode-foreground); font-size: 13px; font-weight: 400; text-overflow: ellipsis; white-space: nowrap; }
    .workspace-remove { flex: 0 0 24px; min-height: 24px; padding: 0; border: 0; border-radius: 4px; color: var(--vscode-descriptionForeground); background: transparent; font-size: 18px; line-height: 1; }
    .workspace-remove:hover { color: var(--vscode-errorForeground); background: transparent; }
    .workspace-remove.confirming { width: auto; flex: 0 0 auto; min-width: 68px; padding: 2px 8px; color: var(--vscode-errorForeground); background: var(--vscode-inputValidation-errorBackground); font-size: 12px; }
    .workspace-remove-cancel { display: none; flex: 0 0 auto; min-height: 24px; padding: 2px 10px; border: 0; border-radius: 4px; color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); font-size: 12px; }
    .workspace-remove-cancel:hover { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryHoverBackground); }
    .workspace-remove-cancel.visible { display: inline-flex; }
    form { display: flex; flex: 1; flex-direction: column; }
    .form-body { display: grid; gap: 22px; max-width: 720px; padding: 24px 40px 32px; }
    .section { display: grid; gap: 12px; }
    .section-heading { display: grid; gap: 2px; padding-bottom: 7px; border-bottom: 1px solid var(--vscode-panel-border); }
    .section-heading h3 { margin: 0; font-size: 13px; font-weight: 600; }
    .section-optional { margin-left: 8px; color: var(--vscode-descriptionForeground); font-size: 12px; font-weight: 400; }
    .section-heading p { margin: 0; color: var(--vscode-descriptionForeground); font-size: 12px; }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    label { display: grid; gap: 5px; color: var(--vscode-descriptionForeground); font-size: 12px; }
    label small { color: var(--vscode-descriptionForeground); opacity: .7; font-size: 11px; }
    label small.field-error { color: var(--vscode-errorForeground); opacity: 1; }
    label.full { grid-column: 1 / -1; }
    input, select { width: 100%; min-height: 32px; padding: 6px 9px; border: 1px solid var(--vscode-input-border, transparent); border-radius: 2px; outline: none; color: var(--vscode-input-foreground); background: var(--vscode-input-background); font: inherit; }
    input:focus, select:focus { border-color: var(--vscode-focusBorder); }
    input.input-error, select.input-error { border-color: var(--vscode-inputValidation-errorBorder); }
    .toggle-row { display: flex; align-items: flex-start; gap: 12px; padding: 4px 0; }
    .toggle-copy { display: grid; gap: 3px; color: var(--vscode-foreground); }
    .toggle-copy small { color: var(--vscode-descriptionForeground); }
    .toggle-row input { position: absolute; width: 1px; height: 1px; opacity: 0; }
    .toggle-control { position: relative; flex: 0 0 38px; width: 38px; height: 22px; margin-top: 1px; border-radius: 999px; background: var(--vscode-input-background); box-shadow: inset 0 0 0 1px var(--vscode-input-border, var(--vscode-panel-border)); transition: background 140ms ease-out; }
    .toggle-control::after { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: var(--vscode-descriptionForeground); content: ""; transition: transform 140ms ease-out, background 140ms ease-out; }
    .toggle-row input:checked + .toggle-control { background: var(--vscode-button-background); box-shadow: none; }
    .toggle-row input:checked + .toggle-control::after { background: var(--vscode-button-foreground); transform: translateX(16px); }
    .footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: auto; padding: 16px 40px; border-top: 1px solid var(--vscode-panel-border); }
    .footer-spacer { flex: 1; }
    button { min-height: 30px; padding: 5px 14px; border: 1px solid var(--vscode-button-border, transparent); border-radius: 2px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); font: inherit; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
    button.danger { color: var(--vscode-errorForeground); background: transparent; border-color: var(--vscode-inputValidation-errorBorder); }
    button.danger:hover { background: var(--vscode-inputValidation-errorBackground); }
    button.danger.confirming { color: var(--vscode-button-foreground); background: var(--vscode-testing-iconFailed); border-color: transparent; }
    .new-profile { margin: 16px 10px 0; }
    .error { min-height: 18px; color: var(--vscode-errorForeground); font-size: 12px; }
    @media (max-width: 620px) { .shell { grid-template-columns: 1fr; } .sidebar { padding: 18px 12px; } .profile-list { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); } .content-header, .form-body { padding-left: 22px; padding-right: 22px; } .field-grid { grid-template-columns: 1fr; } label.full { grid-column: auto; } .footer { padding-left: 22px; padding-right: 22px; } }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><p class="eyebrow">Git identity</p><h1>Profiles</h1></div>
      <ul class="profile-list">${profileItems || '<li class="profile-item"><span class="profile-copy"><small>No profiles yet</small></span></li>'}</ul>
      <button type="button" class="new-profile" id="new-profile">+ New profile</button>
    </aside>
    <main class="content">
      <header class="content-header"><p class="eyebrow">${profile ? "Profile settings" : "New profile"}</p><h2>${profile ? escapeHtml(profile.label) : "Create a profile"}</h2><p class="subtitle">Git identity settings.</p></header>
      <form id="profile-form" novalidate>
        <div class="form-body">
          <section class="section"><div class="section-heading"><h3>Identity</h3><p>Name and email for commits.</p></div><div class="field-grid"><label>Profile name<input name="label" value="${value(profile?.label)}" required><small></small></label><label>Git user name<input name="userName" value="${value(profile?.userName)}" required><small></small></label><label class="full">Email address<input name="email" type="email" value="${value(profile?.email)}" required><small></small></label></div></section>
          <section class="section"><div class="section-heading"><h3>Commit signing <span class="section-optional">Optional</span></h3><p>Signing options for this profile.</p></div><div class="field-grid"><label class="full">Signing format<select name="gpgFormat"><option value=""${gpgFormatMode === "global" ? " selected" : ""}>Use global setting</option><option value="openpgp"${selected("openpgp")}>GPG</option><option value="ssh"${selected("ssh")}>SSH</option><option value="x509"${selected("x509")}>X.509</option><option value="__local__"${gpgFormatMode === "local" ? " selected" : ""}>Keep local setting</option></select></label><label class="full">Signing key source<select name="signingKeySource"><option value="global"${signingKeySource === "global" ? " selected" : ""}>Use global Git signing key</option><option value="copy-global"${signingKeySource === "copy-global" ? " selected" : ""}>Copy global key to this profile</option><option value="custom"${signingKeySource === "custom" ? " selected" : ""}>Set a key for this profile</option><option value="local"${signingKeySource === "local" ? " selected" : ""}>Keep local signing key</option></select><small class="field-help">${globalSigningKey ? "Global signing key configured" : "No global signing key configured"}</small></label><label class="full" id="custom-key-field">Profile signing key<input name="signingKey" value="${value(profile?.signingKey)}" placeholder="GPG key ID, SSH public key, or X.509 identity"></label><label class="full">Commit signing policy<select name="commitGpgSignMode"><option value="global"${commitGpgSignMode === "global" ? " selected" : ""}>Use global setting</option><option value="sign"${commitGpgSignMode === "sign" ? " selected" : ""}>Sign every commit</option><option value="dont-sign"${commitGpgSignMode === "dont-sign" ? " selected" : ""}>Do not sign commits</option><option value="local"${commitGpgSignMode === "local" ? " selected" : ""}>Keep local setting</option></select></label></div></section>
          <section class="workspace-selections"><div class="section-heading"><h3>Where it applies</h3></div><p class="workspace-summary" id="workspace-summary"></p><ul id="workspace-selection-list"></ul></section>
        </div>
        <footer class="footer"><button type="button" class="danger" id="delete-profile">Delete profile</button><span class="footer-spacer"></span><button type="button" class="secondary" id="cancel">Cancel</button><button type="submit">Save profile</button></footer>
      </form>
    </main>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const form = document.getElementById('profile-form');
    const profiles = ${JSON.stringify(profiles.map((item) => ({ ...item, detail: undefined })))};
    let selectedProfileId = ${JSON.stringify(selectedProfileId || "")};
    let focusedProfileId = ${JSON.stringify(profile?.id || selectedProfileId || "")};
    let workspaceSelections = ${JSON.stringify(workspaceSelections)};
    const profileList = document.querySelector('.profile-list');
    const workspaceSelectionList = document.getElementById('workspace-selection-list');
    const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
    const profileKey = (profile) => profile.id || profile.label || '';
    const profileItemHtml = (profile, index) => '<li class="profile-item' + (profileKey(profile) === selectedProfileId ? ' selected' : '') + (profileKey(profile) === focusedProfileId ? ' focused' : '') + '" data-profile-index="' + index + '"><span class="avatar">' + escapeHtml((profile.label || '?').charAt(0).toUpperCase()) + '</span><span class="profile-copy"><strong>' + escapeHtml(profile.label) + '</strong><small>' + escapeHtml(profile.email) + '</small></span>' + (profileKey(profile) === selectedProfileId ? '<span class="selected-badge">ACTIVE</span>' : '') + '<button type="button" class="profile-delete" data-profile-delete-index="' + index + '" aria-label="Delete ' + escapeHtml(profile.label) + '" title="Delete profile">×</button><button type="button" class="profile-delete-cancel" data-profile-delete-cancel-index="' + index + '" aria-label="Cancel deleting ' + escapeHtml(profile.label) + '" title="Cancel deletion">Cancel</button></li>';
    const workspaceSelectionItemHtml = (folder) => '<li><strong title="' + escapeHtml(folder) + '">' + escapeHtml(folder) + '</strong><button type="button" class="workspace-remove" data-workspace-folder="' + escapeHtml(folder) + '" aria-label="Remove workspace selection" title="Remove workspace selection">×</button><button type="button" class="workspace-remove-cancel" data-workspace-cancel="' + escapeHtml(folder) + '" aria-label="Cancel removing workspace selection" title="Cancel removal">Cancel</button></li>';
    const globalSigningKey = ${JSON.stringify(globalSigningKey)};
    const setValue = (name, value) => { form.elements[name].value = value || ''; };
    const updateSigningKeySource = () => { document.getElementById('custom-key-field').style.display = form.elements.signingKeySource.value === 'custom' ? 'grid' : 'none'; };
    const deleteButton = document.getElementById('delete-profile');
    const workspaceSummary = document.getElementById('workspace-summary');
    const validationFields = ['label', 'userName', 'email'];
    const validationFieldDefaultHelp = {};
    validationFields.forEach((fieldName) => {
      const helper = form.elements[fieldName]?.nextElementSibling;
      validationFieldDefaultHelp[fieldName] = helper?.textContent || '';
    });
    const setFieldValidationState = (fieldName, message) => {
      const field = form.elements[fieldName];
      const helper = field?.nextElementSibling;
      if (field?.classList) {
        if (message) {
          field.classList.add('input-error');
        } else {
          field.classList.remove('input-error');
        }
      }
      if (helper) {
        helper.textContent = message || validationFieldDefaultHelp[fieldName] || '';
        if (helper.classList) {
          if (message) {
            helper.classList.add('field-error');
          } else {
            helper.classList.remove('field-error');
          }
        }
      }
    };
    const clearValidationErrors = () => {
      validationFields.forEach((fieldName) => {
        setFieldValidationState(fieldName, undefined);
      });
    };
    const showValidationErrors = (errors = {}) => {
      clearValidationErrors();
      validationFields.forEach((fieldName) => {
        const message = errors[fieldName];
        if (!message) {
          return;
        }
        setFieldValidationState(fieldName, String(message));
      });
    };
    const initialProfileState = ${JSON.stringify(profile ? { id: profile.id || "", label: profile.label || "" } : undefined)};
    if (initialProfileState) {
      form.dataset.profileId = initialProfileState.id || '';
      form.dataset.profileLabel = initialProfileState.label || '';
    }
    const updateDeleteButton = () => { deleteButton.style.display = form.dataset.profileId || form.dataset.profileLabel ? 'inline-flex' : 'none'; };
    let deleteConfirmationPending = false;
    const switchToCreateMode = () => {
      form.reset();
      setValue('label', ''); setValue('userName', ''); setValue('email', ''); setValue('signingKey', '');
      form.elements.gpgFormat.value = ''; form.elements.commitGpgSignMode.value = 'global'; form.elements.signingKeySource.value = 'global';
      delete form.dataset.profileId; delete form.dataset.profileLabel; focusedProfileId = ''; deleteConfirmationPending = false;
      deleteButton.classList.remove('confirming'); deleteButton.textContent = 'Delete profile'; updateSigningKeySource(); updateDeleteButton();
      clearValidationErrors();
      renderWorkspaceSelections('');
      document.querySelector('.content-header h2').textContent = 'Create a profile';
      document.querySelector('.content-header .eyebrow').textContent = 'New profile';
      document.querySelectorAll('.profile-item').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('.profile-item').forEach((item) => item.classList.remove('focused'));
    };
    const loadProfile = (profile) => {
      focusedProfileId = profileKey(profile);
      setValue('label', profile.label); setValue('userName', profile.userName); setValue('email', profile.email);
      setValue('signingKey', profile.signingKey); form.elements.gpgFormat.value = profile.gpgFormatMode === 'local' ? '__local__' : profile.gpgFormat || ''; form.elements.signingKeySource.value = profile.signingKeyMode || (!profile.signingKey ? 'global' : profile.signingKey === globalSigningKey ? 'copy-global' : 'custom'); form.elements.commitGpgSignMode.value = profile.commitGpgSignMode || (profile.commitGpgSign === true ? 'sign' : profile.commitGpgSign === false ? 'dont-sign' : 'global'); updateSigningKeySource();
      deleteConfirmationPending = false; deleteButton.classList.remove('confirming'); deleteButton.textContent = 'Delete profile';
      clearValidationErrors();
      form.dataset.profileId = profile.id || ''; form.dataset.profileLabel = profile.label || ''; updateDeleteButton();
      document.querySelector('.content-header h2').textContent = profile.label; document.querySelector('.content-header .eyebrow').textContent = 'Profile settings';
      renderProfileList();
      profileList.querySelectorAll('.profile-item').forEach((item) => item.classList.remove('focused'));
      const focusedRow = profileList.querySelector('[data-profile-index="' + profiles.indexOf(profile) + '"]');
      if (focusedRow) focusedRow.classList.add('focused');
      renderWorkspaceSelections(focusedProfileId);
    };
    const renderProfileList = () => {
      profileList.innerHTML = profiles.map(profileItemHtml).join('') || '<li class="profile-item"><span class="profile-copy"><small>No profiles yet</small></span></li>';
      profileList.querySelectorAll('[data-profile-index]').forEach((item) => item.addEventListener('click', () => {
        profileList.querySelectorAll('.profile-item').forEach((row) => row.classList.remove('focused'));
        item.classList.add('focused');
        loadProfile(profiles[Number(item.dataset.profileIndex)]);
      }));
      profileList.querySelectorAll('[data-profile-delete-index]').forEach((button) => button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!button.classList.contains('confirming')) {
          button.classList.add('confirming');
          button.textContent = 'Delete?';
          button.nextElementSibling.classList.add('visible');
          return;
        }
        const profile = profiles[Number(button.dataset.profileDeleteIndex)];
        vscode.postMessage({ command: 'delete', id: profile.id || undefined, label: profile.label });
      }));
      profileList.querySelectorAll('[data-profile-delete-cancel-index]').forEach((button) => button.addEventListener('click', (event) => {
        event.stopPropagation();
        const deleteButton = button.previousElementSibling;
        deleteButton.classList.remove('confirming');
        deleteButton.textContent = '×';
        button.classList.remove('visible');
      }));
    };
    const renderWorkspaceSelections = (profileId) => { const entries = Object.entries(workspaceSelections).filter(([, mappedProfileId]) => mappedProfileId === profileId); const folders = entries.map(([folder]) => folder); if (workspaceSummary) { workspaceSummary.textContent = folders.length === 0 ? 'No workspace selections for this profile.' : folders.length === 1 ? '1 workspace selection.' : folders.length + ' workspace selections.'; } workspaceSelectionList.innerHTML = entries.map(([folder]) => workspaceSelectionItemHtml(folder)).join('') || '<li><small>No workspace selections for this profile.</small></li>'; workspaceSelectionList.querySelectorAll('[data-workspace-folder]').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); if (!button.classList.contains('confirming')) { button.classList.add('confirming'); button.textContent = 'Delete?'; button.nextElementSibling.classList.add('visible'); return; } vscode.postMessage({ command: 'removeWorkspaceSelection', folder: button.dataset.workspaceFolder }); })); workspaceSelectionList.querySelectorAll('[data-workspace-cancel]').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); button.classList.remove('visible'); const removeButton = button.previousElementSibling; removeButton.classList.remove('confirming'); removeButton.textContent = '×'; })); };
    renderProfileList();
    renderWorkspaceSelections(focusedProfileId);
    document.getElementById('new-profile').addEventListener('click', () => {
      switchToCreateMode();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      clearValidationErrors();
      const data = new FormData(form);
      vscode.postMessage({ command: 'save', profile: {
        label: data.get('label'), userName: data.get('userName'), email: data.get('email'),
        signingKey: data.get('signingKey'), signingKeySource: data.get('signingKeySource'), commitGpgSignMode: data.get('commitGpgSignMode'), commitGpgSign: data.get('commitGpgSignMode') === 'sign' ? true : data.get('commitGpgSignMode') === 'dont-sign' ? false : undefined, gpgFormat: data.get('gpgFormat') || undefined, gpgFormatMode: data.get('gpgFormat') === '__local__' ? 'local' : undefined, id: form.dataset.profileId || undefined, originalLabel: form.dataset.profileLabel || undefined
      }});
    });
    document.getElementById('cancel').addEventListener('click', () => vscode.postMessage({ command: 'cancel' }));
    deleteButton.addEventListener('click', () => {
      if (!deleteConfirmationPending) {
        deleteConfirmationPending = true; deleteButton.classList.add('confirming'); deleteButton.textContent = 'Confirm delete';
        return;
      }
      vscode.postMessage({ command: 'delete', id: form.dataset.profileId || undefined, label: form.dataset.profileLabel });
    });
    form.elements.signingKeySource.addEventListener('change', updateSigningKeySource);
    updateSigningKeySource();
    updateDeleteButton();
    window.addEventListener('message', (event) => {
      if (event.data.command === 'profilesChanged') {
        profiles.splice(0, profiles.length, ...event.data.profiles);
        workspaceSelections = event.data.workspaceSelections || {};
        const activeWorkspacePath = event.data.workspaceFolderPath || ${JSON.stringify(workspaceFolderPath || "")};
        selectedProfileId = workspaceSelections[activeWorkspacePath] || selectedProfileId;
        focusedProfileId = form.dataset.profileId || focusedProfileId;
        renderProfileList();
        renderWorkspaceSelections(form.dataset.profileId || '');
      }
      if (event.data.command === 'validationErrors') {
        showValidationErrors(event.data.errors || {});
        return;
      }
      if (event.data.command === 'saved') {
        if (event.data.profile) {
          const previousProfileKey = event.data.previousProfileKey;
          const profileIndex = profiles.findIndex((profile) => profile.id === event.data.profile.id || profile.id === previousProfileKey || (!profile.id && profile.label === previousProfileKey));
          if (profileIndex >= 0) {
            profiles[profileIndex] = event.data.profile;
          } else {
            profiles.push(event.data.profile);
          }
          renderProfileList();
        }
        switchToCreateMode();
      }
      if (event.data.command === 'deleted') {
        const profileIndex = profiles.findIndex((profile) => profile.id === event.data.id || profile.label === event.data.label);
        if (profileIndex >= 0) {
          profiles.splice(profileIndex, 1);
          renderProfileList();
        }
        switchToCreateMode();
      }
    });
  </script>
</body>
</html>`;
}

function getDeleteHtml(webview: vscode.Webview, profiles: Profile[]): string {
  const nonce = Date.now().toString();
  const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;
  const items = profiles
    .map(
      (profile, index) =>
        `<li><span><strong>${escapeHtml(profile.label)}</strong><small>${escapeHtml(profile.userName)} (${escapeHtml(profile.email)})</small></span><button data-index="${index}">Delete</button></li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delete profile</title>
  <style>
    body { max-width: 680px; margin: 0 auto; padding: 24px; }
    ul { list-style: none; padding: 0; display: grid; gap: 10px; }
    li { display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid var(--vscode-panel-border); padding: 12px; }
    span { display: grid; gap: 4px; }
    small { color: var(--vscode-descriptionForeground); }
    button { font: inherit; padding: 7px; }
    .actions { margin-top: 16px; }
  </style>
</head>
<body>
  <h1>Delete profile</h1>
  <p>Select a profile to permanently delete.</p>
  <ul>${items || "<li>No profiles available.</li>"}</ul>
  <div class="actions"><button id="cancel">Cancel</button></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('[data-index]').forEach((button) => button.addEventListener('click', () => {
      if (confirm('Delete this profile? This cannot be undone.')) vscode.postMessage({ command: 'delete', index: button.dataset.index });
    }));
    document.getElementById('cancel').addEventListener('click', () => vscode.postMessage({ command: 'cancel' }));
  </script>
</body>
</html>`;
}

function escapeHtml(value: string | undefined): string {
  return (value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}
