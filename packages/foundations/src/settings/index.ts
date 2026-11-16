// Design: lld/04 §2.7 (settings registry; the settings entry of the package)

export type { SettingsCode } from "./codes.js";
export { SETTINGS_CODES } from "./codes.js";
export { SettingsRegistry, settingPath } from "./registry.js";
export type {
  KeyedRange,
  KeySpec,
  OverrideLevel,
  ScalarRange,
  ScalarType,
  ScalarValue,
  SettingRange,
  SettingRecord,
  SettingsDiagnostic,
  SettingsLayer,
  SettingsResult,
  SettingType,
  SettingValue,
  WriterLevel,
} from "./types.js";
