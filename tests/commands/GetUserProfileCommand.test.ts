import * as vscode from 'vscode';
import { GetUserProfileCommand } from '../../src/commands/GetUserProfileCommand';
import * as gm from '../../src/util/gitManager';
import { ProfileStatusBar } from '../../src/controls/profileStatusBar';
import { StatusBarStatus } from '../../src/controls/profileStatusBar';
import { Messages } from '../../src/constants';

// Mock vscode via moduleNameMapper
jest.mock('../../src/util/logger', () => ({
  Logger: {
    instance: {
      logTrace: jest.fn(),
      logDebug: jest.fn(),
      logInfo: jest.fn(),
      logWarning: jest.fn(),
      logError: jest.fn(),
    },
  },
}));

jest.mock('../../src/util/gitManager', () => ({
  ...jest.requireActual('../../src/util/gitManager'),
  getWorkspaceStatus: jest.fn(),
  WorkspaceStatus: {
    ConfigOutofSync: 0,
    FieldsMissing: 1,
    NoProfilesInConfig: 2,
    NoSelectedProfilesInConfig: 3,
    NotAValidWorkspace: 4,
    NoIssues: 5,
  },
}));

// Mock ProfileStatusBar singleton
jest.mock('../../src/controls/profileStatusBar', () => {
  return {
    StatusBarStatus: { Normal: 'Normal', Warning: 'Warning' },
    ProfileStatusBar: {
      instance: {
        updateStatus: jest.fn(),
        hide: jest.fn(),
        attachCommand: jest.fn(),
        StatusBar: {},
      },
    },
  };
});

// Resolved after mock is registered
const mockUpdateStatus = () => (ProfileStatusBar.instance.updateStatus as jest.Mock);
const mockHide = () => (ProfileStatusBar.instance.hide as jest.Mock);

describe('GetUserProfileCommand - status bar visibility', () => {
  let command: GetUserProfileCommand;
  const mockGetWorkspaceStatus = gm.getWorkspaceStatus as jest.MockedFunction<typeof gm.getWorkspaceStatus>;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new GetUserProfileCommand();
  });

  describe('no active editor (e.g. VS Code just started, all tabs closed)', () => {
    test('should show status bar with friendly tooltip — not hide it (fixes #120)', async () => {
      mockGetWorkspaceStatus.mockResolvedValue({
        status: gm.WorkspaceStatus.NotAValidWorkspace,
        message: 'Open a file from a git repository',
        currentFolder: undefined,
      });

      await command.execute('extension activated');

      expect(mockHide()).not.toHaveBeenCalled();
      expect(mockUpdateStatus()).toHaveBeenCalledWith(
        undefined,
        undefined,
        StatusBarStatus.Normal,
        'Open a file from a git repository'
      );
    });

    test('should show status bar when no workspace folder message is returned', async () => {
      mockGetWorkspaceStatus.mockResolvedValue({
        status: gm.WorkspaceStatus.NotAValidWorkspace,
        message: 'No workspace folder found.',
        currentFolder: undefined,
      });

      await command.execute('extension activated');

      expect(mockHide()).not.toHaveBeenCalled();
      expect(mockUpdateStatus()).toHaveBeenCalledWith(
        undefined,
        undefined,
        StatusBarStatus.Normal,
        'No workspace folder found.'
      );
    });

    test('should show status bar when file is not part of a workspace folder', async () => {
      mockGetWorkspaceStatus.mockResolvedValue({
        status: gm.WorkspaceStatus.NotAValidWorkspace,
        message: 'This file is not part of a workspace folder.',
        currentFolder: undefined,
      });

      await command.execute('changed active editor');

      expect(mockHide()).not.toHaveBeenCalled();
      expect(mockUpdateStatus()).toHaveBeenCalledWith(
        undefined,
        undefined,
        StatusBarStatus.Normal,
        'This file is not part of a workspace folder.'
      );
    });
  });

  describe('confirmed not a git repository', () => {
    test('should hide status bar in git-repos-only mode', async () => {
      const config = vscode.workspace.getConfiguration('gitConfigUser');
      await config.update('statusBarVisibility', 'git-repos-only');

      mockGetWorkspaceStatus.mockResolvedValue({
        status: gm.WorkspaceStatus.NotAValidWorkspace,
        message: Messages.NOT_A_VALID_REPO,
        currentFolder: undefined,
      });

      await command.execute('changed active editor');

      expect(mockHide()).toHaveBeenCalled();
      expect(mockUpdateStatus()).not.toHaveBeenCalled();
    });

    test('should show status bar with tooltip in always mode', async () => {
      const config = vscode.workspace.getConfiguration('gitConfigUser');
      await config.update('statusBarVisibility', 'always');

      mockGetWorkspaceStatus.mockResolvedValue({
        status: gm.WorkspaceStatus.NotAValidWorkspace,
        message: Messages.NOT_A_VALID_REPO,
        currentFolder: undefined,
      });

      await command.execute('changed active editor');

      expect(mockHide()).not.toHaveBeenCalled();
      expect(mockUpdateStatus()).toHaveBeenCalledWith(
        undefined,
        undefined,
        StatusBarStatus.Normal,
        Messages.NOT_A_VALID_REPO
      );
    });
  });

  describe('non-file scheme (Output panel, Settings, etc.)', () => {
    test('should show status bar with friendly prompt when message is empty (non-file scheme)', async () => {
      // gitManager returns empty message for non-file schemes (Output panel, terminal, etc.)
      // Empty message is treated as "no active editor" and shows the friendly prompt
      // so the status bar remains visible rather than being hidden
      mockGetWorkspaceStatus.mockResolvedValue({
        status: gm.WorkspaceStatus.NotAValidWorkspace,
        message: '',
        currentFolder: undefined,
      });

      await command.execute('changed active editor');

      expect(mockHide()).not.toHaveBeenCalled();
      expect(mockUpdateStatus()).toHaveBeenCalledWith(
        undefined,
        undefined,
        StatusBarStatus.Normal,
        'Open a file from a git repository'
      );
    });
  });

  describe('valid git repo with profile', () => {
    test('should show status bar normally when config is in sync', async () => {
      const profile = { id: '1', label: 'Work', userName: 'Work User', email: 'work@example.com', signingKey: '' };

      mockGetWorkspaceStatus.mockResolvedValue({
        status: gm.WorkspaceStatus.NoIssues,
        message: '',
        currentFolder: '/repo/my-project',
        selectedProfile: profile,
        configInSync: true,
        currentGitConfig: { userName: 'Work User', email: 'work@example.com', signingKey: '' },
      });

      await command.execute('changed active editor');

      expect(mockHide()).not.toHaveBeenCalled();
      expect(mockUpdateStatus()).toHaveBeenCalledWith(
        profile,
        '/repo/my-project',
        StatusBarStatus.Normal,
        undefined,
        { userName: 'Work User', email: 'work@example.com', signingKey: '' }
      );
    });

    test('should show warning when config is out of sync', async () => {
      const profile = { id: '1', label: 'Work', userName: 'Work User', email: 'work@example.com', signingKey: '' };

      mockGetWorkspaceStatus.mockResolvedValue({
        status: gm.WorkspaceStatus.ConfigOutofSync,
        message: 'Git config is not in sync with the selected profile.',
        currentFolder: '/repo/my-project',
        selectedProfile: profile,
        configInSync: false,
        currentGitConfig: { userName: 'Other User', email: 'other@example.com', signingKey: '' },
      });

      await command.execute('changed active editor');

      expect(mockHide()).not.toHaveBeenCalled();
      expect(mockUpdateStatus()).toHaveBeenCalledWith(
        profile,
        '/repo/my-project',
        StatusBarStatus.Warning,
        undefined,
        { userName: 'Other User', email: 'other@example.com', signingKey: '' }
      );
    });
  });
});
