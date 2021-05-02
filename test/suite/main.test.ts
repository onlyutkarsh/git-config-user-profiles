import * as assert from "assert";
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";

suite("Main", () => {
  test("Should start extension @assistant", async () => {
    const started = vscode.extensions.getExtension("onlyutkarsh.github-config-user-profiles");
    assert.notStrictEqual(started, undefined);
    assert.strictEqual(started?.isActive, true);
  });
});
