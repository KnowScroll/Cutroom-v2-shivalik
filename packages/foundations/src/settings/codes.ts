// Design: lld/04 §2.7 (settings rule), lld/11 G15, G21, A:M0-3, B:O8a (the codes the settings registry returns)
// VALUE_OUT_OF_RANGE and FIELD_AUTHORITY are the design's codes. The SETTING_* codes are local to the
// registry (the design names none for registration refusals; see the work package's design doubts).
export const SETTINGS_CODES = [
  "VALUE_OUT_OF_RANGE",
  "FIELD_AUTHORITY",
  "SETTING_RECORD_INCOMPLETE",
  "SETTING_NAME_INVALID",
  "SETTING_DUPLICATE",
  "SETTING_NAME_PREFIX",
  "SETTING_UNKNOWN",
] as const;

export type SettingsCode = (typeof SETTINGS_CODES)[number];
