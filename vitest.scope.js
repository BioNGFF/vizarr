import { configDefaults } from "vitest/config";

/** Where the suites that need a server we do not run are kept. */
const REMOTE = "**/tests/remote/**";

/**
 * Which tests a run includes.
 *
 * `pnpm test` runs only what works offline, so that a third-party server being slow or
 * down cannot fail a pull request that has nothing to do with it. `pnpm test:remote`
 * runs the suites that read real data from IDR and elsewhere; those are worth keeping,
 * but not on the critical path of every push.
 *
 * Shared by each package's config, since the split has to mean the same thing in all
 * of them for the two commands to be honest about what they ran.
 */
export function testScope() {
  const remote = process.env.VIZARR_TEST_REMOTE === "1";
  return {
    include: remote ? [`${REMOTE}/*.{test,spec}.?(c|m)[jt]s?(x)`] : [...configDefaults.include],
    exclude: remote ? [...configDefaults.exclude] : [...configDefaults.exclude, REMOTE],
    // Only a real network needs a timeout this long, and this branch's plate crawls
    // need all of it. Holding the offline suite to the default keeps a hang looking
    // like a hang.
    testTimeout: remote ? 60000 : 5000,
  };
}
