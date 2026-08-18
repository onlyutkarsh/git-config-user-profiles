import { validateProfileName } from "../../src/util";
import { Profile } from "../../src/models";

describe("validateProfileName", () => {
  test("blocks create when another profile already has the same name", () => {
    const profiles = [{ id: "work-id", label: "Work", userName: "work", email: "work@example.com", signingKey: "" } as Profile];

    const error = validateProfileName("work", true, undefined, profiles);

    expect(error).toContain("already exists");
  });

  test("allows editing when the name stays the same for the same profile id", () => {
    const profiles = [
      { id: "work-id", label: "Work", userName: "work", email: "work@example.com", signingKey: "" } as Profile,
      { id: "personal-id", label: "Personal", userName: "personal", email: "personal@example.com", signingKey: "" } as Profile,
    ];

    const error = validateProfileName("Work", true, { id: "work-id", label: "Work" }, profiles);

    expect(error).toBeUndefined();
  });

  test("blocks editing when renaming to another existing profile name", () => {
    const profiles = [
      { id: "work-id", label: "Work", userName: "work", email: "work@example.com", signingKey: "" } as Profile,
      { id: "personal-id", label: "Personal", userName: "personal", email: "personal@example.com", signingKey: "" } as Profile,
    ];

    const error = validateProfileName("Personal", true, { id: "work-id", label: "Work" }, profiles);

    expect(error).toContain("already exists");
  });

  test("allows unchanged legacy id-less profile name for backward compatibility", () => {
    const profiles = [
      { label: "Legacy Work", userName: "legacy", email: "legacy@example.com", signingKey: "" } as Profile,
      { id: "personal-id", label: "Personal", userName: "personal", email: "personal@example.com", signingKey: "" } as Profile,
    ];

    const error = validateProfileName("Legacy Work", true, { label: "Legacy Work" }, profiles);

    expect(error).toBeUndefined();
  });
});
