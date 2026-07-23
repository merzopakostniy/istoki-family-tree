import assert from "node:assert/strict";
import test from "node:test";
import { formatLifespan } from "../src/formatters.js";

test("lifespan displays both dates as a range", () => {
  assert.equal(formatLifespan({ birth: "1942", death: "2018" }), "1942 — 2018");
});

test("lifespan preserves complete birth and death dates", () => {
  assert.equal(formatLifespan({ birth: "05.08.1986", death: "24.12.2020" }), "05.08.1986 — 24.12.2020");
});

test("lifespan labels a birth-only date", () => {
  assert.equal(formatLifespan({ birth: "1985", death: "" }), "рожд. 1985");
});

test("lifespan labels a death-only date", () => {
  assert.equal(formatLifespan({ birth: "", death: "1974" }), "ум. 1974");
});

test("lifespan handles missing dates", () => {
  assert.equal(formatLifespan({ birth: "", death: "" }), "Нет данных");
});
