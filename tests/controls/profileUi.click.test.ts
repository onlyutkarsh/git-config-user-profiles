import * as vm from "vm";
import * as vscode from "vscode";
import { getProfileFormHtml } from "../../src/controls/profileUi";
import { Profile } from "../../src/models";

type MockElement = {
  dataset: Record<string, string>;
  classList: { add: jest.Mock; remove: jest.Mock; contains: jest.Mock };
  addEventListener: jest.Mock;
  setAttribute: jest.Mock;
  querySelector: jest.Mock;
  querySelectorAll: jest.Mock;
  reset: jest.Mock;
  elements: Record<string, MockElement>;
  value: string;
  disabled: boolean;
  hidden: boolean;
  textContent: string;
  innerHTML: string;
  style: Record<string, string>;
  nextElementSibling?: MockElement;
  previousElementSibling?: MockElement;
};

function createClassList() {
  const values = new Set<string>();
  return {
    add: jest.fn((name: string) => values.add(name)),
    remove: jest.fn((name: string) => values.delete(name)),
    contains: jest.fn((name: string) => values.has(name)),
  };
}

function createElement(): MockElement {
  return {
    dataset: {},
    classList: createClassList(),
    addEventListener: jest.fn(),
    setAttribute: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    reset: jest.fn(),
    elements: {},
    value: "",
    disabled: false,
    hidden: false,
    textContent: "",
    innerHTML: "",
    style: {},
  };
}

describe("profile UI click behavior", () => {
  test("uses extension-side validation by disabling native form validation", () => {
    const profiles = [{ id: "github-id", label: "GitHub", userName: "UTK", email: "gh@example.com", signingKey: "" }] as Profile[];
    const html = getProfileFormHtml({ cspSource: "vscode-webview" } as vscode.Webview, profiles[0], profiles, "", "github-id", { "/repos/gh-1": "github-id" });

    expect(html).toContain('<form id="profile-form" novalidate>');
  });

  test("renders validation errors under each text field", () => {
    const profile = { id: "github-id", label: "GitHub", userName: "UTK", email: "gh@example.com", signingKey: "" } as Profile;
    const html = getProfileFormHtml({ cspSource: "vscode-webview" } as vscode.Webview, profile, [profile], "", "github-id", { "/repos/gh-1": "github-id" });
    const script = html.match(/<script nonce="[^"]+">([\s\S]*)<\/script>/)?.[1];
    expect(script).toBeDefined();

    const form = createElement();
    ["label", "userName", "email", "signingKey", "gpgFormat", "signingKeySource", "commitGpgSignMode"].forEach((name) => {
      form.elements[name] = createElement();
    });
    const profileNameHelp = createElement();
    profileNameHelp.textContent = "";
    form.elements.label.nextElementSibling = profileNameHelp;
    const userNameHelp = createElement();
    userNameHelp.textContent = "";
    form.elements.userName.nextElementSibling = userNameHelp;
    const emailHelp = createElement();
    emailHelp.textContent = "";
    form.elements.email.nextElementSibling = emailHelp;

    const profileList = createElement();
    const workspaceList = createElement();
    const deleteButton = createElement();
    const genericElement = createElement();
    const postMessage = jest.fn();
    const windowMock = { addEventListener: jest.fn() };

    profileList.querySelectorAll.mockImplementation(() => []);
    workspaceList.querySelectorAll.mockImplementation(() => []);

    const document = {
      getElementById: (id: string) => {
        if (id === "profile-form") return form;
        if (id === "workspace-selection-list") return workspaceList;
        if (id === "workspace-summary") return genericElement;
        if (id === "delete-profile") return deleteButton;
        return genericElement;
      },
      querySelector: (selector: string) => (selector === ".profile-list" ? profileList : genericElement),
      querySelectorAll: () => [],
    };

    const context = vm.createContext({
      acquireVsCodeApi: () => ({ postMessage }),
      document,
      window: windowMock,
      FormData,
    });

    vm.runInContext(script!, context);

    const messageHandler = windowMock.addEventListener.mock.calls.find(([eventName]) => eventName === "message")?.[1];
    expect(messageHandler).toBeDefined();

    messageHandler!({
      data: {
        command: "validationErrors",
        errors: {
          label: "Profile with the same name 'GitHub' already exists!",
          email: "Invalid email format",
        },
      },
    });

    expect(profileNameHelp.textContent).toBe("Profile with the same name 'GitHub' already exists!");
    expect(profileNameHelp.classList.contains("field-error")).toBe(true);
    expect(userNameHelp.textContent).toBe("");
    expect(userNameHelp.classList.contains("field-error")).toBe(false);
    expect(emailHelp.textContent).toBe("Invalid email format");
    expect(emailHelp.classList.contains("field-error")).toBe(true);
    expect(form.elements.label.classList.contains("input-error")).toBe(true);
    expect(form.elements.email.classList.contains("input-error")).toBe(true);
    expect(form.elements.userName.classList.contains("input-error")).toBe(false);
  });

  test("updates Active badge when workspace selection changes via profilesChanged", () => {
    const profiles = [
      { id: "github-id", label: "GitHub", userName: "UTK", email: "gh@example.com", signingKey: "" },
      { id: "aqa-id", label: "AQA", userName: "UTK", email: "aqa@example.com", signingKey: "" },
    ] as Profile[];

    const html = getProfileFormHtml({ cspSource: "vscode-webview" } as vscode.Webview, profiles[0], profiles, "", "github-id", { "/repos/current": "github-id" });
    const script = html.match(/<script nonce="[^"]+">([\s\S]*)<\/script>/)?.[1];
    expect(script).toBeDefined();

    const form = createElement();
    ["label", "userName", "email", "signingKey", "gpgFormat", "signingKeySource", "commitGpgSignMode"].forEach((name) => {
      form.elements[name] = createElement();
    });
    form.elements.label.nextElementSibling = createElement();
    form.elements.userName.nextElementSibling = createElement();
    form.elements.email.nextElementSibling = createElement();

    const profileList = createElement();
    profileList.querySelectorAll.mockImplementation(() => []);
    const workspaceList = createElement();
    workspaceList.querySelectorAll.mockImplementation(() => []);
    const deleteButton = createElement();
    const genericElement = createElement();
    const windowMock = { addEventListener: jest.fn() };

    const document = {
      getElementById: (id: string) => {
        if (id === "profile-form") return form;
        if (id === "workspace-selection-list") return workspaceList;
        if (id === "workspace-summary") return genericElement;
        if (id === "delete-profile") return deleteButton;
        if (id === "new-profile") return createElement();
        return genericElement;
      },
      querySelector: (selector: string) => (selector === ".profile-list" ? profileList : genericElement),
      querySelectorAll: () => [],
    };

    const context = vm.createContext({
      acquireVsCodeApi: () => ({ postMessage: jest.fn() }),
      document,
      window: windowMock,
      FormData,
    });

    vm.runInContext(script!, context);

    const messageHandler = windowMock.addEventListener.mock.calls.find(([eventName]) => eventName === "message")?.[1];
    expect(messageHandler).toBeDefined();

    messageHandler!({
      data: {
        command: "profilesChanged",
        profiles,
        workspaceSelections: { "/repos/current": "aqa-id" },
        workspaceFolderPath: "/repos/current",
      },
    });

    expect(profileList.innerHTML).toContain("<strong>AQA</strong>");
    expect(profileList.innerHTML).toContain('selected-badge">ACTIVE</span>');
  });

  test("preserves initial profile identity for save payload without requiring a sidebar click", () => {
    class MockFormData {
      private readonly form: any;

      constructor(form: any) {
        this.form = form;
      }

      get(name: string) {
        return this.form.elements[name]?.value ?? null;
      }
    }

    const profile = { label: "Legacy Work", userName: "legacy", email: "legacy@example.com", signingKey: "" } as Profile;
    const html = getProfileFormHtml({ cspSource: "vscode-webview" } as vscode.Webview, profile, [profile], "", "", { "/repos/work": "legacy-id" });
    const script = html.match(/<script nonce="[^"]+">([\s\S]*)<\/script>/)?.[1];
    expect(script).toBeDefined();

    const form = createElement();
    ["label", "userName", "email", "signingKey", "gpgFormat", "signingKeySource", "commitGpgSignMode"].forEach((name) => {
      form.elements[name] = createElement();
    });
    form.elements.label.value = "Legacy Work";
    form.elements.userName.value = "legacy";
    form.elements.email.value = "legacy@example.com";
    form.elements.signingKey.value = "";
    form.elements.gpgFormat.value = "";
    form.elements.signingKeySource.value = "global";
    form.elements.commitGpgSignMode.value = "global";

    const profileList = createElement();
    profileList.querySelectorAll.mockImplementation((selector: string) => {
      if (selector === "[data-profile-index]" || selector === ".profile-item") {
        return [];
      }
      return [];
    });

    const workspaceList = createElement();
    workspaceList.querySelectorAll.mockImplementation(() => []);
    const deleteButton = createElement();
    const genericElement = createElement();
    const postMessage = jest.fn();

    const document = {
      getElementById: (id: string) => {
        if (id === "profile-form") return form;
        if (id === "workspace-selection-list") return workspaceList;
        if (id === "workspace-summary") return genericElement;
        if (id === "delete-profile") return deleteButton;
        return genericElement;
      },
      querySelector: (selector: string) => (selector === ".profile-list" ? profileList : genericElement),
      querySelectorAll: () => [],
    };

    const context = vm.createContext({
      acquireVsCodeApi: () => ({ postMessage }),
      document,
      window: { addEventListener: jest.fn() },
      FormData: MockFormData,
    });

    vm.runInContext(script!, context);

    expect(form.dataset.profileLabel).toBe("Legacy Work");

    const submitHandler = form.addEventListener.mock.calls.find(([eventName]) => eventName === "submit")?.[1];
    expect(submitHandler).toBeDefined();
    submitHandler({ preventDefault: jest.fn() });

    expect(postMessage).toHaveBeenCalledWith({
      command: "save",
      profile: expect.objectContaining({
        label: "Legacy Work",
        originalLabel: "Legacy Work",
      }),
    });
  });

  test("switches folder list to the clicked profile without requiring commitGpgSign checkbox", () => {
    const profiles = [
      { id: "github-id", label: "GitHub", userName: "UTK", email: "gh@example.com", signingKey: "" },
      { id: "aqa-id", label: "AQA", userName: "UTK", email: "aqa@example.com", signingKey: "" },
    ] as Profile[];

    const workspaceSelections = {
      "/repos/gh-1": "github-id",
      "/repos/gh-2": "github-id",
      "/repos/aqa-1": "aqa-id",
    };

    const html = getProfileFormHtml({ cspSource: "vscode-webview" } as vscode.Webview, profiles[0], profiles, "", "github-id", workspaceSelections);
    const script = html.match(/<script nonce="[^"]+">([\s\S]*)<\/script>/)?.[1];
    expect(script).toBeDefined();

    const form = createElement();
    ["label", "userName", "email", "signingKey", "gpgFormat", "signingKeySource", "commitGpgSignMode"].forEach((name) => {
      form.elements[name] = createElement();
    });

    const profileList = createElement();
    const workspaceList = createElement();
    const deleteButton = createElement();
    const genericElement = createElement();

    const profileItems = profiles.map((_, index) => {
      const item = createElement();
      item.dataset.profileIndex = String(index);
      return item;
    });

    profileList.querySelectorAll.mockImplementation((selector: string) => {
      if (selector === "[data-profile-index]" || selector === ".profile-item") {
        return profileItems;
      }
      return [];
    });

    profileList.querySelector.mockImplementation((selector: string) => profileItems.find((item) => selector.includes(item.dataset.profileIndex)));

    const document = {
      getElementById: (id: string) => {
        if (id === "profile-form") return form;
        if (id === "workspace-selection-list") return workspaceList;
        if (id === "workspace-summary") return genericElement;
        if (id === "delete-profile") return deleteButton;
        return genericElement;
      },
      querySelector: (selector: string) => (selector === ".profile-list" ? profileList : genericElement),
      querySelectorAll: () => [],
    };

    const context = vm.createContext({
      acquireVsCodeApi: () => ({ postMessage: jest.fn() }),
      document,
      window: { addEventListener: jest.fn() },
      FormData,
    });

    vm.runInContext(script!, context);

    expect(workspaceList.innerHTML).toContain("/repos/gh-1");
    expect(workspaceList.innerHTML).toContain("/repos/gh-2");
    expect(workspaceList.innerHTML).not.toContain("/repos/aqa-1");

    const clickHandler = profileItems[1].addEventListener.mock.calls.find(([eventName]) => eventName === "click")?.[1];
    expect(clickHandler).toBeDefined();
    expect(() => clickHandler()).not.toThrow();

    expect(workspaceList.innerHTML).toContain("/repos/aqa-1");
    expect(workspaceList.innerHTML).not.toContain("/repos/gh-1");
    expect(workspaceList.innerHTML).not.toContain("/repos/gh-2");
  });

  test("new profile button clears all form fields", () => {
    const profiles = [{ id: "github-id", label: "GitHub", userName: "UTK", email: "gh@example.com", signingKey: "KEY-1" }] as Profile[];
    const html = getProfileFormHtml({ cspSource: "vscode-webview" } as vscode.Webview, profiles[0], profiles, "", "github-id", { "/repos/gh-1": "github-id" });
    const script = html.match(/<script nonce="[^"]+">([\s\S]*)<\/script>/)?.[1];
    expect(script).toBeDefined();

    const form = createElement();
    ["label", "userName", "email", "signingKey", "gpgFormat", "signingKeySource", "commitGpgSignMode"].forEach((name) => {
      form.elements[name] = createElement();
    });
    form.elements.label.value = "GitHub";
    form.elements.userName.value = "UTK";
    form.elements.email.value = "gh@example.com";
    form.elements.signingKey.value = "KEY-1";
    form.elements.gpgFormat.value = "ssh";
    form.elements.signingKeySource.value = "custom";
    form.elements.commitGpgSignMode.value = "sign";

    const profileList = createElement();
    const workspaceList = createElement();
    const deleteButton = createElement();
    const newProfileButton = createElement();
    const genericElement = createElement();
    const profileItems = [createElement()];

    profileList.querySelectorAll.mockImplementation((selector: string) => {
      if (selector === "[data-profile-index]" || selector === ".profile-item") {
        return profileItems;
      }
      return [];
    });

    const headerTitle = createElement();
    const headerEyebrow = createElement();

    const document = {
      getElementById: (id: string) => {
        if (id === "profile-form") return form;
        if (id === "workspace-selection-list") return workspaceList;
        if (id === "workspace-summary") return genericElement;
        if (id === "delete-profile") return deleteButton;
        if (id === "new-profile") return newProfileButton;
        return genericElement;
      },
      querySelector: (selector: string) => {
        if (selector === ".profile-list") return profileList;
        if (selector === ".content-header h2") return headerTitle;
        if (selector === ".content-header .eyebrow") return headerEyebrow;
        return genericElement;
      },
      querySelectorAll: (selector: string) => (selector === ".profile-item" ? profileItems : []),
    };

    const context = vm.createContext({
      acquireVsCodeApi: () => ({ postMessage: jest.fn() }),
      document,
      window: { addEventListener: jest.fn() },
      FormData,
    });

    vm.runInContext(script!, context);

    const clickHandler = newProfileButton.addEventListener.mock.calls.find(([eventName]) => eventName === "click")?.[1];
    expect(clickHandler).toBeDefined();
    clickHandler();

    expect(form.elements.label.value).toBe("");
    expect(form.elements.userName.value).toBe("");
    expect(form.elements.email.value).toBe("");
    expect(form.elements.signingKey.value).toBe("");
    expect(form.elements.gpgFormat.value).toBe("");
    expect(form.elements.signingKeySource.value).toBe("global");
    expect(form.elements.commitGpgSignMode.value).toBe("global");
    expect(headerTitle.textContent).toBe("Create a profile");
    expect(headerEyebrow.textContent).toBe("New profile");
  });

  test("workspace folder remove uses Delete? and Cancel confirmation", () => {
    const profiles = [{ id: "github-id", label: "GitHub", userName: "UTK", email: "gh@example.com", signingKey: "" }] as Profile[];
    const html = getProfileFormHtml({ cspSource: "vscode-webview" } as vscode.Webview, profiles[0], profiles, "", "github-id", { "/repos/gh-1": "github-id" });
    const script = html.match(/<script nonce="[^"]+">([\s\S]*)<\/script>/)?.[1];
    expect(script).toBeDefined();

    const form = createElement();
    ["label", "userName", "email", "signingKey", "gpgFormat", "signingKeySource", "commitGpgSignMode"].forEach((name) => {
      form.elements[name] = createElement();
    });

    const profileList = createElement();
    const workspaceList = createElement();
    const deleteButton = createElement();
    const genericElement = createElement();

    const profileItems = [createElement()];
    profileList.querySelectorAll.mockImplementation((selector: string) => {
      if (selector === "[data-profile-index]" || selector === ".profile-item") {
        return profileItems;
      }
      return [];
    });

    const workspaceRemove = createElement();
    workspaceRemove.dataset.workspaceFolder = "/repos/gh-1";
    workspaceRemove.textContent = "×";
    const workspaceCancel = createElement();
    workspaceRemove.nextElementSibling = workspaceCancel;
    workspaceCancel.previousElementSibling = workspaceRemove;

    workspaceList.querySelectorAll.mockImplementation((selector: string) => {
      if (selector === "[data-workspace-folder]") {
        return [workspaceRemove];
      }
      if (selector === "[data-workspace-cancel]") {
        return [workspaceCancel];
      }
      return [];
    });

    const postMessage = jest.fn();
    const document = {
      getElementById: (id: string) => {
        if (id === "profile-form") return form;
        if (id === "workspace-selection-list") return workspaceList;
        if (id === "workspace-summary") return genericElement;
        if (id === "delete-profile") return deleteButton;
        return genericElement;
      },
      querySelector: (selector: string) => (selector === ".profile-list" ? profileList : genericElement),
      querySelectorAll: () => [],
    };

    const context = vm.createContext({
      acquireVsCodeApi: () => ({ postMessage }),
      document,
      window: { addEventListener: jest.fn() },
      FormData,
    });

    vm.runInContext(script!, context);

    const removeHandler = workspaceRemove.addEventListener.mock.calls.find(([eventName]) => eventName === "click")?.[1];
    const cancelHandler = workspaceCancel.addEventListener.mock.calls.find(([eventName]) => eventName === "click")?.[1];
    expect(removeHandler).toBeDefined();
    expect(cancelHandler).toBeDefined();

    removeHandler({ stopPropagation: jest.fn() });
    expect(workspaceRemove.classList.contains("confirming")).toBe(true);
    expect(workspaceRemove.textContent).toBe("Delete?");
    expect(workspaceCancel.classList.contains("visible")).toBe(true);
    expect(postMessage).not.toHaveBeenCalledWith({ command: "removeWorkspaceSelection", folder: "/repos/gh-1" });

    cancelHandler({ stopPropagation: jest.fn() });
    expect(workspaceRemove.classList.contains("confirming")).toBe(false);
    expect(workspaceRemove.textContent).toBe("×");
    expect(workspaceCancel.classList.contains("visible")).toBe(false);

    removeHandler({ stopPropagation: jest.fn() });
    removeHandler({ stopPropagation: jest.fn() });
    expect(postMessage).toHaveBeenCalledWith({ command: "removeWorkspaceSelection", folder: "/repos/gh-1" });
  });
});
