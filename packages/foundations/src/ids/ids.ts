// Design: lld/02 §2.1, §2.4; lld/04 §2.5 (ent_ + UUIDv7, handles; uuid's v7(), not crypto.randomUUIDv7)
import { v7 } from "uuid";

export type EntityId = string;
export type JobId = string;
export type AttemptId = string;

const UUID_V7 = "[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const ENTITY_ID = new RegExp(`^ent_${UUID_V7}$`);
const UUID_V7_RE = new RegExp(`^${UUID_V7}$`);
// Lowercase letters, digits, `_`, `.`, `-`; at most 64 characters (R1 §2.1).
const HANDLE = /^[a-z0-9_.-]{1,64}$/;

export function newEntityId(): EntityId {
  return `ent_${v7()}`;
}

export function newJobId(): JobId {
  return v7();
}

export function newAttemptId(): AttemptId {
  return v7();
}

export function isEntityId(s: unknown): s is EntityId {
  return typeof s === "string" && ENTITY_ID.test(s);
}

export function isUuidV7(s: unknown): s is string {
  return typeof s === "string" && UUID_V7_RE.test(s);
}

export function isHandle(s: unknown): s is string {
  return typeof s === "string" && HANDLE.test(s);
}
