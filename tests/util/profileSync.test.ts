import { Profile } from "../../src/models";
import { isProfileInSyncWithRepo, syncCheckNeedsGlobalGitConfig, SyncGitConfig } from "../../src/util/utils";

function createProfile(overrides: Partial<Profile>): Profile {
  return Object.assign(new Profile("GitHub", "Test User", "test@example.com", false, ""), overrides);
}

const baseGitConfig: SyncGitConfig = {
  userName: "Test User",
  email: "test@example.com",
  signingKey: "",
};

describe("isProfileInSyncWithRepo", () => {
  test("in sync when profile values match the local git config exactly", () => {
    const profile = createProfile({ signingKey: "key-1", commitGpgSign: true, gpgFormat: "ssh" });
    const gitConfig: SyncGitConfig = { ...baseGitConfig, signingKey: "key-1", commitGpgSign: true, gpgFormat: "ssh" };

    expect(isProfileInSyncWithRepo(gitConfig, profile).result).toBe(true);
  });

  test("out of sync when user name differs", () => {
    const profile = createProfile({ userName: "Other User" });

    const result = isProfileInSyncWithRepo(baseGitConfig, profile);

    expect(result.result).toBe(false);
    expect(result.message).toContain("User names");
  });

  test("email comparison is case-insensitive, mismatch is out of sync", () => {
    const profile = createProfile({ email: "TEST@example.com" });
    expect(isProfileInSyncWithRepo(baseGitConfig, profile).result).toBe(true);

    const mismatch = createProfile({ email: "other@example.com" });
    expect(isProfileInSyncWithRepo(baseGitConfig, mismatch).result).toBe(false);
  });

  describe("signing key", () => {
    test("in sync when profile has no key and local value equals the global key", () => {
      const profile = createProfile({});
      const gitConfig: SyncGitConfig = { ...baseGitConfig, signingKey: "ssh-ed25519 AAAA" };
      const globalGitConfig = { signingKey: "ssh-ed25519 AAAA" };

      expect(isProfileInSyncWithRepo(gitConfig, profile, globalGitConfig).result).toBe(true);
    });

    test("in sync when profile has no key and no local key is set", () => {
      const profile = createProfile({});

      expect(isProfileInSyncWithRepo(baseGitConfig, profile).result).toBe(true);
    });

    test("out of sync when profile has no key and local key differs from the global key", () => {
      const profile = createProfile({});
      const gitConfig: SyncGitConfig = { ...baseGitConfig, signingKey: "ssh-ed25519 LOCAL" };
      const globalGitConfig = { signingKey: "ssh-ed25519 GLOBAL" };

      expect(isProfileInSyncWithRepo(gitConfig, profile, globalGitConfig).result).toBe(false);
    });

    test("strict comparison when profile prescribes a key", () => {
      const profile = createProfile({ signingKey: "key-1" });

      expect(isProfileInSyncWithRepo({ ...baseGitConfig, signingKey: "key-1" }, profile).result).toBe(true);
      expect(isProfileInSyncWithRepo({ ...baseGitConfig, signingKey: "key-2" }, profile).result).toBe(false);
      expect(isProfileInSyncWithRepo(baseGitConfig, profile).result).toBe(false);
    });
  });

  describe("commit signing", () => {
    test("in sync when profile leaves it unset and local value equals the global setting", () => {
      const profile = createProfile({});
      const gitConfig: SyncGitConfig = { ...baseGitConfig, commitGpgSign: true };

      expect(isProfileInSyncWithRepo(gitConfig, profile, { commitGpgSign: true }).result).toBe(true);
    });

    test("out of sync when profile leaves it unset and local value differs from the global setting", () => {
      const profile = createProfile({});
      const gitConfig: SyncGitConfig = { ...baseGitConfig, commitGpgSign: false };

      expect(isProfileInSyncWithRepo(gitConfig, profile, { commitGpgSign: true }).result).toBe(false);
    });

    test("out of sync when profile leaves it unset, local signing is enabled, and global signing is not set", () => {
      const profile = createProfile({});
      const gitConfig: SyncGitConfig = { ...baseGitConfig, commitGpgSign: true };

      expect(isProfileInSyncWithRepo(gitConfig, profile, {}).result).toBe(false);
    });

    test("strict comparison when profile prescribes signing on or off", () => {
      const signProfile = createProfile({ commitGpgSign: true });
      expect(isProfileInSyncWithRepo({ ...baseGitConfig, commitGpgSign: true }, signProfile).result).toBe(true);
      expect(isProfileInSyncWithRepo(baseGitConfig, signProfile).result).toBe(false);

      const dontSignProfile = createProfile({ commitGpgSign: false });
      expect(isProfileInSyncWithRepo({ ...baseGitConfig, commitGpgSign: false }, dontSignProfile).result).toBe(true);
      expect(isProfileInSyncWithRepo({ ...baseGitConfig, commitGpgSign: true }, dontSignProfile).result).toBe(false);
    });
  });

  describe("gpg format", () => {
    test("in sync when profile leaves it unset and local format equals the global format", () => {
      const profile = createProfile({});
      const gitConfig: SyncGitConfig = { ...baseGitConfig, gpgFormat: "ssh" };

      expect(isProfileInSyncWithRepo(gitConfig, profile, { gpgFormat: "ssh" }).result).toBe(true);
    });

    test("out of sync when profile leaves it unset and local format differs from the global format", () => {
      const profile = createProfile({});
      const gitConfig: SyncGitConfig = { ...baseGitConfig, gpgFormat: "openpgp" };

      expect(isProfileInSyncWithRepo(gitConfig, profile, { gpgFormat: "ssh" }).result).toBe(false);
    });

    test("strict comparison when profile prescribes a format", () => {
      const profile = createProfile({ gpgFormat: "ssh" });

      expect(isProfileInSyncWithRepo({ ...baseGitConfig, gpgFormat: "ssh" }, profile).result).toBe(true);
      expect(isProfileInSyncWithRepo({ ...baseGitConfig, gpgFormat: "openpgp" }, profile).result).toBe(false);
      expect(isProfileInSyncWithRepo(baseGitConfig, profile).result).toBe(false);
    });
  });
});

describe("syncCheckNeedsGlobalGitConfig", () => {
  test("false when the profile prescribes explicit values for all settings", () => {
    const profile = createProfile({ signingKey: "key-1", commitGpgSign: true, gpgFormat: "ssh" });
    const gitConfig: SyncGitConfig = { ...baseGitConfig, signingKey: "other", commitGpgSign: false, gpgFormat: "openpgp" };

    expect(syncCheckNeedsGlobalGitConfig(gitConfig, profile)).toBe(false);
  });

  test("false when the repo has no local values for unset profile settings", () => {
    const profile = createProfile({});

    expect(syncCheckNeedsGlobalGitConfig(baseGitConfig, profile)).toBe(false);
  });

  test.each([
    ["signing key", { signingKey: "ssh-ed25519 AAAA" }, {}],
    ["commit signing", { commitGpgSign: true }, {}],
    ["gpg format", { gpgFormat: "ssh" }, {}],
  ])("true when the profile leaves the %s unset and the repo has a local value", (_name, gitConfigOverrides, profileOverrides) => {
    const profile = createProfile(profileOverrides);
    const gitConfig: SyncGitConfig = { ...baseGitConfig, ...gitConfigOverrides };

    expect(syncCheckNeedsGlobalGitConfig(gitConfig, profile)).toBe(true);
  });

  test("false when the profile prescribes a value even if the repo has a local value", () => {
    const profile = createProfile({ signingKey: "key-1", commitGpgSign: true, gpgFormat: "ssh" });
    const gitConfig: SyncGitConfig = { ...baseGitConfig, signingKey: "key", commitGpgSign: false, gpgFormat: "openpgp" };

    expect(syncCheckNeedsGlobalGitConfig(gitConfig, profile)).toBe(false);
  });
});
