// Design: testing §8 rule 5; U32 (the known-failures registry)
// A test that is expected to fail for now is listed here, never skipped. Every test command consults this
// file (tools/run-tests.mjs): an unlisted failure fails the run, a listed test that fails for another
// reason fails the run, and a listed test that passes fails the run until its entry is removed.
// The pull request that makes a test pass removes its entry and closes its issue.

export interface KnownFailure {
  /** "<repo-relative path of the test file as built or run>::<test name>", nested names joined by " > ". */
  readonly test: string;
  /** Why it fails now. */
  readonly reason: string;
  /** The GitHub issue that tracks it. */
  readonly issue: number;
  /** The work package expected to make it pass. */
  readonly workPackage: string;
  /** A substring the failure's message or diagnostic code must contain, so only that failure is excused. */
  readonly matches: string;
}

export const knownFailures: readonly KnownFailure[] = [];
