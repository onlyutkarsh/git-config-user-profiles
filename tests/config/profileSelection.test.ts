import { getSelectedProfileId, saveVscProfile, getProfilesInSettings } from '../../src/config';
import { Profile } from '../../src/models';
import * as vscode from 'vscode';

/**
 * Simplified tests for workspace-scoped profile selection and migration
 */

jest.mock('vscode');
jest.mock('fs');

// Mock logger
jest.mock('../../src/util/logger', () => ({
  Logger: {
    instance: {
      logDebug: jest.fn(),
      logInfo: jest.fn(),
      logWarning: jest.fn(),
      logError: jest.fn(),
    },
  },
}));

// Mock util functions
jest.mock('../../src/util', () => ({
  trimProperties: jest.fn((profile) => profile),
  Logger: {
    instance: {
      logDebug: jest.fn(),
      logInfo: jest.fn(),
      logWarning: jest.fn(),
      logError: jest.fn(),
    },
  },
}));

describe('Profile Selection - Workspace Scope & Migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock file system to always return file not found
    const fs = require('fs');
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.readFileSync = jest.fn().mockImplementation(() => {
      throw new Error('File not found');
    });
    fs.writeFileSync = jest.fn();
    fs.mkdirSync = jest.fn();

    // Clear mock configuration storage
    if ((vscode.workspace as any)._clearMockConfigurations) {
      (vscode.workspace as any)._clearMockConfigurations();
    }
  });

  describe('getSelectedProfileId', () => {
    test('should return workspace-scoped selectedProfileId when available via VSCode API', () => {
      const workspaceUri = vscode.Uri.file('/test/workspace-1');
      const config = vscode.workspace.getConfiguration('gitConfigUser', workspaceUri);
      config.update('selectedProfileId', 'workspace-profile-123');

      const result = getSelectedProfileId(workspaceUri);

      expect(result).toBe('workspace-profile-123');
    });

    test('should fallback to legacy global selected flag when workspace scope is empty', () => {
      const workspaceUri = vscode.Uri.file('/test/workspace-fallback');

      // No workspace-scoped value
      const workspaceConfig = vscode.workspace.getConfiguration('gitConfigUser', workspaceUri);
      workspaceConfig.update('selectedProfileId', undefined);

      // Set global profiles with selected flag
      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const profiles = [
        { id: 'profile-1', label: 'Work', userName: 'work', email: 'work@example.com', selected: false },
        { id: 'profile-2', label: 'Personal', userName: 'personal', email: 'personal@example.com', selected: true },
      ];
      globalConfig.update('profiles', profiles);

      const result = getSelectedProfileId(workspaceUri);

      expect(result).toBe('profile-2');
    });

    test('should return undefined when no selection exists anywhere', () => {
      const workspaceUri = vscode.Uri.file('/test/workspace-empty');

      const workspaceConfig = vscode.workspace.getConfiguration('gitConfigUser', workspaceUri);
      workspaceConfig.update('selectedProfileId', undefined);

      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const profiles = [
        { id: 'profile-1', label: 'Work', userName: 'work', email: 'work@example.com', selected: false },
      ];
      globalConfig.update('profiles', profiles);

      const result = getSelectedProfileId(workspaceUri);

      expect(result).toBeUndefined();
    });

    test('should work without workspace URI (backward compatibility)', () => {
      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const profiles = [
        { id: 'profile-global', label: 'Work', userName: 'work', email: 'work@example.com', selected: true },
      ];
      globalConfig.update('profiles', profiles);

      const result = getSelectedProfileId();

      expect(result).toBe('profile-global');
    });

    test('should prioritize workspace scope over global selected flag', () => {
      const workspaceUri = vscode.Uri.file('/path/to/workspace');

      // Workspace-scoped selection
      const workspaceConfig = vscode.workspace.getConfiguration('gitConfigUser', workspaceUri);
      workspaceConfig.update('selectedProfileId', 'workspace-profile-123');

      // Global profiles with different selected flag
      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const profiles = [
        { id: 'global-profile-456', label: 'Global', userName: 'global', email: 'global@example.com', selected: true },
      ];
      globalConfig.update('profiles', profiles);

      const result = getSelectedProfileId(workspaceUri);

      expect(result).toBe('workspace-profile-123');
    });
  });

  describe('saveVscProfile - Migration Scenarios', () => {
    test('should remove global selected flags when selecting a profile', async () => {
      const workspaceUri = vscode.Uri.file('/path/to/workspace');

      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const existingProfiles = [
        { id: 'profile-1', label: 'Work', userName: 'work', email: 'work@example.com', selected: true, signingKey: '' },
        { id: 'profile-2', label: 'Personal', userName: 'personal', email: 'personal@example.com', selected: false, signingKey: '' },
      ];
      globalConfig.update('profiles', existingProfiles);

      const profileToSelect = new Profile('Personal', 'personal', 'personal@example.com', true, '', 'Personal (personal@example.com)');
      profileToSelect.id = 'profile-2';

      await saveVscProfile(profileToSelect, undefined, workspaceUri);

      const savedProfiles = getProfilesInSettings();
      const hasSelectedFlag = savedProfiles.some(p => p.selected === true);
      expect(hasSelectedFlag).toBe(false);
    });

    test('should clean up $(check) markers from labels during migration', async () => {
      const workspaceUri = vscode.Uri.file('/path/to/workspace');

      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const existingProfiles = [
        { id: 'profile-1', label: '$(check) Work', userName: 'work', email: 'work@example.com', selected: true, signingKey: '' },
      ];
      globalConfig.update('profiles', existingProfiles);

      const profileToSelect = new Profile('$(check) Work', 'work', 'work@example.com', true, '', 'Work');
      profileToSelect.id = 'profile-1';

      await saveVscProfile(profileToSelect, undefined, workspaceUri);

      const savedProfiles = getProfilesInSettings();
      const hasCheckMarks = savedProfiles.some(p => p.label.includes('$(check)'));
      expect(hasCheckMarks).toBe(false);
    });

    test('should NOT change workspace scope when updating a profile (not selecting)', async () => {
      const workspaceUri = vscode.Uri.file('/path/to/workspace');

      // Set initial workspace selection
      const workspaceConfig = vscode.workspace.getConfiguration('gitConfigUser', workspaceUri);
      workspaceConfig.update('selectedProfileId', 'original-selection');

      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const existingProfiles = [
        { id: 'profile-1', label: 'Work', userName: 'work', email: 'work@example.com', signingKey: '' },
      ];
      globalConfig.update('profiles', existingProfiles);

      const updatedProfile = new Profile('Work Updated', 'work-new', 'work@example.com', false, 'KEY123', 'Work');
      updatedProfile.id = 'profile-1';

      // Pass oldProfileId to indicate this is an update, not a selection
      await saveVscProfile(updatedProfile, 'profile-1', workspaceUri);

      // Verify workspace scope was NOT changed
      const selectedId = getSelectedProfileId(workspaceUri);
      expect(selectedId).toBe('original-selection');
    });

    test('should add new profile when it does not exist', async () => {
      const workspaceUri = vscode.Uri.file('/path/to/workspace');

      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      globalConfig.update('profiles', []);

      const newProfile = new Profile('New Profile', 'new', 'new@example.com', true, 'GPG123', 'New');

      await saveVscProfile(newProfile, undefined, workspaceUri);

      const savedProfiles = getProfilesInSettings();
      expect(savedProfiles.length).toBe(1);
      expect(savedProfiles[0].label).toBe('New Profile');
      expect(savedProfiles[0].userName).toBe('new');
      expect(savedProfiles[0].signingKey).toBe('GPG123');
    });
  });

  describe('Migration Edge Cases', () => {
    test('should handle empty profiles array', async () => {
      const workspaceUri = vscode.Uri.file('/path/to/workspace');

      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      globalConfig.update('profiles', []);

      const newProfile = new Profile('First Profile', 'user', 'user@example.com', true, '', 'First');

      await saveVscProfile(newProfile, undefined, workspaceUri);

      const savedProfiles = getProfilesInSettings();
      expect(savedProfiles.length).toBe(1);
      expect(savedProfiles[0].label).toBe('First Profile');
    });

    test('should handle multiple profiles with selected=true (data corruption scenario)', () => {
      const workspaceUri = vscode.Uri.file('/test/corrupted');

      const workspaceConfig = vscode.workspace.getConfiguration('gitConfigUser', workspaceUri);
      workspaceConfig.update('selectedProfileId', undefined);

      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const corruptedProfiles = [
        { id: 'corrupt-1', label: 'Work', userName: 'work', email: 'work@example.com', selected: true },
        { id: 'corrupt-2', label: 'Personal', userName: 'personal', email: 'personal@example.com', selected: true },
      ];
      globalConfig.update('profiles', corruptedProfiles);

      const result = getSelectedProfileId(workspaceUri);

      // Should return the first one found with selected=true
      expect(result).toBe('corrupt-1');
    });

    test('should preserve profile properties during migration', async () => {
      const workspaceUri = vscode.Uri.file('/test/migration');

      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const existingProfiles = [
        {
          id: 'migrate-1',
          label: '$(check) Work',
          userName: 'work',
          email: 'work@example.com',
          signingKey: 'GPG-KEY-123',
          selected: true
        },
      ];
      globalConfig.update('profiles', existingProfiles);

      const profileToSelect = new Profile('$(check) Work', 'work', 'work@example.com', true, 'GPG-KEY-123', 'Work');
      profileToSelect.id = 'migrate-1';

      await saveVscProfile(profileToSelect, undefined, workspaceUri);

      const savedProfiles = getProfilesInSettings();
      const migratedProfile = savedProfiles.find(p => p.id === 'migrate-1');
      expect(migratedProfile).toBeDefined();
      expect(migratedProfile?.userName).toBe('work');
      expect(migratedProfile?.email).toBe('work@example.com');
      expect(migratedProfile?.signingKey).toBe('GPG-KEY-123');
      expect(migratedProfile?.selected).toBeUndefined();
      expect(migratedProfile?.label).not.toContain('$(check)');
    });

    test('should handle profiles without selected property (fresh install)', () => {
      const workspaceUri = vscode.Uri.file('/test/fresh');

      const workspaceConfig = vscode.workspace.getConfiguration('gitConfigUser', workspaceUri);
      workspaceConfig.update('selectedProfileId', undefined);

      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const profiles = [
        { id: 'fresh-1', label: 'Work', userName: 'work', email: 'work@example.com', signingKey: '' },
        { id: 'fresh-2', label: 'Personal', userName: 'personal', email: 'personal@example.com', signingKey: '' },
      ];
      globalConfig.update('profiles', profiles);

      const result = getSelectedProfileId(workspaceUri);

      expect(result).toBeUndefined();
    });
  });
});
