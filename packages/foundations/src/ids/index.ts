// Design: lld/02 §2.1 (ids module exports)
export {
  type AttemptId,
  type EntityId,
  isEntityId,
  isHandle,
  isUuidV7,
  type JobId,
  newAttemptId,
  newEntityId,
  newJobId,
} from "./ids.js";
