import { Profile } from "../../src/models/Profile";

describe("Profile", () => {
  test("creates a unique UUID v4 id for each profile", () => {
    const firstProfile = new Profile("First", "first", "first@example.com", false, "");
    const secondProfile = new Profile("Second", "second", "second@example.com", false, "");
    const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(firstProfile.id).toMatch(uuidV4Pattern);
    expect(secondProfile.id).toMatch(uuidV4Pattern);
    expect(firstProfile.id).not.toBe(secondProfile.id);
  });
});
