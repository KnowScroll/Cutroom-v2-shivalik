// Design: lld/07 D12, lld/11 A:M0-4 (the CLI's codes: SPACE_IN_USE, SOCKET_PATH_TOO_LONG; testing §8 rule 4)
// Every code listed here must be asserted by a test, or `npm run check` fails.
export const CODES = ["SPACE_IN_USE", "SOCKET_PATH_TOO_LONG"] as const;
export type CliCode = (typeof CODES)[number];
