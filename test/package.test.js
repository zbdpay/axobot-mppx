import test from "node:test";
import assert from "node:assert/strict";

import {
  createZbdLightningAdapter,
} from "../dist/index.js";

test("exports zbd adapter factory", () => {
  assert.equal(typeof createZbdLightningAdapter, "function");
});
