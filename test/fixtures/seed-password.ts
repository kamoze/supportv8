// Test-only password for the seeded development accounts in credential-store.ts.
// test/seed-password.setup.ts exports it as SUPPORTV8_DEV_SEED_PASSWORD before
// any test module loads. It is not, and must never be, a real credential.
export const TEST_SEED_PASSWORD = "test-only-seed-password-not-a-credential";
