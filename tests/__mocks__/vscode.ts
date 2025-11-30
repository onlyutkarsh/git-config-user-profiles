/**
 * Mock implementation of VSCode API for testing
 */

// Storage for mock configurations (scoped by section and resource)
let mockConfigurations = new Map<string, any>();

// Create a function to get config value that reads from the shared Map
const getMockConfigValue = (key: string, property: string, defaultValue?: any) => {
  const fullKey = `${key}.${property}`;
  if (mockConfigurations.has(fullKey)) {
    return mockConfigurations.get(fullKey);
  }
  // Return sensible defaults for known config keys
  if (property === 'logLevel') return 'error'; // Use error level to reduce noise in tests
  if (property === 'profiles') return [];
  if (property === 'selectMatchedProfileAutomatically') return false;
  if (property === 'selectedProfileId') return '';
  return defaultValue;
};

// Create a function to update config value that writes to the shared Map
const updateMockConfigValue = (key: string, property: string, value: any) => {
  const fullKey = `${key}.${property}`;
  mockConfigurations.set(fullKey, value);
  return Promise.resolve();
};

export const workspace = {
  getConfiguration: jest.fn((section?: string, resource?: any) => {
    // Use fsPath for stable keying instead of toString()
    const resourceKey = resource?.fsPath || resource?.path || 'global';
    const key = resource ? `${section}:${resourceKey}` : `${section}:global`;

    return {
      get: (property: string, defaultValue?: any) => {
        return getMockConfigValue(key, property, defaultValue);
      },
      update: (property: string, value: any, _target?: any) => {
        return updateMockConfigValue(key, property, value);
      },
    };
  }),
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
  // Helper to clear mock configuration storage (for test cleanup)
  _clearMockConfigurations: () => {
    mockConfigurations = new Map<string, any>();
  },
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

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export class ThemeColor {
  constructor(public id: string) {}
}

export class MarkdownString {
  public value: string = '';
  public isTrusted?: boolean;
  public supportHtml?: boolean;

  constructor(value?: string) {
    if (value) {
      this.value = value;
    }
  }

  appendMarkdown(value: string): MarkdownString {
    this.value += value;
    return this;
  }

  appendText(value: string): MarkdownString {
    this.value += value;
    return this;
  }
}

export const StatusBarItem = jest.fn();
