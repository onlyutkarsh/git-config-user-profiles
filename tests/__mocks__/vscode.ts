/**
 * Mock implementation of VSCode API for testing
 */

export const workspace = {
  getConfiguration: jest.fn((section?: string) => ({
    get: jest.fn((key: string, defaultValue?: any) => {
      // Return sensible defaults for known config keys
      if (key === 'logLevel') return 'error'; // Use error level to reduce noise in tests
      if (key === 'profiles') return [];
      if (key === 'selectMatchedProfileAutomatically') return false;
      return defaultValue;
    }),
    update: jest.fn(() => Promise.resolve()),
  })),
  workspaceFolders: [],
  onDidChangeConfiguration: jest.fn(),
  onDidChangeWorkspaceFolders: jest.fn(),
  getWorkspaceFolder: jest.fn(),
  createFileSystemWatcher: jest.fn(() => ({
    onDidChange: jest.fn(),
    onDidCreate: jest.fn(),
    onDidDelete: jest.fn(),
    dispose: jest.fn(),
  })),
};

export const window = {
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showQuickPick: jest.fn(),
  showInputBox: jest.fn(),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    append: jest.fn(),
    clear: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  })),
  activeTextEditor: undefined,
  onDidChangeActiveTextEditor: jest.fn(),
};

export const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn(),
};

export class Uri {
  static file(path: string) {
    return {
      fsPath: path,
      scheme: 'file',
      path,
      toString: () => path,
    };
  }

  static parse(value: string) {
    return {
      fsPath: value,
      scheme: 'file',
      path: value,
      toString: () => value,
    };
  }
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export const StatusBarItem = jest.fn();
