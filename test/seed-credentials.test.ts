import { readFileSync } from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyPasswordHash } from "../src/lib/auth/password";
import { TEST_SEED_PASSWORD } from "./fixtures/seed-password";

const root = path.resolve(__dirname, "..");
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

async function freshStoreModule() {
  vi.resetModules();
  return import("../src/lib/auth/credential-store");
}

describe("seed credentials are never committed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("seeded dev accounts use SUPPORTV8_DEV_SEED_PASSWORD outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SUPPORTV8_DEV_SEED_PASSWORD", TEST_SEED_PASSWORD);
    const { INITIAL_USER_CREDENTIALS } = await freshStoreModule();
    for (const user of INITIAL_USER_CREDENTIALS) {
      expect(verifyPasswordHash(TEST_SEED_PASSWORD, user.passwordHash)).toBe(true);
    }
  });

  it("production ignores SUPPORTV8_DEV_SEED_PASSWORD", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPPORTV8_DEV_SEED_PASSWORD", TEST_SEED_PASSWORD);
    const { INITIAL_USER_CREDENTIALS } = await freshStoreModule();
    for (const user of INITIAL_USER_CREDENTIALS) {
      expect(verifyPasswordHash(TEST_SEED_PASSWORD, user.passwordHash)).toBe(false);
    }
  });

  it("without a configured password the seeds get an unknowable one", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SUPPORTV8_DEV_SEED_PASSWORD", "");
    const { INITIAL_USER_CREDENTIALS } = await freshStoreModule();
    expect(verifyPasswordHash(TEST_SEED_PASSWORD, INITIAL_USER_CREDENTIALS[0].passwordHash)).toBe(false);
    expect(verifyPasswordHash("", INITIAL_USER_CREDENTIALS[0].passwordHash)).toBe(false);
  });

  it("the QA preset accounts are gone", async () => {
    const mod = await freshStoreModule();
    expect("QA_PRESET_CREDENTIALS" in mod).toBe(false);
    const store = new mod.UserCredentialStore();
    for (const tenant of ["lexi-s-planthouse", "winnie-shoes-demo", "windowsdemo"]) {
      expect(store.listUsers(tenant)).toHaveLength(0);
    }
  });

  it("no password literal or default remains in the credential store or bootstrap scripts", () => {
    const store = source("src/lib/auth/credential-store.ts");
    expect(store).not.toMatch(/hashPassword\("/);
    expect(store).not.toMatch(/SupportV8#/);

    const shell = source("deploy/keycloak/bootstrap-keycloak-supportv8.sh");
    expect(shell).not.toMatch(/SupportV8#|--new-password/);
    expect(shell).not.toMatch(/KEYCLOAK_ADMIN_PASSWORD:-/);
    expect(shell).toMatch(/SUPPORTV8_SEED_USERS_FILE:\?/);

    const rest = source("scripts/bootstrap-keycloak-rest.ts");
    expect(rest).not.toMatch(/SupportV8#|defaultPassword/);
    expect(rest).toMatch(/SUPPORTV8_SEED_USERS_FILE/);
    expect(rest).not.toMatch(/Password set: \$\{seedPasswords/);
  });
});
