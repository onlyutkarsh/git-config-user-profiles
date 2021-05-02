import { assert } from "chai";
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";

suite("Main", () => {
  test("should extension be loaded on startup", async () => {
    const extension = vscode.extensions.getExtension("onlyutkarsh.git-config-user-profiles");
    if (!extension?.isActive) {
      await extension?.activate();
    }
    assert.isOk(extension);
    assert.isTrue(extension?.isActive);
  });
});
