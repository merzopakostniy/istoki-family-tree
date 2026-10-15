import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConnections,
  createRouter,
  intersectsCard,
} from "../src/routing.js";
import { buildFamilyLayout, CARD_WIDTH, CARD_HEIGHT } from "../src/layout.js";
const rect = (x, y) => ({ left: x, right: x + 208, top: y, bottom: y + 264 });
const person = (id, parents = [], partnerIds = [], extra = {}) => ({
  id,
  name: id,
  generation: 0,
  parents,
  partnerIds,
  formerPartnerIds: [],
  ...extra,
});
function verify(result, bounds) {
  const lines = [
    ...result.marriages,
    ...result.paths.flatMap((p) => p.segments),
  ];
  assert.ok(lines.length);
  for (const line of lines) {
    assert.ok(line.points.length >= 2);
    for (let i = 1; i < line.points.length; i++) {
      const a = line.points[i - 1],
        b = line.points[i];
      assert.ok(a.x === b.x || a.y === b.y, "each segment must be orthogonal");
      for (const [id, r] of bounds)
        assert.equal(
          intersectsCard(a, b, r),
          false,
          `${line.id} crosses ${id}`,
        );
    }
  }
}
test("adjacent parents share a bridge in the spouse gap and route to children", () => {
  const people = [
    person("a", [], ["b"]),
    person("b", [], ["a"]),
    person("c", ["a", "b"]),
  ];
  const bounds = new Map([
    ["a", rect(0, 0)],
    ["b", rect(256, 0)],
    ["c", rect(128, 400)],
  ]);
  const result = buildConnections(people, bounds);
  verify(result, bounds);
  assert.equal(result.marriages.length, 1);
  assert.equal(result.paths[0].segments.length, 3);
  assert.ok(
    result.paths[0].segments.at(-1).points[0].x > 208 &&
      result.paths[0].segments.at(-1).points[0].x < 256,
  );
});
test("distant former spouses and their children bypass intervening people", () => {
  const people = [
    person("a", [], ["b"], { formerPartnerIds: ["b"] }),
    person("b", [], ["a"]),
    person("obstacle"),
    person("c", ["a", "b"]),
  ];
  const bounds = new Map([
    ["a", rect(0, 0)],
    ["b", rect(600, 0)],
    ["obstacle", rect(300, 0)],
    ["c", rect(300, 400)],
  ]);
  const result = buildConnections(people, bounds);
  verify(result, bounds);
  assert.equal(result.marriages.length, 1);
  assert.equal(result.marriages[0].former, true);
  assert.equal(result.paths[0].segments.length, 3);
});
test("manual positions and skipped generations route around card obstacles", () => {
  const people = [
    person("a"),
    person("b", ["a"]),
    person("block1"),
    person("block2"),
    person("block3"),
  ];
  const bounds = new Map([
    ["a", rect(0, 0)],
    ["b", rect(480, 950)],
    ["block1", rect(0, 340)],
    ["block2", rect(250, 420)],
    ["block3", rect(480, 580)],
  ]);
  const result = buildConnections(people, bounds);
  verify(result, bounds);
  assert.equal(result.paths[0].segments.length, 2);
});
test("visibility graph detours when both simple elbow routes are blocked", () => {
  const boxes = [rect(0, 0), rect(250, 300), rect(500, 0)];
  const start = { x: -30, y: 130 },
    end = { x: 740, y: 430 };
  const route = createRouter(boxes, [start, end])(start, end);
  assert.ok(route.length >= 4);
  for (let i = 1; i < route.length; i++)
    for (const r of boxes)
      assert.equal(intersectsCard(route[i - 1], route[i], r), false);
});
test("large eight-generation family retains every relationship without crossing a card", () => {
  const people = [];
  for (let generation = 0; generation < 8; generation++)
    for (let j = 0; j < 12; j++) {
      const id = `${generation}-${j}`,
        partner = `${generation}-${j ^ 1}`;
      people.push(
        person(
          id,
          generation
            ? [
                `${generation - 1}-${Math.floor(j / 2) * 2}`,
                `${generation - 1}-${Math.floor(j / 2) * 2 + 1}`,
              ]
            : [],
          [partner],
          { generation, currentPartnerId: partner },
        ),
      );
    }
  const layout = buildFamilyLayout(people),
    bounds = new Map(
      layout.cards.map((c) => [
        c.person.id,
        {
          left: c.x,
          right: c.x + CARD_WIDTH,
          top: c.y,
          bottom: c.y + CARD_HEIGHT,
        },
      ]),
    );
  const result = buildConnections(people, bounds);
  verify(result, bounds);
  assert.equal(result.marriages.length, 48);
  assert.equal(result.paths.length, 42);
  for (const family of result.paths) assert.equal(family.segments.length, 4);
});
