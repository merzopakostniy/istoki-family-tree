import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CANVAS_SCALE,
  MIN_CANVAS_SCALE,
  clampCanvasScale,
  pinchCanvasScale,
  wheelCanvasScale,
} from "../src/canvas.js";

test("canvas scale is kept inside the supported range", () => {
  assert.equal(clampCanvasScale(0), MIN_CANVAS_SCALE);
  assert.equal(clampCanvasScale(10), MAX_CANVAS_SCALE);
  assert.equal(clampCanvasScale(0.7344), 0.734);
});

test("mouse wheel zooms the canvas in both directions", () => {
  assert.ok(wheelCanvasScale(1, -100) > 1);
  assert.ok(wheelCanvasScale(1, 100) < 1);
});

test("pinch scale follows the distance between fingers", () => {
  assert.equal(pinchCanvasScale(0.5, 100, 200), 1);
  assert.equal(pinchCanvasScale(1, 200, 100), 0.5);
  assert.equal(pinchCanvasScale(1, 0, 200), 1);
});
