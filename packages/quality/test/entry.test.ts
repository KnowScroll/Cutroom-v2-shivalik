import assert from "node:assert/strict";
import { test } from "node:test";
import * as entry from "../src/index.js";

test("the entry point loads and exports its code list", () => {
  assert.ok(Array.isArray(entry.CODES));
});
