import assert from "node:assert/strict";
import test from "node:test";
import { searchFamilyBranch, selectionFocusIds } from "../src/relations.js";

const people = [
  { id: "grandparent", name: "Иванов Пётр", parents: [], partnerIds: [] },
  {
    id: "parent",
    name: "Иванова Анна",
    parents: ["grandparent"],
    partnerIds: ["spouse"],
  },
  { id: "spouse", name: "Смирнов Олег", parents: [], partnerIds: ["parent"] },
  {
    id: "child",
    name: "Иванов Максим",
    parents: ["parent", "spouse"],
    partnerIds: [],
  },
  { id: "unrelated", name: "Петрова Мария", parents: [], partnerIds: [] },
];

test("selection keeps the person, parents, children and spouses bright", () => {
  assert.deepEqual([...selectionFocusIds(people, "parent")].sort(), [
    "child",
    "grandparent",
    "parent",
    "spouse",
  ]);
});

test("surname search includes matching people and their immediate family", () => {
  const result = searchFamilyBranch(people, "иванов");

  assert.deepEqual([...result.matchIds].sort(), [
    "child",
    "grandparent",
    "parent",
  ]);
  assert.deepEqual(result.visiblePeople.map((person) => person.id).sort(), [
    "child",
    "grandparent",
    "parent",
    "spouse",
  ]);
});

test("an empty search preserves the full tree", () => {
  const result = searchFamilyBranch(people, "   ");

  assert.equal(result.visiblePeople, people);
  assert.equal(result.matchIds.size, 0);
});

test("direct relatives include siblings but exclude unrelated people", async () => {
  const { directRelatives, relationshipLabel } =
    await import("../src/relations.js");
  const extended = [
    ...people,
    {
      id: "sibling",
      name: "Иванова Ольга",
      parents: ["grandparent"],
      partnerIds: [],
    },
  ];
  const parent = extended.find((p) => p.id === "parent");
  const relatives = directRelatives(extended, parent);
  assert.ok(relatives.some((p) => p.id === "sibling"));
  assert.ok(!relatives.some((p) => p.id === "unrelated"));
  assert.equal(relationshipLabel(parent, extended.at(-1)), "Брат / сестра");
  assert.ok(selectionFocusIds(extended, "parent").has("sibling"));
});

test("search handles maiden names, locations and ё spelling", () => {
  const records = [
    {
      id: "a",
      name: "Фёдор",
      maidenName: "Соколова",
      birthplace: "Тверь",
      parents: [],
      partnerIds: [],
    },
  ];
  for (const query of ["федор", "соколова", "тверь"])
    assert.equal(searchFamilyBranch(records, query).matchIds.size, 1);
});
