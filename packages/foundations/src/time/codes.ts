// Design: lld/04 §2.4 (BAD_TIME_LITERAL, VALUE_OUT_OF_RANGE: the codes the time functions return)
// Every code listed here must be asserted by a test, or `npm run check` fails.
export const TIME_CODES = ["BAD_TIME_LITERAL", "VALUE_OUT_OF_RANGE"] as const;
