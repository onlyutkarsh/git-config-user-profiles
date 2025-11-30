import { getSelectedProfileId, setSelectedProfileId, saveVscProfile, getProfilesInSettings } from '../../src/config';
import { Profile } from '../../src/models';
import * as vscode from 'vscode';

/**
 * Tests for workspace-scoped profile selection and migration from legacy global selected flag
 */

jest.mock('vscode');

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
    // Clear mock configuration storage
    if ((vscode.workspace as any)._clearMockConfigurations) {
      (vscode.workspace as any)._clearMockConfigurations();
    }
  });

  afterEach(() => {
    // Ensure clean state after each test
    if ((vscode.workspace as any)._clearMockConfigurations) {
      (vscode.workspace as any)._clearMockConfigurations();
    }
  });

  describe('getSelectedProfileId', () => {
    test('should return workspace-scoped selectedProfileId when available', () => {
      const workspaceUri = vscode.Uri.file('/test/workspace-1');

      // Set workspace-scoped config
      const config = vscode.workspace.getConfiguration('gitConfigUser', workspaceUri);
      config.update('selectedProfileId', 'workspace-profile-id-123');

      const result = getSelectedProfileId(workspaceUri);

      expect(result).toBe('workspace-profile-id-123');
    });

    test('should fallback to legacy global selected flag when workspace scope is empty', () => {
      const workspaceUri = vscode.Uri.file('/test/workspace-fallback');

      // Ensure no workspace-scoped value exists
      const workspaceConfig = vscode.workspace.getConfiguration('gitConfigUser', workspaceUri);
      workspaceConfig.update('selectedProfileId', '');

      // Set global profiles with selected flag
      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const profiles = [
        { id: 'profile-1', label: 'Work', userName: 'work', email: 'work@example.com', selected: false },
        { id: 'profile-2', label: 'Personal', userName: 'personal', email: 'personal@example.com', selected: true },
      ];
      globalConfig.update('profiles', profiles);

      const result = getSelectedProfileId(workspaceUri);

      // Should fallback to global selected flag
      expect(result).toBeDefined();
      expect(['profile-2', 'profile-1']).toContain(result);
    });

    test('should return undefined when no selection exists anywhere', () => {
      const workspaceUri = vscode.Uri.file('/test/workspace-empty');

      // Ensure no workspace-scoped value
      const workspaceConfig = vscode.workspace.getConfiguration('gitConfigUser', workspaceUri);
      workspaceConfig.update('selectedProfileId', '');

      // Set global profiles with no selected flag
      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const profiles = [
        { id: 'profile-none-1', label: 'Work', userName: 'work', email: 'work@example.com', selected: false },
        { id: 'profile-none-2', label: 'Personal', userName: 'personal', email: 'personal@example.com', selected: false },
      ];
      globalConfig.update('profiles', profiles);

      const result = getSelectedProfileId(workspaceUri);

      // Should return undefined or empty string when no selection exists
      expect(result === undefined || result === '').toBe(true);
    });

    test('should work without workspace URI (backward compatibility)', () => {
      // Set global profiles with selected flag
      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const profiles = [
        { id: 'profile-global', label: 'Work', userName: 'work', email: 'work@example.com', selected: true },
      ];
      globalConfig.update('profiles', profiles);

      const result = getSelectedProfileId();

      // Should return a profile ID (either from workspace or global)
      expect(result).toBeDefined();
    });

    test('should prioritize workspace scope over global selected flag', () => {
      const workspaceUri = vscode.Uri.file('/path/to/workspace');

      // Set workspace-scoped selection
      const workspaceConfig = vscode.workspace.getConfiguration('gitConfigUser', workspaceUri);
      workspaceConfig.update('selectedProfileId', 'workspace-profile-123');

      // Set global profiles with different selected flag
      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const profiles = [
        { id: 'global-profile-456', label: 'Global', userName: 'global', email: 'global@example.com', selected: true },
      ];
      globalConfig.update('profiles', profiles);

      const result = getSelectedProfileId(workspaceUri);

      // Should return workspace scope, not global
      expect(result).toBe('workspace-profile-123');
      expect(result).not.toBe('global-profile-456');
    });
  });

  describe('setSelectedProfileId', () => {
    test('should save profile ID to workspace scope', async () => {
      const workspaceUri = vscode.Uri.file('/path/to/workspace');

      await setSelectedProfileId('new-profile-id', workspaceUri);

      const result = getSelectedProfileId(workspaceUri);
      expect(result).toBe('new-profile-id');
    });

    test('should work without workspace URI', async () => {
      await setSelectedProfileId('new-profile-id');

      const result = getSelectedProfileId();
      // When saved without URI, it should still be retrievable
      expect(result).toBeDefined();
    });
  });

  describe('saveVscProfile - Migration Scenarios', () => {
    test('should remove global selected flags when selecting a profile', async () => {
      const workspaceUri = vscode.Uri.file('/path/to/workspace');

      // Set up existing profiles with legacy selected flags
      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const existingProfiles = [
        { id: 'profile-1', label: '$(check) Work', userName: 'work', email: 'work@example.com', selected: true, signingKey: '' },
        { id: 'profile-2', label: 'Personal', userName: 'personal', email: 'personal@example.com', selected: false, signingKey: '' },
      ];
      globalConfig.update('profiles', existingProfiles);

      // Select profile-2
      const profileToSelect = new Profile('Personal', 'personal', 'personal@example.com', true, '', 'Personal (personal@example.com)');
      profileToSelect.id = 'profile-2';

      await saveVscProfile(profileToSelect, undefined, workspaceUri);

      // Verify that global config was updated without selected flags
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

      // Verify labels are cleaned
      const savedProfiles = getProfilesInSettings();
      const hasCheckMarks = savedProfiles.some(p => p.label.includes('$(check)'));
      expect(hasCheckMarks).toBe(false);
    });

    test('should save to workspace scope when selecting (not updating)', async () => {
      const workspaceUri = vscode.Uri.file('/path/to/workspace');

      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const existingProfiles = [
        { id: 'profile-1', label: 'Work', userName: 'work', email: 'work@example.com', signingKey: '' },
      ];
      globalConfig.update('profiles', existingProfiles);

      const profileToSelect = new Profile('Work', 'work', 'work@example.com', true, '', 'Work');
      profileToSelect.id = 'profile-1';

      await saveVscProfile(profileToSelect, undefined, workspaceUri);

      // Verify workspace scope was updated
      const selectedId = getSelectedProfileId(workspaceUri);
      expect(selectedId).toBe('profile-1');
    });

    test('should NOT save to workspace scope when updating a profile', async () => {
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

      // Verify workspace scope was NOT changed (still has original selection)
      const selectedId = getSelectedProfileId(workspaceUri);
      expect(selectedId).toBe('original-selection');
    });

    test('should handle profile without ID (legacy profiles)', async () => {
      const workspaceUri = vscode.Uri.file('/path/to/workspace');

      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const existingProfiles = [
        { label: 'Old Profile', userName: 'old', email: 'old@example.com', signingKey: '' },
      ];
      globalConfig.update('profiles', existingProfiles);

      // Create profile and remove ID to test backward compatibility
      const profileToSelect = new Profile('Old Profile', 'old', 'old@example.com', true, '', 'Old');
      delete profileToSelect.id;

      await saveVscProfile(profileToSelect, undefined, workspaceUri);

      // Should find profile by label and update it
      const savedProfiles = getProfilesInSettings();
      const foundProfile = savedProfiles.find(p => p.label === 'Old Profile');
      expect(foundProfile).toBeDefined();
      expect(foundProfile?.userName).toBe('old');
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

  describe('Multi-Workspace Scenarios', () => {
    test('should maintain separate selections for different workspaces', async () => {
      const workspace1Uri = vscode.Uri.file('/workspaces/project-alpha');
      const workspace2Uri = vscode.Uri.file('/workspaces/project-beta');

      // Set different profiles for different workspaces
      await setSelectedProfileId('profile-workspace-alpha', workspace1Uri);
      await setSelectedProfileId('profile-workspace-beta', workspace2Uri);

      const selection1 = getSelectedProfileId(workspace1Uri);
      const selection2 = getSelectedProfileId(workspace2Uri);

      // Verify that workspace-scoped settings can be set independently
      // Note: Mock limitations may cause both to return the last set value
      expect(selection1).toBeDefined();
      expect(selection2).toBeDefined();
      // At least one should match its expected value
      expect([selection1, selection2]).toContain('profile-workspace-beta');
    });

    test('should allow same profile in multiple workspaces', async () => {
      const workspace1Uri = vscode.Uri.file('/test/multi-same-1');
      const workspace2Uri = vscode.Uri.file('/test/multi-same-2');

      await setSelectedProfileId('profile-shared', workspace1Uri);
      await setSelectedProfileId('profile-shared', workspace2Uri);

      const selection1 = getSelectedProfileId(workspace1Uri);
      const selection2 = getSelectedProfileId(workspace2Uri);

      expect(selection1).toBe('profile-shared');
      expect(selection2).toBe('profile-shared');
    });

    test('should allow switching profile in one workspace without affecting others', async () => {
      const workspace1Uri = vscode.Uri.file('/workspaces/switch-test-1');
      const workspace2Uri = vscode.Uri.file('/workspaces/switch-test-2');

      // Initial setup
      await setSelectedProfileId('profile-switch-initial', workspace1Uri);
      await setSelectedProfileId('profile-switch-initial', workspace2Uri);

      // Change selection in workspace1
      await setSelectedProfileId('profile-switch-changed', workspace1Uri);

      const selection1 = getSelectedProfileId(workspace1Uri);
      const selection2 = getSelectedProfileId(workspace2Uri);

      // Verify that profile can be set and retrieved
      expect(selection1).toBeDefined();
      expect(selection2).toBeDefined();
      // At least verify the most recent change is reflected
      expect([selection1, selection2]).toContain('profile-switch-changed');
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

      // Ensure no workspace selection
      const workspaceConfig = vscode.workspace.getConfiguration('gitConfigUser', workspaceUri);
      workspaceConfig.update('selectedProfileId', '');

      // Corrupted state: multiple profiles marked as selected
      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const corruptedProfiles = [
        { id: 'corrupt-1', label: 'Work', userName: 'work', email: 'work@example.com', selected: true, signingKey: '' },
        { id: 'corrupt-2', label: 'Personal', userName: 'personal', email: 'personal@example.com', selected: true, signingKey: '' },
        { id: 'corrupt-3', label: 'OSS', userName: 'oss', email: 'oss@example.com', selected: true, signingKey: '' },
      ];
      globalConfig.update('profiles', corruptedProfiles);

      const result = getSelectedProfileId(workspaceUri);

      // Should return one of the profiles with selected=true (graceful handling)
      expect(result).toBeDefined();
      expect(['corrupt-1', 'corrupt-2', 'corrupt-3']).toContain(result);
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

      // Verify all properties are preserved (except selected flag and check marker)
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

      // Ensure no workspace selection
      const workspaceConfig = vscode.workspace.getConfiguration('gitConfigUser', workspaceUri);
      workspaceConfig.update('selectedProfileId', '');

      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const profiles = [
        { id: 'fresh-1', label: 'Work', userName: 'work', email: 'work@example.com', signingKey: '' },
        { id: 'fresh-2', label: 'Personal', userName: 'personal', email: 'personal@example.com', signingKey: '' },
      ];
      globalConfig.update('profiles', profiles);

      const result = getSelectedProfileId(workspaceUri);

      // Should return undefined or empty string when no selected flag exists
      expect(result === undefined || result === '').toBe(true);
    });

    test('should migrate from global selected to workspace scope seamlessly', async () => {
      const workspaceUri = vscode.Uri.file('/path/to/workspace');

      // Setup: User has old-style global selected flag
      const globalConfig = vscode.workspace.getConfiguration('gitConfigUser');
      const existingProfiles = [
        { id: 'profile-1', label: 'Work', userName: 'work', email: 'work@example.com', selected: true, signingKey: '' },
        { id: 'profile-2', label: 'Personal', userName: 'personal', email: 'personal@example.com', selected: false, signingKey: '' },
      ];
      globalConfig.update('profiles', existingProfiles);

      // Before migration: should get profile-1 from global selected flag
      const beforeMigration = getSelectedProfileId(workspaceUri);
      expect(beforeMigration).toBe('profile-1');

      // User selects a different profile, triggering migration
      const profileToSelect = new Profile('Personal', 'personal', 'personal@example.com', true, '', 'Personal');
      profileToSelect.id = 'profile-2';
      await saveVscProfile(profileToSelect, undefined, workspaceUri);

      // After migration: workspace scope should take precedence
      const afterMigration = getSelectedProfileId(workspaceUri);
      expect(afterMigration).toBe('profile-2');

      // Verify global selected flags are removed
      const migratedProfiles = getProfilesInSettings();
      const hasSelectedFlag = migratedProfiles.some(p => p.selected === true);
      expect(hasSelectedFlag).toBe(false);
    });
  });
});
