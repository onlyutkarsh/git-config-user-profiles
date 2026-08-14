import * as vscode from "vscode";
import * as constants from "../src/constants";

const showPlaceholder = jest.fn();

jest.mock("../src/controls", () => ({
  ProfileStatusBar: {
    instance: {
      showPlaceholder,
      attachCommand: jest.fn(),
      StatusBar: {},
    },
  },
}));

jest.mock("../src/util/logger", () => ({
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

import { activate } from "../src/extension";

describe("extension activation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);
  });

  test("resolves the profile after showing the loading placeholder", async () => {
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;

    await activate(context);

    expect(showPlaceholder).toHaveBeenCalledTimes(1);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(constants.CommandIds.GET_USER_PROFILE, "extension activated");
    expect(showPlaceholder.mock.invocationCallOrder[0]).toBeLessThan((vscode.commands.executeCommand as jest.Mock).mock.invocationCallOrder[0]);
  });
});
