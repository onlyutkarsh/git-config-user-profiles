import * as vscode from "vscode";
import { showProfileForm } from "../../src/controls/profileUi";

jest.mock("../../src/util/gitManager", () => ({
  getGlobalGitConfig: jest.fn().mockResolvedValue({ signingKey: "", commitGpgSign: undefined, gpgFormat: undefined }),
}));

describe("showProfileForm save mapping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (vscode.workspace as any)._clearMockConfigurations();
  });

  test("saves profile values directly without modes", async () => {
    let messageHandler: ((message: any) => Promise<void>) | undefined;

    const webview = {
      html: "",
      postMessage: jest.fn(),
      onDidReceiveMessage: jest.fn((handler: (message: any) => Promise<void>) => {
        messageHandler = handler;
        return { dispose: jest.fn() };
      }),
      cspSource: "vscode-webview",
    };

    const panel = {
      webview,
      onDidDispose: jest.fn(() => ({ dispose: jest.fn() })),
      dispose: jest.fn(),
    };

    (vscode.window as any).createWebviewPanel = jest.fn(() => panel);
    (vscode as any).ViewColumn = { One: 1 };
    (vscode.workspace.onDidChangeConfiguration as jest.Mock).mockReturnValue({ dispose: jest.fn() });

    const onSave = jest.fn().mockResolvedValue(undefined);

    await showProfileForm(undefined, [], onSave);

    expect(messageHandler).toBeDefined();

    await messageHandler!({
      command: "save",
      profile: {
        label: "Work",
        userName: "utkarsh",
        email: "utkarsh@example.com",
        signingKey: "GLOBAL-KEY-123",
        commitGpgSign: true,
        gpgFormat: "ssh",
      },
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Work",
        signingKey: "GLOBAL-KEY-123",
        commitGpgSign: true,
        gpgFormat: "ssh",
      }),
      undefined
    );
  });

  test("normalizes empty signing values to inherit the global git config", async () => {
    let messageHandler: ((message: any) => Promise<void>) | undefined;

    const webview = {
      html: "",
      postMessage: jest.fn(),
      onDidReceiveMessage: jest.fn((handler: (message: any) => Promise<void>) => {
        messageHandler = handler;
        return { dispose: jest.fn() };
      }),
      cspSource: "vscode-webview",
    };

    const panel = {
      webview,
      onDidDispose: jest.fn(() => ({ dispose: jest.fn() })),
      dispose: jest.fn(),
    };

    (vscode.window as any).createWebviewPanel = jest.fn(() => panel);
    (vscode as any).ViewColumn = { One: 1 };
    (vscode.workspace.onDidChangeConfiguration as jest.Mock).mockReturnValue({ dispose: jest.fn() });

    const onSave = jest.fn().mockResolvedValue(undefined);

    await showProfileForm(undefined, [], onSave);

    expect(messageHandler).toBeDefined();

    await messageHandler!({
      command: "save",
      profile: {
        label: "Work",
        userName: "utkarsh",
        email: "utkarsh@example.com",
        signingKey: "   ",
        commitGpgSign: undefined,
        gpgFormat: "",
      },
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Work",
        signingKey: "",
        commitGpgSign: undefined,
        gpgFormat: undefined,
      }),
      undefined
    );
  });

  test("deletes a profile added after the webview was opened", async () => {
    let messageHandler: ((message: any) => Promise<void>) | undefined;

    const webview = {
      html: "",
      postMessage: jest.fn(),
      onDidReceiveMessage: jest.fn((handler: (message: any) => Promise<void>) => {
        messageHandler = handler;
        return { dispose: jest.fn() };
      }),
      cspSource: "vscode-webview",
    };

    const panel = {
      webview,
      onDidDispose: jest.fn(() => ({ dispose: jest.fn() })),
      dispose: jest.fn(),
    };

    (vscode.window as any).createWebviewPanel = jest.fn(() => panel);
    (vscode as any).ViewColumn = { One: 1 };
    (vscode.workspace.onDidChangeConfiguration as jest.Mock).mockReturnValue({ dispose: jest.fn() });

    const initialProfile = { id: "work-id", label: "Work", userName: "utkarsh", email: "work@example.com", signingKey: "" };
    const addedProfile = { id: "personal-id", label: "Personal", userName: "utkarsh", email: "personal@example.com", signingKey: "" };
    await vscode.workspace.getConfiguration("gitConfigUser").update("profiles", [initialProfile, addedProfile], vscode.ConfigurationTarget.Global);

    const onDelete = jest.fn().mockResolvedValue(undefined);

    await showProfileForm(initialProfile, [initialProfile], jest.fn(), onDelete);

    expect(messageHandler).toBeDefined();

    await messageHandler!({
      command: "delete",
      id: "personal-id",
      label: "Personal",
    });

    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "personal-id", label: "Personal" }));
  });
});
