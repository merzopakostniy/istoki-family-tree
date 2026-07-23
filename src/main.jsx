import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { onAuthStateChanged } from "firebase/auth";
import { generationMeta } from "./data";
import { auth, isOwnerUser, signInOwner, signOutOwner, subscribeToPeople, syncPeople } from "./firebase";
import { buildFamilyLayout as buildHierarchyLayout, MANUAL_POSITION_VERSION } from "./layout";
import "./styles.css";

const STORAGE_KEY = "istoki-family-tree-v2";

function Icon({ name, size = 20 }) {
  const paths = {
    tree: <><path d="M12 3v18M7 7c0-2 2-4 5-4s5 2 5 4-2 4-5 4-5-2-5-4Z"/><path d="M5 13c0-1.7 1.5-3 3.4-3 1.8 0 3.6 1.3 3.6 3s-1.8 3-3.6 3C6.5 16 5 14.7 5 13Zm7 2.5c0-1.9 1.7-3.5 3.8-3.5s3.7 1.6 3.7 3.5-1.6 3.5-3.7 3.5-3.8-1.6-3.8-3.5Z"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.3-4 2.2-6 5.5-6s5.2 2 5.5 6M16 5.5a3 3 0 0 1 0 5.8M16.5 14c2.5.2 3.8 1.8 4 5"/></>,
    book: <><path d="M4 5.5C7 4 9.5 4.3 12 6v14c-2.5-1.7-5-2-8-.5v-14Z"/><path d="M20 5.5C17 4 14.5 4.3 12 6v14c2.5-1.7 5-2 8-.5v-14Z"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    edit: <><path d="m4 20 4.2-1 10.6-10.6-3.2-3.2L5 15.8 4 20Z"/><path d="m13.8 7 3.2 3.2"/></>,
    target: <><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>,
    chevron: <path d="m9 6 6 6-6 6"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
    arrowLeft: <path d="m14.5 6-6 6 6 6M9 12h10"/>,
    arrowRight: <path d="m9.5 6 6 6-6 6M15 12H5"/>,
    arrowUp: <path d="m6 14.5 6-6 6 6M12 9v10"/>,
    arrowDown: <path d="m6 9.5 6 6 6-6M12 15V5"/>,
    cloud: <><path d="M7 18h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.4-1.7A4.8 4.8 0 0 0 7 18Z"/><path d="m9 13 2 2 4-4"/></>,
  };
  return <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function initials(name) {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("");
}

function years(person) {
  if (!person.birth && !person.death) return "Нет данных";
  if (person.birth && person.death) return `${person.birth} — ${person.death}`;
  return person.birth || `— ${person.death}`;
}

function normalizePerson(person) {
  const { occupation: _removedOccupation, partnerId: legacyPartnerId, ...clean } = person;
  const partnerIds = Array.isArray(clean.partnerIds) ? clean.partnerIds : legacyPartnerId ? [legacyPartnerId] : [];
  return {
    id: clean.id || "",
    name: clean.name || "",
    birth: clean.birth || "",
    death: clean.death || "",
    relation: clean.relation || "",
    generation: Number.isFinite(clean.generation) ? Math.max(0, Math.round(clean.generation)) : 0,
    parents: Array.isArray(clean.parents) ? clean.parents : [],
    partnerIds: [...new Set(partnerIds.filter(Boolean))],
    currentPartnerId: clean.currentPartnerId || "",
    formerPartnerIds: [...new Set((Array.isArray(clean.formerPartnerIds) ? clean.formerPartnerIds : []).filter(Boolean))],
    birthplace: clean.birthplace || "",
    deathplace: clean.deathplace || "",
    maidenName: clean.maidenName || "",
    manualGeneration: Boolean(clean.manualGeneration),
    manualX: Number.isFinite(clean.manualX) ? clean.manualX : null,
    manualY: Number.isFinite(clean.manualY) ? clean.manualY : null,
    manualPositionVersion: Number.isFinite(clean.manualPositionVersion) ? clean.manualPositionVersion : 0,
    note: clean.note || "",
    photo: clean.photo || "",
    photoX: Number.isFinite(clean.photoX) ? clean.photoX : 50,
    photoY: Number.isFinite(clean.photoY) ? clean.photoY : 50,
    photoScale: Number.isFinite(clean.photoScale) ? clean.photoScale : 1,
  };
}

function normalizePeople(people) {
  const normalized = people.map(normalizePerson);
  const byId = new Map(normalized.map((person) => [person.id, person]));
  normalized.forEach((person) => {
    person.partnerIds = person.partnerIds.filter((id) => id !== person.id && byId.has(id));
    person.partnerIds.forEach((partnerId) => {
      const partner = byId.get(partnerId);
      if (!partner.partnerIds.includes(person.id)) partner.partnerIds.push(person.id);
    });
    if (!person.partnerIds.includes(person.currentPartnerId)) person.currentPartnerId = "";
    person.formerPartnerIds = person.formerPartnerIds.filter((id) => person.partnerIds.includes(id) && id !== person.currentPartnerId);
  });
  const maxPasses = Math.min(normalized.length + 2, 64);
  for (let pass = 0; pass < maxPasses; pass += 1) {
    normalized.forEach((person) => {
      const parentGenerations = person.parents.map((id) => byId.get(id)?.generation).filter(Number.isFinite);
      if (parentGenerations.length) {
        const highestParent = Math.max(...parentGenerations);
        const requiredGeneration = highestParent + 1;
        if (!person.manualGeneration || person.generation <= highestParent) person.generation = requiredGeneration;
      }
      person.partnerIds.forEach((partnerId) => {
        const partner = byId.get(partnerId);
        if (partner) person.generation = partner.generation = Math.max(person.generation, partner.generation);
      });
    });
  }
  return normalized;
}

function relationshipLabel(person, relative) {
  if (person.partnerIds.includes(relative.id) || relative.partnerIds.includes(person.id)) return "Супруг / супруга";
  if (person.parents.includes(relative.id)) return "Родитель";
  if (relative.parents.includes(person.id)) return "Ребёнок";
  return relative.relation || "Родственник";
}

function optimizePhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type.startsWith("image/")) {
      reject(new Error("Выберите изображение"));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error("Фото должно быть меньше 12 МБ"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать фото"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Не удалось открыть фото"));
      image.onload = () => {
        const maxSide = 640;
        const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        const context = canvas.getContext("2d");
        context.fillStyle = "#f7f5ef";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", .76));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function Portrait({ person, className }) {
  return (
    <span className={className} aria-hidden="true">
      {person.photo ? <img className="portrait-image" src={person.photo} alt="" style={{ objectPosition: `${person.photoX ?? 50}% ${person.photoY ?? 50}%`, transform: `scale(${person.photoScale ?? 1})` }}/> : initials(person.name || "?")}
    </span>
  );
}

function PersonCard({ person, selected, focus, onSelect, register }) {
  const tilt = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - .5;
    const py = (event.clientY - rect.top) / rect.height - .5;
    event.currentTarget.style.setProperty("--tilt-x", (-py * 10).toFixed(2));
    event.currentTarget.style.setProperty("--tilt-y", (px * 10).toFixed(2));
  };
  const resetTilt = (event) => {
    event.currentTarget.style.setProperty("--tilt-x", 0);
    event.currentTarget.style.setProperty("--tilt-y", 0);
  };
  return (
    <button
      className={`person-card ${selected ? "is-selected" : ""} ${focus === "dim" ? "is-dimmed" : ""} ${focus === "on" ? "is-focused" : ""}`}
      onClick={() => onSelect(person.id)}
      onMouseMove={tilt}
      onMouseLeave={resetTilt}
      ref={(node) => register(person.id, node)}
      type="button"
      aria-pressed={selected}
    >
      <Portrait person={person} className="avatar"/>
      <span className="person-copy">
        <strong>{person.name}</strong>
        <span className="person-years">{years(person)}</span>
        {(person.maidenName || person.relation) && <small className="person-role">{[person.maidenName ? `урожд. ${person.maidenName}` : "", person.relation].filter(Boolean).join(" · ")}</small>}
      </span>
    </button>
  );
}

const CARD_WIDTH = 258;
const CARD_HEIGHT = 134;
const PARTNER_CONNECTOR_WIDTH = 42;
const SIBLING_GAP = 44;
const MARRIAGE_BRANCH_GAP = 104;
const ROOT_FAMILY_GAP = 84;
const STAGE_PADDING = 56;
const EMPTY_STAGE_HEIGHT = 770;
const STAGE_TOP = 28;
const STAGE_BOTTOM = 54;
const GENERATION_GAP = 190;
const CONTOUR_GAP = 60;
const BRANCH_COLORS = ["#5da97e", "#e0865a", "#6ba9d6", "#dcac48", "#b189bd", "#4fb3a8", "#dd8299", "#8b9bdb", "#a7b563", "#c8945f", "#6cb6cf", "#c47b96"];

function marriageKey(firstId, secondId) {
  return [firstId, secondId].filter(Boolean).sort().join("--");
}

function branchColor(key) {
  let hash = 0;
  for (const character of key || "family") hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
  return BRANCH_COLORS[hash % BRANCH_COLORS.length];
}

function familyUnitWidth(people) {
  return people.length * CARD_WIDTH + Math.max(0, people.length - 1) * PARTNER_CONNECTOR_WIDTH;
}

function buildFamilyLayout(people) {
  if (!people.length) return { units: [], cards: [], width: 940, height: EMPTY_STAGE_HEIGHT };
  const sourceOrder = new Map(people.map((person, index) => [person.id, index]));
  const generations = [...new Set(people.map((person) => person.generation))].sort((first, second) => second - first);
  const highestGeneration = generations[0];
  const lowestGeneration = generations[generations.length - 1];
  const units = generations.flatMap((generation) => groupPartnerUnits(people.filter((person) => person.generation === generation)).map((members) => ({
    id: members.map((person) => person.id).sort().join("--"),
    people: members,
    generation,
    width: familyUnitWidth(members),
    order: Math.min(...members.map((person) => sourceOrder.get(person.id) ?? 0)),
    children: [],
    primaryParentId: null,
    primaryMarriageKey: "",
    subtreeWidth: 0,
    x: 0,
    y: STAGE_TOP + (highestGeneration - generation) * GENERATION_GAP,
  })));
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const unitByPersonId = new Map();
  units.forEach((unit) => unit.people.forEach((person) => unitByPersonId.set(person.id, unit)));

  units.forEach((unit) => {
    const candidates = new Map();
    unit.people.forEach((person, memberIndex) => person.parents.forEach((parentId) => {
      const parentUnit = unitByPersonId.get(parentId);
      if (!parentUnit || parentUnit.id === unit.id || parentUnit.generation >= unit.generation) return;
      const candidate = candidates.get(parentUnit.id) || { count: 0, firstMemberIndex: memberIndex };
      candidate.count += 1;
      candidate.firstMemberIndex = Math.min(candidate.firstMemberIndex, memberIndex);
      candidates.set(parentUnit.id, candidate);
    }));
    const [primary] = [...candidates.entries()].sort((first, second) => {
      if (second[1].count !== first[1].count) return second[1].count - first[1].count;
      if (first[1].firstMemberIndex !== second[1].firstMemberIndex) return first[1].firstMemberIndex - second[1].firstMemberIndex;
      const firstUnit = unitById.get(first[0]);
      const secondUnit = unitById.get(second[0]);
      if (secondUnit.generation !== firstUnit.generation) return secondUnit.generation - firstUnit.generation;
      return firstUnit.order - secondUnit.order;
    });
    if (primary) {
      const parentUnit = unitById.get(primary[0]);
      const parentIds = new Set(parentUnit.people.map((person) => person.id));
      unit.primaryParentId = primary[0];
      unit.primaryMarriageKey = unit.people.flatMap((person) => person.parents.filter((parentId) => parentIds.has(parentId))).sort().join("--");
      parentUnit.children.push(unit);
    }
  });

  // ── Undirected adjacency over units: A—B if someone in A is a parent of someone in B. ──
  const neighbours = new Map(units.map((unit) => [unit.id, new Set()]));
  units.forEach((unit) => unit.people.forEach((person) => person.parents.forEach((parentId) => {
    const parentUnit = unitByPersonId.get(parentId);
    if (parentUnit && parentUnit.id !== unit.id) {
      neighbours.get(unit.id).add(parentUnit.id);
      neighbours.get(parentUnit.id).add(unit.id);
    }
  })));

  // ── Spanning forest: root each connected component at its oldest (lowest-generation) unit, then
  // BFS outward. Every neighbour — descendant OR a married-in spouse's own ancestor branch — becomes
  // a child in the spanning tree, so in-law lineages attach right where they connect instead of being
  // swept to the far side of the stage. ──
  const treeChildren = new Map(units.map((unit) => [unit.id, []]));
  const roots = [];
  const visited = new Set();
  units.forEach((start) => {
    if (visited.has(start.id)) return;
    const component = [];
    const stack = [start.id];
    const localSeen = new Set([start.id]);
    while (stack.length) {
      const id = stack.pop();
      component.push(unitById.get(id));
      neighbours.get(id).forEach((next) => { if (!localSeen.has(next)) { localSeen.add(next); stack.push(next); } });
    }
    const root = component.reduce((best, unit) => (unit.generation < best.generation || (unit.generation === best.generation && unit.order < best.order)) ? unit : best, component[0]);
    roots.push(root);
    const queue = [root.id];
    visited.add(root.id);
    while (queue.length) {
      const id = queue.shift();
      [...neighbours.get(id)].forEach((next) => {
        if (!visited.has(next)) { visited.add(next); treeChildren.get(id).push(unitById.get(next)); queue.push(next); }
      });
    }
  });

  // order spanning-tree children by where they attach along the parent's card row, then source order
  const attachIndex = (parent, child) => {
    const parentIndex = new Map(parent.people.map((person, index) => [person.id, index]));
    const indices = [];
    child.people.forEach((childPerson) => childPerson.parents.forEach((parentId) => { if (parentIndex.has(parentId)) indices.push(parentIndex.get(parentId)); }));
    parent.people.forEach((parentPerson, index) => parentPerson.parents.forEach((parentId) => { if (child.people.some((childPerson) => childPerson.id === parentId)) indices.push(index); }));
    return indices.length ? indices.reduce((sum, value) => sum + value, 0) / indices.length : parent.people.length / 2;
  };
  units.forEach((parent) => treeChildren.get(parent.id).sort((first, second) => attachIndex(parent, first) - attachIndex(parent, second) || first.order - second.order));

  // ── Contour packing (Reingold–Tilford, keyed by generation-row so branches that share no row stack
  // vertically instead of spreading sideways). layoutSubtree returns x-offsets (root at 0) plus
  // left/right contour maps (generation → extreme edge x). ──
  const shiftContour = (contour, delta) => { const shifted = new Map(); contour.forEach((value, generation) => shifted.set(generation, value + delta)); return shifted; };
  const layoutSubtree = (unit) => {
    const half = unit.width / 2;
    const kids = treeChildren.get(unit.id);
    if (!kids.length) {
      return { offsets: new Map([[unit.id, 0]]), left: new Map([[unit.generation, -half]]), right: new Map([[unit.generation, half]]) };
    }
    const offsets = new Map();
    const accLeft = new Map();
    const accRight = new Map();
    const kidRootX = [];
    const kidAttachOffset = [];
    const kidSpan = [];
    kids.forEach((kid, index) => {
      const sub = layoutSubtree(kid);
      let shift = 0;
      if (index > 0) {
        let need = -Infinity;
        sub.left.forEach((leftEdge, generation) => { if (accRight.has(generation)) need = Math.max(need, accRight.get(generation) + CONTOUR_GAP - leftEdge); });
        shift = need === -Infinity ? 0 : Math.max(0, need);
      }
      sub.offsets.forEach((x, id) => offsets.set(id, x + shift));
      shiftContour(sub.left, shift).forEach((value, generation) => { if (!accLeft.has(generation) || value < accLeft.get(generation)) accLeft.set(generation, value); });
      shiftContour(sub.right, shift).forEach((value, generation) => { if (!accRight.has(generation) || value > accRight.get(generation)) accRight.set(generation, value); });
      kidRootX.push(shift);
      kidAttachOffset.push(attachIndex(unit, kid) * (CARD_WIDTH + PARTNER_CONNECTOR_WIDTH) + CARD_WIDTH / 2 - unit.width / 2);
      kidSpan.push(Math.max(...sub.right.values()) - Math.min(...sub.left.values()));
    });
    // Plain couple: centre over its outer children. Multi-marriage unit: align its largest child
    // branch under the exact card it attaches to, so that spouse stays beside their own line while
    // distant marriages just get longer connectors.
    let parentX;
    if (unit.people.length >= 3) {
      let primary = 0;
      for (let index = 1; index < kids.length; index += 1) if (kidSpan[index] > kidSpan[primary]) primary = index;
      parentX = kidRootX[primary] - kidAttachOffset[primary];
    } else {
      parentX = (kidRootX[0] + kidRootX[kidRootX.length - 1]) / 2;
    }
    const finalOffsets = new Map();
    offsets.forEach((x, id) => finalOffsets.set(id, x - parentX));
    finalOffsets.set(unit.id, 0);
    const left = shiftContour(accLeft, -parentX);
    const right = shiftContour(accRight, -parentX);
    left.set(unit.generation, Math.min(left.has(unit.generation) ? left.get(unit.generation) : Infinity, -half));
    right.set(unit.generation, Math.max(right.has(unit.generation) ? right.get(unit.generation) : -Infinity, half));
    return { offsets: finalOffsets, left, right };
  };

  // place root subtrees left-to-right, contour-packed against each other (unit.x is CENTRE here)
  const cursorRight = new Map();
  roots.forEach((root, index) => {
    const sub = layoutSubtree(root);
    let base = STAGE_PADDING - Math.min(...sub.left.values());
    if (index > 0) {
      let need = -Infinity;
      sub.left.forEach((leftEdge, generation) => { if (cursorRight.has(generation)) need = Math.max(need, cursorRight.get(generation) + ROOT_FAMILY_GAP - (base + leftEdge)); });
      if (need !== -Infinity && need > 0) base += need;
    }
    sub.offsets.forEach((x, id) => { unitById.get(id).x = base + x; });
    sub.right.forEach((value, generation) => { const absolute = base + value; if (!cursorRight.has(generation) || absolute > cursorRight.get(generation)) cursorRight.set(generation, absolute); });
  });

  // convert centre → left edge for the renderer
  units.forEach((unit) => { unit.x -= unit.width / 2; });

  // ── Spread the spouse chain: give each spouse card a variable gap so it sits over the branches
  // that attach to that person (their own children, and a married-in spouse's own parents), instead
  // of sliding the whole unit off-centre. Partners who share all their children stay snug. ──
  const STEP = CARD_WIDTH + PARTNER_CONNECTOR_WIDTH;
  units.forEach((unit) => {
    const count = unit.people.length;
    unit.gaps = new Array(Math.max(0, count - 1)).fill(PARTNER_CONNECTOR_WIDTH);
    if (count < 2) return;
    const kids = treeChildren.get(unit.id);
    if (!kids.length) return;
    const targets = unit.people.map((person) => {
      const centres = [];
      kids.forEach((child) => {
        const attaches = child.people.some((childPerson) => childPerson.parents.includes(person.id)) || person.parents.some((parentId) => child.people.some((childPerson) => childPerson.id === parentId));
        if (attaches) centres.push(child.x + child.width / 2);
      });
      return centres.length ? centres.reduce((sum, value) => sum + value, 0) / centres.length : null;
    });
    if (targets.every((target) => target === null)) return;
    const left = unit.people.map((_person, index) => targets[index] != null ? targets[index] - CARD_WIDTH / 2 : unit.x + index * STEP);
    for (let index = 1; index < count; index += 1) left[index] = Math.max(left[index], left[index - 1] + STEP);
    for (let index = count - 2; index >= 0; index -= 1) if (targets[index] == null) left[index] = Math.min(left[index], left[index + 1] - STEP);
    const minLeft = Math.min(...left);
    unit.x = minLeft;
    unit.width = Math.max(...left) + CARD_WIDTH - minLeft;
    for (let index = 1; index < count; index += 1) unit.gaps[index - 1] = left[index] - (left[index - 1] + CARD_WIDTH);
  });

  // ── Resolve residual same-generation overlaps (fires only where a unit and one of its spanning
  // ancestors/in-laws share a row, e.g. both spouses have parents) by shifting whole subtrees. ──
  const subtreeOf = new Map();
  const computeSubtree = (unit) => {
    if (subtreeOf.has(unit.id)) return subtreeOf.get(unit.id);
    const set = new Set([unit.id]);
    treeChildren.get(unit.id).forEach((child) => computeSubtree(child).forEach((id) => set.add(id)));
    subtreeOf.set(unit.id, set);
    return set;
  };
  units.forEach(computeSubtree);
  const shiftSubtree = (unit, delta) => subtreeOf.get(unit.id).forEach((id) => { unitById.get(id).x += delta; });
  for (let iteration = 0; iteration < 12; iteration += 1) {
    let moved = false;
    const byGeneration = new Map();
    units.forEach((unit) => { if (!byGeneration.has(unit.generation)) byGeneration.set(unit.generation, []); byGeneration.get(unit.generation).push(unit); });
    for (const row of byGeneration.values()) {
      row.sort((first, second) => first.x - second.x);
      for (let index = 0; index < row.length - 1; index += 1) {
        const left = row[index];
        const right = row[index + 1];
        const gap = (left.x + left.width) + CONTOUR_GAP - right.x;
        if (gap > 0.5) {
          if (subtreeOf.get(right.id).has(left.id)) shiftSubtree(left, -gap);
          else shiftSubtree(right, gap);
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  // normalise to stage padding
  let minX = Infinity;
  units.forEach((unit) => { if (unit.x < minX) minX = unit.x; });
  if (Number.isFinite(minX)) {
    const shift = STAGE_PADDING - minX;
    units.forEach((unit) => { unit.x += shift; });
  }
  // Cards are laid out as a family only for the initial automatic arrangement. Every person gets
  // their own final coordinates so partners can later be moved independently.
  const cards = [];
  units.forEach((unit) => {
    const gaps = unit.gaps || [];
    const cardLeft = (index) => index * CARD_WIDTH + gaps.slice(0, index).reduce((sum, value) => sum + value, 0);
    const manualGroups = new Map();
    unit.people.forEach((person) => {
      if (!Number.isFinite(person.manualX) || !Number.isFinite(person.manualY)) return;
      const key = `${person.manualX}:${person.manualY}`;
      if (!manualGroups.has(key)) manualGroups.set(key, []);
      manualGroups.get(key).push(person.id);
    });
    // The previous drag implementation stored the same top-left coordinate on every spouse.
    // Interpret exact duplicates as that legacy family position so existing saved trees do not
    // suddenly stack all spouses on top of one another after this upgrade.
    const legacyPositions = new Map();
    manualGroups.forEach((ids) => {
      if (ids.length < 2) return;
      const source = unit.people.find((person) => person.id === ids[0]);
      ids.forEach((id) => {
        const index = unit.people.findIndex((person) => person.id === id);
        legacyPositions.set(id, { x: source.manualX + cardLeft(index), y: source.manualY });
      });
    });
    unit.people.forEach((person, index) => {
      const legacy = legacyPositions.get(person.id);
      const hasManualPosition = Number.isFinite(person.manualX) && Number.isFinite(person.manualY);
      cards.push({
        person,
        x: legacy?.x ?? (hasManualPosition ? person.manualX : unit.x + cardLeft(index)),
        y: legacy?.y ?? (hasManualPosition ? person.manualY : unit.y),
      });
    });
  });

  let autoHeight = STAGE_TOP + (highestGeneration - lowestGeneration) * GENERATION_GAP + CARD_HEIGHT + STAGE_BOTTOM;
  let width = 0;
  let heightFromUnits = 0;
  cards.forEach((card) => {
    if (card.x + CARD_WIDTH > width) width = card.x + CARD_WIDTH;
    if (card.y + CARD_HEIGHT > heightFromUnits) heightFromUnits = card.y + CARD_HEIGHT;
  });
  return {
    units,
    cards,
    width: Math.max(940, width + STAGE_PADDING),
    height: Math.max(300, autoHeight, heightFromUnits + STAGE_BOTTOM),
  };
}

function generationLabel(generation) {
  return generationMeta.find((item) => item.id === generation)?.label || `Поколение ${generation + 1}`;
}

function PositionedPerson({ card, selectedId, focusIds, onSelect, register, canManage, scale, onDragEnd }) {
  const [drag, setDrag] = useState(null);
  const draggedRef = useRef(false);
  const redrawFrame = useRef(null);
  const clickResetTimer = useRef(null);
  useEffect(() => () => {
    cancelAnimationFrame(redrawFrame.current);
    clearTimeout(clickResetTimer.current);
  }, []);
  const redrawConnections = () => {
    cancelAnimationFrame(redrawFrame.current);
    redrawFrame.current = requestAnimationFrame(() => window.dispatchEvent(new Event("family-layout-change")));
  };
  const beginDrag = (event) => {
    if (!canManage || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY, moved: false, pointerId: event.pointerId };
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== start.pointerId) return;
      const dx = (moveEvent.clientX - start.x) / (scale || 1);
      const dy = (moveEvent.clientY - start.y) / (scale || 1);
      if (!start.moved && Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) < 4) return;
      start.moved = true;
      draggedRef.current = true;
      setDrag({ dx, dy });
      redrawConnections();
    };
    const onUp = (upEvent) => {
      if (upEvent.pointerId !== start.pointerId) return;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      if (start.moved) {
        const dx = (upEvent.clientX - start.x) / (scale || 1);
        const dy = (upEvent.clientY - start.y) / (scale || 1);
        onDragEnd(card.person.id, Math.max(0, card.x + dx), Math.max(0, card.y + dy));
        clickResetTimer.current = setTimeout(() => { draggedRef.current = false; }, 0);
      }
      setDrag(null);
      redrawConnections();
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  };
  const suppressClickAfterDrag = (event) => {
    if (draggedRef.current) { event.stopPropagation(); event.preventDefault(); draggedRef.current = false; }
  };
  const person = card.person;
  const left = card.x + (drag?.dx || 0);
  const top = card.y + (drag?.dy || 0);
  return (
    <div
      className={`positioned-person ${canManage ? "draggable" : ""} ${drag ? "is-dragging" : ""}`}
      style={{ left: `${left}px`, top: `${top}px` }}
      data-person-id={person.id}
      onPointerDown={beginDrag}
      onClickCapture={suppressClickAfterDrag}
    >
      <PersonCard person={person} selected={person.id === selectedId} focus={focusIds ? (focusIds.has(person.id) ? (person.id === selectedId ? "" : "on") : "dim") : ""} onSelect={onSelect} register={register}/>
    </div>
  );
}

function DetailPanel({ person, people, canEdit, expanded, onToggleExpand, onClose, onEdit, onDelete, onSelect, onMove }) {
  if (!person) return null;
  const related = people.filter((item) => person.parents.includes(item.id) || item.parents.includes(person.id) || person.partnerIds.includes(item.id) || item.partnerIds.includes(person.id));
  return (
    <aside className={`detail-panel ${expanded ? "is-expanded" : ""}`} aria-label={`Сведения: ${person.name}`}>
      <button className="sheet-handle" onClick={onToggleExpand} aria-label={expanded ? "Свернуть" : "Показать подробнее"}><i/></button>
      <button className="icon-button detail-close" onClick={onClose} aria-label="Закрыть карточку"><Icon name="close" /></button>
      <div className="detail-heading" onClick={onToggleExpand}>
        <Portrait person={person} className="detail-avatar"/>
        <div><h2>{person.name}</h2><p>{years(person)}</p></div>
      </div>
      <button className="sheet-more" onClick={onToggleExpand}>
        {expanded ? "Свернуть" : "Место рождения, заметки и связи"}
        <Icon name="chevron" size={15}/>
      </button>
      <section className="detail-section">
        <div className="section-title"><h3>О человеке</h3>{canEdit && <button className="bare-icon" onClick={onEdit} aria-label="Редактировать"><Icon name="edit" size={18}/></button>}</div>
        <dl>
          <div><dt>Девичья фамилия</dt><dd>{person.maidenName || "Не указана"}</dd></div>
          <div><dt>Год рождения</dt><dd>{person.birth || "Не указан"}</dd></div>
          <div><dt>Место рождения</dt><dd>{person.birthplace || "Не указано"}</dd></div>
          <div><dt>Год смерти</dt><dd>{person.death || "Не указан"}</dd></div>
          <div><dt>Место смерти</dt><dd>{person.deathplace || "Не указано"}</dd></div>
          <div><dt>Поколение</dt><dd>{generationLabel(person.generation)}</dd></div>
          <div><dt>Кем приходится</dt><dd>{person.relation || "Не указано"}</dd></div>
          <div><dt>Примечание</dt><dd>{person.note || "Пока нет заметок"}</dd></div>
        </dl>
      </section>
      <section className="detail-section relations">
        <div className="section-title"><h3>Родственные связи</h3></div>
        {related.length ? related.map((relative) => (
          <button key={relative.id} className="relation-row" onClick={() => onSelect(relative.id)}>
            <span><em>{relationshipLabel(person, relative)}</em><strong>{relative.name}</strong><small>{years(relative)}</small></span><Icon name="chevron" size={17}/>
          </button>
        )) : <p className="empty-copy">Связи ещё не добавлены.</p>}
      </section>
      {canEdit && <section className="placement-section">
        <div className="section-title"><h3>Расположение карточки</h3></div>
        <p>Эта карточка перемещается отдельно от всех остальных.</p>
        <div className="placement-controls">
          <button onClick={() => onMove("left")}><Icon name="arrowLeft" size={17}/>Влево</button>
          <button onClick={() => onMove("right")}>Вправо<Icon name="arrowRight" size={17}/></button>
          <button onClick={() => onMove("up")}><Icon name="arrowUp" size={17}/>Выше</button>
          <button onClick={() => onMove("down")}><Icon name="arrowDown" size={17}/>Ниже</button>
        </div>
      </section>}
      <div className="detail-actions">
        {canEdit && <button className="button secondary" onClick={onEdit}><Icon name="edit" size={18}/>Редактировать</button>}
        <button className="button ghost" onClick={onClose}>Закрыть</button>
      </div>
      {canEdit && <button className="delete-action" onClick={onDelete}><Icon name="trash" size={17}/>Удалить человека</button>}
    </aside>
  );
}

function PersonEditor({ person, people, onSave, onClose }) {
  const isNew = !person;
  const photoInputRef = useRef(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [form, setForm] = useState({
    name: "", birth: "", death: "", relation: "", generation: 0,
    parents: [], partnerIds: [], currentPartnerId: "", formerPartnerIds: [], birthplace: "", deathplace: "", maidenName: "", note: "",
    photo: "", photoX: 50, photoY: 50, photoScale: 1,
    ...(person ? normalizePerson(person) : {}),
  });
  const highestGeneration = Math.max(3, form.generation, ...people.map((item) => item.generation));
  const generationOptions = Array.from({ length: highestGeneration + 2 }, (_, generation) => generation).reverse();
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const choosePhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const photo = await optimizePhoto(file);
      setForm((current) => ({ ...current, photo, photoX: 50, photoY: 50, photoScale: 1 }));
    } catch (error) {
      setPhotoError(error.message);
    } finally {
      setPhotoBusy(false);
      event.target.value = "";
    }
  };
  const chooseParent = (index, parentId) => {
    setForm((current) => {
      const parents = [...current.parents];
      parents[index] = parentId;
      const uniqueParents = parents.filter((id, itemIndex, all) => id && all.indexOf(id) === itemIndex);
      const parentGenerations = uniqueParents.map((id) => people.find((item) => item.id === id)?.generation).filter(Number.isFinite);
      const generation = parentGenerations.length ? Math.max(...parentGenerations) + 1 : current.generation;
      return { ...current, parents: uniqueParents, generation, manualGeneration: false };
    });
  };
  const togglePartner = (partnerId, checked) => {
    setForm((current) => {
      const partnerIds = checked ? [...new Set([...current.partnerIds, partnerId])] : current.partnerIds.filter((id) => id !== partnerId);
      const generations = partnerIds.map((id) => people.find((item) => item.id === id)?.generation).filter(Number.isFinite);
      const currentPartnerId = checked ? current.currentPartnerId : (current.currentPartnerId === partnerId ? "" : current.currentPartnerId);
      const formerPartnerIds = checked ? current.formerPartnerIds : current.formerPartnerIds.filter((id) => id !== partnerId);
      return { ...current, partnerIds, currentPartnerId, formerPartnerIds, generation: generations.length ? Math.max(...generations) : current.generation };
    });
  };
  const setCurrentPartner = (partnerId, isCurrent) => setForm((current) => ({ ...current, currentPartnerId: isCurrent ? "" : partnerId, formerPartnerIds: current.formerPartnerIds.filter((id) => id !== partnerId) }));
  const setFormerPartner = (partnerId, isFormer) => setForm((current) => ({
    ...current,
    currentPartnerId: current.currentPartnerId === partnerId ? "" : current.currentPartnerId,
    formerPartnerIds: isFormer ? current.formerPartnerIds.filter((id) => id !== partnerId) : [...new Set([...current.formerPartnerIds, partnerId])],
  }));
  const submit = (event) => {
    event.preventDefault();
    onSave(form);
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="editor" onSubmit={submit}>
        <div className="editor-header"><div><h2>{isNew ? "Добавить человека" : "Редактировать запись"}</h2><p>Заполните только то, что уже известно.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button></div>
        <div className="photo-editor">
          <Portrait person={{ ...form, name: form.name || "Фото" }} className="editor-photo-preview"/>
          <div className="photo-editor-body">
            <strong>Фотография</strong>
            <p>Загрузите снимок, затем подгоните лицо внутри овала.</p>
            <input ref={photoInputRef} className="visually-hidden" type="file" accept="image/*" onChange={choosePhoto}/>
            <div className="photo-buttons">
              <button type="button" className="button ghost compact" onClick={() => photoInputRef.current?.click()} disabled={photoBusy}>{photoBusy ? "Обрабатываем…" : form.photo ? "Заменить фото" : "Добавить фото"}</button>
              {form.photo && <button type="button" className="bare-text-button" onClick={() => setForm((current) => ({ ...current, photo: "", photoX: 50, photoY: 50, photoScale: 1 }))}>Убрать</button>}
            </div>
            {photoError && <span className="field-error" role="alert">{photoError}</span>}
            {form.photo && <div className="photo-controls">
              <label>По горизонтали<input aria-label="Положение фото по горизонтали" type="range" min="0" max="100" value={form.photoX} onChange={(e) => update("photoX", Number(e.target.value))}/></label>
              <label>По вертикали<input aria-label="Положение фото по вертикали" type="range" min="0" max="100" value={form.photoY} onChange={(e) => update("photoY", Number(e.target.value))}/></label>
              <label>Масштаб<input aria-label="Масштаб фото" type="range" min="1" max="2" step="0.05" value={form.photoScale} onChange={(e) => update("photoScale", Number(e.target.value))}/></label>
            </div>}
          </div>
        </div>
        <div className="form-grid">
          <label className="wide">Имя и фамилия<input name="name" value={form.name} onChange={(e) => update("name", e.target.value)} required autoFocus /></label>
          <label>Год рождения<input name="birth" inputMode="numeric" value={form.birth} onChange={(e) => update("birth", e.target.value)} /></label>
          <label>Год смерти<input name="death" inputMode="numeric" value={form.death} onChange={(e) => update("death", e.target.value)} /></label>
          <label>Поколение<select value={form.generation} onChange={(e) => setForm((current) => ({ ...current, generation: Number(e.target.value), manualGeneration: true }))}>{generationOptions.map((generation) => <option value={generation} key={generation}>{generationLabel(generation)}</option>)}</select></label>
          <label>Кем приходится<input value={form.relation} onChange={(e) => update("relation", e.target.value)} placeholder="например, прабабушка" /></label>
          <label>Первый родитель<select name="parentId1" value={form.parents?.[0] || ""} onChange={(e) => chooseParent(0, e.target.value)}><option value="">Не выбран</option>{people.filter((item) => item.id !== person?.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Второй родитель<select name="parentId2" value={form.parents?.[1] || ""} onChange={(e) => chooseParent(1, e.target.value)}><option value="">Не выбран</option>{people.filter((item) => item.id !== person?.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <fieldset className="wide spouse-field">
            <legend>Супруги</legend>
            <div className="spouse-options">
              {people.filter((item) => item.id !== person?.id).map((item) => {
                const checked = form.partnerIds.includes(item.id);
                const isCurrent = form.currentPartnerId === item.id || item.currentPartnerId === form.id;
                const isFormer = form.formerPartnerIds.includes(item.id) || item.formerPartnerIds.includes(form.id);
                return (
                  <span className="spouse-option" key={item.id}>
                    <label>
                      <input type="checkbox" checked={checked} onChange={(e) => togglePartner(item.id, e.target.checked)}/>
                      <span>{item.name}</span>
                    </label>
                    {checked && <span className="marriage-status-controls">
                      <button type="button" className={`current-marriage-toggle ${isCurrent ? "is-current" : ""}`} onClick={() => setCurrentPartner(item.id, isCurrent)}>
                        {isCurrent ? "Текущий брак" : "Отметить текущим"}
                      </button>
                      <button type="button" className={`former-marriage-toggle ${isFormer ? "is-former" : ""}`} onClick={() => setFormerPartner(item.id, isFormer)}>
                        {isFormer ? "Бывший брак" : "Отметить бывшим"}
                      </button>
                    </span>}
                  </span>
                );
              })}
              {people.filter((item) => item.id !== person?.id).length === 0 ? <span className="empty-spouse-copy">Сначала добавьте второго человека</span> : null}
            </div>
            {form.partnerIds.length > 0 && <p className="spouse-hint">Отметьте текущий или бывший брак. Рамка показывается только у текущей пары; бывшие супруги остаются рядом без фона.</p>}
          </fieldset>
          <label className="wide">Девичья фамилия<input value={form.maidenName} onChange={(e) => update("maidenName", e.target.value)} placeholder="Фамилия до брака" /></label>
          <label className="wide">Место рождения<input value={form.birthplace} onChange={(e) => update("birthplace", e.target.value)} /></label>
          <label className="wide">Место смерти<input value={form.deathplace} onChange={(e) => update("deathplace", e.target.value)} /></label>
          <label className="wide">Заметка<textarea rows="3" value={form.note} onChange={(e) => update("note", e.target.value)} /></label>
        </div>
        <div className="editor-actions"><button type="button" className="button ghost" onClick={onClose}>Отмена</button><button className="button primary" type="submit">Сохранить</button></div>
      </form>
    </div>
  );
}

function ConfirmDelete({ person, onConfirm, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <span className="confirm-icon"><Icon name="trash" size={24}/></span>
        <h2 id="delete-title">Удалить {person.name}?</h2>
        <p>Карточка исчезнет из древа. Остальные родственники сохранятся, а связанные линии будут аккуратно удалены.</p>
        <div className="confirm-actions">
          <button className="button ghost" onClick={onClose}>Отмена</button>
          <button className="button danger" onClick={onConfirm}>Удалить</button>
        </div>
      </section>
    </div>
  );
}

function TreeConnections({ people, nodes, stage, scale, selectedId }) {
  const [paths, setPaths] = useState([]);
  const [marriages, setMarriages] = useState([]);
  useLayoutEffect(() => {
    const draw = () => {
      const stageNode = stage.current;
      if (!stageNode) return;
      const base = stageNode.getBoundingClientRect();
      const peopleById = new Map(people.map((person) => [person.id, person]));
      const box = (id) => {
        const rect = nodes.current.get(id)?.getBoundingClientRect();
        if (!rect) return null;
        return {
          left: (rect.left - base.left) / scale,
          right: (rect.right - base.left) / scale,
          top: (rect.top - base.top) / scale,
          bottom: (rect.bottom - base.top) / scale,
          centerX: (rect.left - base.left + rect.width / 2) / scale,
          centerY: (rect.top - base.top + rect.height / 2) / scale,
        };
      };
      const point = (id, side) => {
        const rect = box(id);
        if (!rect) return null;
        return {
          x: rect.centerX,
          y: side === "top" ? rect.top : side === "center" ? rect.centerY : rect.bottom,
        };
      };
      const parentOrigin = (parentIds) => {
        if (parentIds.length === 1) return point(parentIds[0], "top");
        const parentPoints = parentIds.map((parentId) => point(parentId, "center")).filter(Boolean);
        if (!parentPoints.length) return null;
        return {
          x: parentPoints.reduce((sum, item) => sum + item.x, 0) / parentPoints.length,
          y: parentPoints.reduce((sum, item) => sum + item.y, 0) / parentPoints.length,
        };
      };
      const families = new Map();
      people.forEach((child) => {
        const parentIds = child.parents.filter((id) => nodes.current.has(id)).sort();
        if (!parentIds.length) return;
        const key = parentIds.join("--");
        if (!families.has(key)) families.set(key, { parentIds, children: [] });
        families.get(key).children.push(child.id);
      });
      const routes = [];
      families.forEach(({ parentIds, children }, familyId) => {
        const childPoints = children.map((childId) => point(childId, "bottom")).filter(Boolean).sort((first, second) => first.x - second.x);
        const from = parentOrigin(parentIds);
        if (!from || !childPoints.length) return;
        const nearestChildY = Math.max(...childPoints.map((item) => item.y));
        const firstChildX = childPoints[0].x;
        const lastChildX = childPoints[childPoints.length - 1].x;
        const safeReach = (GENERATION_GAP - CARD_HEIGHT) / 2;
        routes.push({
          id: familyId,
          parentIds,
          childIds: children,
          childPoints,
          from,
          firstChildX,
          lastChildX,
          baseJunctionY: nearestChildY + Math.min((from.y - nearestChildY) * .5, safeReach),
          minY: Math.min(from.y, nearestChildY) + 16,
          maxY: Math.max(from.y, nearestChildY) - 16,
          left: Math.min(firstChildX, from.x),
          right: Math.max(lastChildX, from.x),
          lane: 0,
        });
      });
      const orderedRoutes = routes.slice().sort((first, second) => first.left - second.left || first.from.x - second.from.x);
      orderedRoutes.forEach((route, routeIndex) => {
        const usedLanes = new Set();
        orderedRoutes.slice(0, routeIndex).forEach((previous) => {
          const sameLevel = Math.abs(previous.baseJunctionY - route.baseJunctionY) < 8;
          const overlaps = Math.min(previous.right, route.right) - Math.max(previous.left, route.left) > -8;
          const sharesParent = previous.parentIds.some((parentId) => route.parentIds.includes(parentId));
          if (sameLevel && (overlaps || sharesParent)) usedLanes.add(previous.lane);
        });
        while (usedLanes.has(route.lane)) route.lane += 1;
      });
      const laneOffset = (lane) => -8 - lane * 24;
      const next = orderedRoutes.map((route) => {
        const { id, childPoints, from, firstChildX, lastChildX } = route;
        const junctionY = Math.max(route.minY, Math.min(route.maxY, route.baseJunctionY + laneOffset(route.lane)));
        const segments = [`M ${from.x} ${from.y} V ${junctionY}`];
        if (childPoints.length > 1) segments.push(`M ${Math.min(firstChildX, from.x)} ${junctionY} H ${Math.max(lastChildX, from.x)}`);
        childPoints.forEach((childPoint) => segments.push(`M ${childPoint.x} ${junctionY} V ${childPoint.y}`));
        if (childPoints.length === 1 && firstChildX !== from.x) segments.push(`M ${from.x} ${junctionY} H ${firstChildX}`);
        const distant = (route.right - route.left) > CARD_WIDTH * 4.5;
        return { id, d: segments.join(" "), color: branchColor(id), nodeX: from.x, nodeY: junctionY, parentIds: route.parentIds, childIds: route.childIds, distant };
      });
      setPaths(next);

      const seenMarriages = new Set();
      const nextMarriages = [];
      people.forEach((person) => person.partnerIds.forEach((partnerId) => {
        const id = marriageKey(person.id, partnerId);
        if (seenMarriages.has(id)) return;
        seenMarriages.add(id);
        const partner = peopleById.get(partnerId);
        const first = box(person.id);
        const second = box(partnerId);
        if (!partner || !first || !second) return;
        const dx = second.centerX - first.centerX;
        const dy = second.centerY - first.centerY;
        let from;
        let to;
        let d;
        if (Math.abs(dx) >= Math.abs(dy)) {
          from = { x: dx >= 0 ? first.right : first.left, y: first.centerY };
          to = { x: dx >= 0 ? second.left : second.right, y: second.centerY };
          const midX = (from.x + to.x) / 2;
          d = `M ${from.x} ${from.y} H ${midX} V ${to.y} H ${to.x}`;
        } else {
          from = { x: first.centerX, y: dy >= 0 ? first.bottom : first.top };
          to = { x: second.centerX, y: dy >= 0 ? second.top : second.bottom };
          const midY = (from.y + to.y) / 2;
          d = `M ${from.x} ${from.y} V ${midY} H ${to.x} V ${to.y}`;
        }
        nextMarriages.push({
          id,
          d,
          color: branchColor(id),
          nodeX: (from.x + to.x) / 2,
          nodeY: (from.y + to.y) / 2,
          current: person.currentPartnerId === partnerId || partner.currentPartnerId === person.id,
          former: person.formerPartnerIds.includes(partnerId) || partner.formerPartnerIds.includes(person.id),
          people: [person.id, partnerId],
        });
      }));
      setMarriages(nextMarriages);
    };
    const frame = requestAnimationFrame(draw);
    const observer = new ResizeObserver(draw);
    if (stage.current) observer.observe(stage.current);
    nodes.current.forEach((node) => observer.observe(node));
    window.addEventListener("resize", draw);
    window.addEventListener("family-layout-change", draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", draw);
      window.removeEventListener("family-layout-change", draw);
    };
  }, [people, nodes, stage, scale]);
  const selectedPerson = selectedId ? people.find((person) => person.id === selectedId) : null;
  const flowIds = selectedPerson ? new Set([selectedPerson.id]) : null;
  return (
    <svg className="connections" aria-hidden="true">
      {marriages.map((marriage) => {
        const isFocused = flowIds && marriage.people.some((id) => flowIds.has(id));
        return (
          <g
            key={marriage.id}
            className={`marriage-connection ${marriage.current ? "is-current" : ""} ${marriage.former ? "is-former" : ""} ${flowIds && !isFocused ? "is-dimmed-line" : ""}`}
            style={{ "--branch-color": marriage.color }}
          >
            <path d={marriage.d} className="marriage-line"/>
            <circle cx={marriage.nodeX - 4} cy={marriage.nodeY} r="4.5"/>
            <circle cx={marriage.nodeX + 4} cy={marriage.nodeY} r="4.5"/>
          </g>
        );
      })}
      {paths.map((path) => {
        const isFlow = flowIds ? path.parentIds.some((id) => flowIds.has(id)) || (!selectedPerson.partnerIds.length && path.childIds.includes(selectedPerson.id)) : false;
        const isDim = flowIds ? !isFlow : false;
        const classes = [isFlow ? "is-flowing" : isDim ? "is-dimmed-line" : "", path.distant && !isFlow ? "is-distant" : ""].filter(Boolean).join(" ");
        return (
          <g key={path.id} className={classes} style={{ "--branch-color": path.color }}>
            <path d={path.d} className="parent-line"/>
            <circle className="branch-node" cx={path.nodeX} cy={path.nodeY} r="5"/>
          </g>
        );
      })}
    </svg>
  );
}

function App() {
  const initialLocalPeople = useRef(null);
  if (initialLocalPeople.current === null) {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      initialLocalPeople.current = Array.isArray(stored) ? normalizePeople(stored) : [];
    } catch { initialLocalPeople.current = []; }
  }
  const [people, setPeople] = useState(initialLocalPeople.current);
  const peopleRef = useRef(initialLocalPeople.current);
  const migrationStarted = useRef(false);
  const [authUser, setAuthUser] = useState(null);
  const [cloudState, setCloudState] = useState("loading");
  const [selectedId, setSelectedId] = useState(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [editor, setEditor] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [scale, setScale] = useState(1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const stageRef = useRef(null);
  const boardRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const selected = people.find((person) => person.id === selectedId) || null;
  const focusIds = selected ? new Set([
    selected.id,
    ...selected.partnerIds,
    ...people.filter((person) => person.parents.includes(selected.id)).map((person) => person.id),
    ...(selected.partnerIds.length ? [] : selected.parents),
  ]) : null;
  const ownerSignedIn = isOwnerUser(authUser);
  const migrationNeeded = cloudState === "empty" && initialLocalPeople.current.length > 0;
  const canManage = ownerSignedIn && cloudState !== "loading" && cloudState !== "error" && !migrationNeeded;

  useEffect(() => onAuthStateChanged(auth, setAuthUser), []);
  useEffect(() => subscribeToPeople((cloudPeople) => {
    if (!cloudPeople.length) {
      setCloudState("empty");
      return;
    }
    const normalized = normalizePeople(cloudPeople);
    peopleRef.current = normalized;
    setPeople(normalized);
    setCloudState("ready");
  }, () => {
    setCloudState("error");
    setNotice("Не удалось подключиться к общему древу");
  }), []);
  useEffect(() => {
    if (!ownerSignedIn || !migrationNeeded || migrationStarted.current) return;
    migrationStarted.current = true;
    syncPeople([], initialLocalPeople.current)
      .then(() => setNotice("Текущее древо перенесено в Firebase"))
      .catch((error) => {
        migrationStarted.current = false;
        setNotice(error.message || "Не удалось перенести древо в Firebase");
      });
  }, [ownerSignedIn, migrationNeeded]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
    } catch {
      setNotice("Хранилище браузера заполнено. Попробуйте фото меньшего размера.");
    }
  }, [people]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  const commitPeople = (createNext, successMessage) => {
    if (!canManage) {
      setNotice(ownerSignedIn ? "Дождитесь окончания синхронизации" : "Войдите как владелец");
      return peopleRef.current;
    }
    const previous = peopleRef.current;
    const next = normalizePeople(typeof createNext === "function" ? createNext(previous) : createNext);
    peopleRef.current = next;
    setPeople(next);
    syncPeople(previous, next)
      .then(() => setNotice(successMessage))
      .catch((error) => {
        peopleRef.current = previous;
        setPeople(previous);
        setNotice(error.message || "Изменения не сохранились");
      });
    return next;
  };
  const handleOwnerAccess = async () => {
    try {
      if (ownerSignedIn) {
        await signOutOwner();
        setNotice("Режим редактирования выключен");
        return;
      }
      const result = await signInOwner();
      if (!isOwnerUser(result.user)) {
        await signOutOwner();
        setNotice("Редактирование доступно только владельцу древа");
      } else {
        setNotice("Вход выполнен. Древо синхронизируется");
      }
    } catch (error) {
      if (error?.code !== "auth/popup-closed-by-user") setNotice("Не удалось войти через Google");
    }
  };

  const visiblePeople = people.filter((person) => person.name.toLowerCase().includes(query.trim().toLowerCase()));
  const familyLayout = buildHierarchyLayout(visiblePeople);
  const stageWidth = familyLayout.width;
  const register = (id, node) => node ? nodeRefs.current.set(id, node) : nodeRefs.current.delete(id);
  const hasManualLayout = people.some((person) => person.manualPositionVersion === MANUAL_POSITION_VERSION && Number.isFinite(person.manualX) && Number.isFinite(person.manualY));
  const handlePersonDrag = (id, x, y) => {
    commitPeople((current) => current.map((person) => person.id === id ? {
      ...person,
      manualX: x,
      manualY: y,
      manualPositionVersion: MANUAL_POSITION_VERSION,
    } : person), "Расположение сохранено");
  };
  const resetLayout = () => commitPeople((current) => current.map((person) => ({
    ...person,
    manualX: null,
    manualY: null,
    manualPositionVersion: 0,
  })), "Раскладка сброшена");
  const centerTree = (behavior = "smooth") => {
    const board = boardRef.current;
    if (board) board.scrollTo({ left: Math.max(0, (board.scrollWidth - board.clientWidth) / 2), top: 0, behavior });
  };
  const treeScale = () => {
    const board = boardRef.current;
    if (!board) return null;
    const widthScale = (board.clientWidth - 40) / stageWidth;
    const heightScale = (board.clientHeight - 40) / familyLayout.height;
    const fittedScale = Math.max(.08, Math.min(1, widthScale, heightScale));
    return +fittedScale.toFixed(2);
  };
  const fitTree = () => {
    const fittedScale = treeScale();
    if (fittedScale != null) setScale(fittedScale);
  };
  const didAutoFit = useRef(false);
  useEffect(() => {
    if (!people.length || didAutoFit.current) return;
    const board = boardRef.current;
    if (!board || !board.clientWidth) return;
    didAutoFit.current = true;
    const frame = requestAnimationFrame(() => {
      const fittedScale = treeScale();
      if (fittedScale != null) setScale(fittedScale);
    });
    return () => cancelAnimationFrame(frame);
  }, [people.length, stageWidth, familyLayout.height]);
  useEffect(() => { setSheetExpanded(false); }, [selectedId]);
  useEffect(() => {
    if (!people.length) return;
    const frame = requestAnimationFrame(() => centerTree("auto"));
    return () => cancelAnimationFrame(frame);
  }, [scale, stageWidth, people.length]);
  useEffect(() => {
    if (!selectedId) return;
    const frame = requestAnimationFrame(() => {
      const board = boardRef.current;
      const card = nodeRefs.current.get(selectedId);
      if (!board || !card) return;
      const boardRect = board.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const left = board.scrollLeft + cardRect.left + cardRect.width / 2 - boardRect.left - board.clientWidth / 2;
      board.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId]);
  const savePerson = (draft) => {
    const normalizedDraft = normalizePerson(draft);
    if (draft.id) {
      commitPeople((current) => {
        const previous = current.find((person) => person.id === draft.id);
        return current.map((person) => {
          if (person.id === normalizedDraft.id) return normalizedDraft;
          const wasPartner = previous?.partnerIds.includes(person.id);
          const isPartner = normalizedDraft.partnerIds.includes(person.id);
          if (isPartner) return {
            ...person,
            partnerIds: [...new Set([...person.partnerIds, normalizedDraft.id])],
            currentPartnerId: normalizedDraft.currentPartnerId === person.id ? normalizedDraft.id : (person.currentPartnerId === normalizedDraft.id ? "" : person.currentPartnerId),
            formerPartnerIds: normalizedDraft.formerPartnerIds.includes(person.id) ? [...new Set([...person.formerPartnerIds, normalizedDraft.id])] : person.formerPartnerIds.filter((id) => id !== normalizedDraft.id),
            generation: normalizedDraft.generation,
          };
          if (wasPartner) return { ...person, partnerIds: person.partnerIds.filter((id) => id !== normalizedDraft.id), currentPartnerId: person.currentPartnerId === normalizedDraft.id ? "" : person.currentPartnerId, formerPartnerIds: person.formerPartnerIds.filter((id) => id !== normalizedDraft.id) };
          return person;
        });
      }, "Запись сохранена в общем древе");
      setSelectedId(normalizedDraft.id);
    } else {
      const created = { ...normalizedDraft, id: `person-${Date.now()}` };
      commitPeople((current) => [...current.map((person) => created.partnerIds.includes(person.id) ? {
        ...person,
        partnerIds: [...new Set([...person.partnerIds, created.id])],
        currentPartnerId: created.currentPartnerId === person.id ? created.id : person.currentPartnerId,
        formerPartnerIds: created.formerPartnerIds.includes(person.id) ? [...new Set([...person.formerPartnerIds, created.id])] : person.formerPartnerIds,
        generation: created.generation,
      } : person), created], "Человек добавлен в общее древо");
      setSelectedId(created.id);
    }
    setEditor(false);
  };
  const movePerson = (id, direction) => {
    const card = familyLayout.cards.find((item) => item.person.id === id);
    if (!card) return;
    const step = 40;
    const offset = {
      left: [-step, 0],
      right: [step, 0],
      up: [0, -step],
      down: [0, step],
    }[direction];
    if (!offset) return;
    commitPeople((current) => {
      return current.map((person) => person.id === id ? {
        ...person,
        manualX: Math.max(0, card.x + offset[0]),
        manualY: Math.max(0, card.y + offset[1]),
        manualPositionVersion: MANUAL_POSITION_VERSION,
      } : person);
    }, "Расположение карточки изменено");
  };
  const deletePerson = () => {
    if (!deleteCandidate) return;
    const id = deleteCandidate.id;
    commitPeople((current) => current
      .filter((person) => person.id !== id)
      .map((person) => ({
        ...person,
        parents: person.parents.filter((parentId) => parentId !== id),
        partnerIds: person.partnerIds.filter((partnerId) => partnerId !== id),
        currentPartnerId: person.currentPartnerId === id ? "" : person.currentPartnerId,
        formerPartnerIds: person.formerPartnerIds.filter((partnerId) => partnerId !== id),
      })), "Человек удалён из общего древа");
    setSelectedId(null);
    setDeleteCandidate(null);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#tree" aria-label="Истоки — на главную"><span className="tree-rings" aria-hidden="true"><i/><i/><i/><i/></span><span>Истоки</span></a>
        <nav aria-label="Основная навигация">
          <button className="nav-item active"><Icon name="tree"/><span>Древо</span></button>
          <button className="nav-item" onClick={() => setNotice("Раздел семьи появится на следующем этапе")}><Icon name="users"/><span>Семья</span></button>
          <button className="nav-item" onClick={() => setNotice("Источники добавим вместе с документами")}><Icon name="book"/><span>Источники</span></button>
        </nav>
        <div className="header-actions">
          {searchOpen && <input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти человека" aria-label="Найти человека" autoFocus />}
          {canManage && <button className="button primary add-button" onClick={() => setEditor("new")}><Icon name="plus"/><span>Добавить человека</span></button>}
          <button className="icon-button" onClick={() => { setSearchOpen((open) => !open); setQuery(""); }} aria-label="Поиск"><Icon name={searchOpen ? "close" : "search"}/></button>
          <button className={`cloud-login-button ${ownerSignedIn ? "is-owner" : ""}`} onClick={handleOwnerAccess} title={ownerSignedIn ? "Выйти из режима редактирования" : "Войти владельцу"}><Icon name="cloud" size={18}/><span>{ownerSignedIn ? cloudState === "ready" ? "Общее древо" : "Синхронизация…" : "Войти"}</span></button>
        </div>
      </header>

      <main id="tree" className="workspace">
        <section className={`tree-area ${selected ? "has-detail" : ""}`} aria-label="Семейное древо">
          <div className="canvas-heading">
            <div><h1>Семейное древо</h1><p>Начните с самых дальних известных предков</p></div>
            <div className="zoom-controls" aria-label="Масштаб">
              <button onClick={() => setScale((value) => Math.max(.08, +(value - .1).toFixed(2)))} aria-label="Уменьшить">−</button>
              <output>{Math.round(scale * 100)}%</output>
              <button onClick={() => setScale((value) => Math.min(1.25, +(value + .1).toFixed(2)))} aria-label="Увеличить">+</button>
              <button className="center-button" onClick={fitTree}><Icon name="target" size={18}/>Вместить древо</button>
              {canManage && hasManualLayout && <button className="center-button" onClick={resetLayout} title="Вернуть автоматическую раскладку">Сбросить раскладку</button>}
            </div>
          </div>

          <div className="tree-board" ref={boardRef} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
            <div className="tree-scaler" style={{ width: `${stageWidth * scale}px`, minWidth: `${stageWidth * scale}px`, minHeight: `${familyLayout.height * scale}px` }} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
              <div className="tree-stage" ref={stageRef} style={{ width: `${stageWidth}px`, minWidth: `${stageWidth}px`, height: `${familyLayout.height}px`, transform: `scale(${scale})` }} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
                {people.length === 0 ? (
                  <div className="empty-tree">
                    <span className="empty-rings" aria-hidden="true"><i/><i/><i/></span>
                    <h2>Начните с корней</h2>
                    <p>Добавьте самого дальнего известного предка. От него постепенно вырастут ветви вашей семьи.</p>
                    {canManage ? <button className="button primary" onClick={() => setEditor("new")}><Icon name="plus"/>Добавить первого предка</button> : <button className="button ghost" onClick={handleOwnerAccess}><Icon name="cloud"/>Войти владельцу</button>}
                  </div>
                ) : <>
                {familyLayout.clusters.map((cluster) => (
                  <div
                    className="family-cluster"
                    key={cluster.id}
                    style={{
                      "--family-color": branchColor(cluster.id),
                      left: `${cluster.x - 14}px`,
                      top: `${cluster.y - 14}px`,
                      width: `${cluster.width + 28}px`,
                      height: `${cluster.height + 28}px`,
                    }}
                    aria-hidden="true"
                  >
                    <span>Семья</span>
                  </div>
                ))}
                {familyLayout.generations.map((row) => (
                  <div className="generation-guide" key={row.generation} style={{ top: `${row.y - 24}px` }} aria-hidden="true">
                    <span>{generationLabel(row.generation)}</span>
                  </div>
                ))}
                <TreeConnections people={visiblePeople} nodes={nodeRefs} stage={stageRef} scale={scale} selectedId={selectedId}/>
                {familyLayout.cards.map((card) => <PositionedPerson key={card.person.id} card={card} selectedId={selectedId} focusIds={focusIds} onSelect={setSelectedId} register={register} canManage={canManage} scale={scale} onDragEnd={handlePersonDrag}/>)}
                {!visiblePeople.length && <div className="no-results">Никого не нашли. Попробуйте изменить запрос.</div>}
                </>}
              </div>
            </div>
          </div>
        </section>

        <DetailPanel person={selected} people={people} canEdit={canManage} expanded={sheetExpanded} onToggleExpand={() => setSheetExpanded((value) => !value)} onClose={() => setSelectedId(null)} onEdit={() => setEditor(selected)} onDelete={() => setDeleteCandidate(selected)} onSelect={setSelectedId} onMove={(direction) => movePerson(selected.id, direction)}/>
      </main>
      {editor && <PersonEditor person={editor === "new" ? null : editor} people={people} onSave={savePerson} onClose={() => setEditor(false)}/>}
      {deleteCandidate && <ConfirmDelete person={deleteCandidate} onConfirm={deletePerson} onClose={() => setDeleteCandidate(null)}/>}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
