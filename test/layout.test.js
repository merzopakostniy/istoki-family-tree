import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFamilyLayout,
  CARD_WIDTH,
  COUPLE_GAP,
  MANUAL_POSITION_VERSION,
} from "../src/layout.js";

function person(id, generation, options = {}) {
  return {
    id,
    name: id,
    generation,
    parents: [],
    partnerIds: [],
    currentPartnerId: "",
    formerPartnerIds: [],
    manualX: null,
    manualY: null,
    manualPositionVersion: 0,
    ...options,
  };
}

test("current spouses form one close pair while siblings remain on one compact branch", () => {
  const people = [
    person("father", 0, { partnerIds: ["mother"], currentPartnerId: "mother" }),
    person("mother", 0, { partnerIds: ["father"], currentPartnerId: "father" }),
    person("child-a", 1, { parents: ["father", "mother"], partnerIds: ["spouse"], currentPartnerId: "spouse" }),
    person("spouse", 1, { partnerIds: ["child-a"], currentPartnerId: "child-a" }),
    person("child-b", 1, { parents: ["father", "mother"] }),
    person("child-c", 1, { parents: ["father", "mother"] }),
  ];
  const layout = buildFamilyLayout(people);
  const cards = new Map(layout.cards.map((card) => [card.person.id, card]));

  assert.equal(cards.get("father").y, cards.get("mother").y);
  assert.equal(Math.abs(cards.get("father").x - cards.get("mother").x), CARD_WIDTH + COUPLE_GAP);
  assert.equal(cards.get("child-a").y, cards.get("child-b").y);
  assert.equal(cards.get("child-b").y, cards.get("child-c").y);

  const siblingUnits = layout.units
    .filter((unit) => unit.people.some((member) => ["child-a", "child-b", "child-c"].includes(member.id)))
    .sort((first, second) => first.x - second.x);
  assert.deepEqual(siblingUnits.flatMap((unit) => unit.people.map((member) => member.id)).filter((id) => id.startsWith("child-")), ["child-a", "child-b", "child-c"]);
});

test("former spouses stay independent and any one card can keep a new manual position", () => {
  const people = [
    person("anchor", 1, {
      partnerIds: ["former-a", "former-b"],
      formerPartnerIds: ["former-a", "former-b"],
    }),
    person("former-a", 1, {
      partnerIds: ["anchor"],
      formerPartnerIds: ["anchor"],
      manualX: 320,
      manualY: 280,
      manualPositionVersion: MANUAL_POSITION_VERSION,
    }),
    person("former-b", 1, {
      partnerIds: ["anchor"],
      formerPartnerIds: ["anchor"],
    }),
  ];
  const layout = buildFamilyLayout(people);
  const units = layout.units.filter((unit) => unit.people.some((member) => ["anchor", "former-a", "former-b"].includes(member.id)));
  const formerCard = layout.cards.find((card) => card.person.id === "former-a");

  assert.equal(units.length, 3);
  assert.deepEqual({ x: formerCard.x, y: formerCard.y }, { x: 320, y: 280 });
});

test("legacy group coordinates are ignored instead of scattering the rebuilt hierarchy", () => {
  const people = [
    person("first", 0, {
      partnerIds: ["second"],
      manualX: 4800,
      manualY: 2900,
    }),
    person("second", 0, {
      partnerIds: ["first"],
      manualX: 4800,
      manualY: 2900,
    }),
  ];
  const layout = buildFamilyLayout(people);

  assert.ok(layout.cards.every((card) => card.x < 1000));
  assert.ok(layout.cards.every((card) => card.y < 500));
});

test("rows never overlap after hierarchy compaction", () => {
  const parents = [
    person("parent-a", 0, { partnerIds: ["parent-b"], currentPartnerId: "parent-b" }),
    person("parent-b", 0, { partnerIds: ["parent-a"], currentPartnerId: "parent-a" }),
  ];
  const children = Array.from({ length: 12 }, (_, index) => person(`child-${index}`, 1, { parents: ["parent-a", "parent-b"] }));
  const layout = buildFamilyLayout([...parents, ...children]);
  const row = layout.cards.filter((card) => card.person.generation === 1).sort((first, second) => first.x - second.x);

  for (let index = 1; index < row.length; index += 1) {
    assert.ok(row[index].x >= row[index - 1].x + CARD_WIDTH);
  }
});
