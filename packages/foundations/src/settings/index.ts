// Design: lld/04 §2.7 (settings registry; the settings entry of the package)

export type { SettingsCode } from "./codes.js";
export { SETTINGS_CODES } from "./codes.js";
export { SettingsRegistry, settingPath } from "./registry.js";
export type {
  KeyedRange,
  KeySpec,
  NumberListRange,
  OverrideLevel,
  ScalarRange,
  ScalarType,
  ScalarValue,
  SettingRange,
  SettingRecord,
  SettingsLayer,
  SettingType,
  SettingValue,
  TextRange,
  WriterLevel,
} from "./types.js";
