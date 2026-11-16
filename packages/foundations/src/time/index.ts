// Design: lld/02 §1 (time module exports)
export { TIME_CODES } from "./codes.js";
export {
  audioSamples,
  ceilDiv,
  divmod,
  type FilmFrames,
  FLICKS_PER_MS,
  FLICKS_PER_SECOND,
  filmFrames,
  flicksPerPeriod,
  flicksToSamples,
  formatTime,
  frameStart,
  isFlickExactRate,
  mediaTicksToFlicks,
  msToFlicks,
  parseTime,
  presentedFrame,
  type Rational,
  roundHalfUp,
} from "./flicks.js";
