import * as assert from "assert";
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";

// import * as myExtension from '../../extension';

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("Sample 1", () => {
    assert.strictEqual([1, 2, 3].indexOf(1), 0);
  });
  test("Sample 2", () => {
    assert.strictEqual([1, 2, 3].indexOf(5), -1);
  });
});
