import { validateEmail, validateProfileName, validateUserName } from "../../src/util";
import { Profile } from "../../src/models";

describe("validator normalization", () => {
  test("validateProfileName trims input before duplicate check", () => {
    const profiles = [{ id: "work-id", label: "Work", userName: "work", email: "work@example.com", signingKey: "" } as Profile];

    const error = validateProfileName("  Work  ", true, undefined, profiles);

    expect(error).toContain("already exists");
    expect(error).toContain("'Work'");
  });

  test("validateProfileName rejects icon-only label after sanitization", () => {
    const error = validateProfileName(" $(check) ");

    expect(error).toBeDefined();
  });

  test("validateUserName trims before required validation", () => {
    expect(validateUserName("   ")).toBeDefined();
    expect(validateUserName("  utkarsh  ")).toBeUndefined();
  });

  test("validateEmail trims before format validation", () => {
    expect(validateEmail("  user+tag@example.com  ")).toBeUndefined();
    expect(validateEmail("   ")).toBeDefined();
  });
});