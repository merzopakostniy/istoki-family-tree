import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { onAuthStateChanged } from "firebase/auth";
import { generationMeta } from "./data";
import { auth, isOwnerUser, signInOwner, signOutOwner, subscribeToPeople, syncPeople } from "./firebase";
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
    birthplace: clean.birthplace || "",
    deathplace: clean.deathplace || "",
    maidenName: clean.maidenName || "",
    manualGeneration: Boolean(clean.manualGeneration),
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

function groupPartnerUnits(people) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const seen = new Set();
  const units = [];
  people.forEach((person) => {
    if (seen.has(person.id)) return;
    const component = [];
    const queue = [person];
    while (queue.length) {
      const current = queue.shift();
      if (!current || seen.has(current.id)) continue;
      seen.add(current.id);
      component.push(current);
      current.partnerIds.forEach((id) => { if (byId.has(id) && !seen.has(id)) queue.push(byId.get(id)); });
    }
    if (component.length < 3) {
      units.push(component);
      return;
    }
    const anchor = component.reduce((best, item) => item.partnerIds.length > best.partnerIds.length ? item : best, component[0]);
    const partners = component.filter((item) => anchor.partnerIds.includes(item.id));
    const remaining = component.filter((item) => item.id !== anchor.id && !anchor.partnerIds.includes(item.id));
    units.push([partners[0], anchor, ...partners.slice(1), ...remaining].filter(Boolean));
  });
  return units;
}

function arePartners(first, second) {
  return first.partnerIds.includes(second.id) || second.partnerIds.includes(first.id);
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
        {(person.maidenName || person.relation) && <small>{[person.maidenName ? `урожд. ${person.maidenName}` : "", person.relation].filter(Boolean).join(" · ")}</small>}
      </span>
    </button>
  );
}

const CARD_WIDTH = 258;
const CARD_HEIGHT = 118;
const PARTNER_CONNECTOR_WIDTH = 42;
const SIBLING_GAP = 44;
const MARRIAGE_BRANCH_GAP = 104;
const ROOT_FAMILY_GAP = 84;
const STAGE_PADDING = 56;
const EMPTY_STAGE_HEIGHT = 770;
const STAGE_TOP = 28;
const STAGE_BOTTOM = 54;
const GENERATION_GAP = 190;
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
  if (!people.length) return { units: [], width: 940, height: EMPTY_STAGE_HEIGHT };
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

  const branchPosition = (parentUnit, childUnit) => {
    const parentIndex = new Map(parentUnit.people.map((person, index) => [person.id, index]));
    const positions = childUnit.people.flatMap((person) => person.parents.map((id) => parentIndex.get(id)).filter(Number.isFinite));
    return positions.length ? positions.reduce((sum, value) => sum + value, 0) / positions.length : parentUnit.people.length / 2;
  };
  const childGap = (first, second) => first.primaryMarriageKey && first.primaryMarriageKey === second.primaryMarriageKey ? SIBLING_GAP : MARRIAGE_BRANCH_GAP;
  units.forEach((unit) => unit.children.sort((first, second) => branchPosition(unit, first) - branchPosition(unit, second) || first.order - second.order));

  const measuring = new Set();
  const measure = (unit) => {
    if (unit.subtreeWidth) return unit.subtreeWidth;
    if (measuring.has(unit.id)) return unit.width;
    measuring.add(unit.id);
    const descendantsWidth = unit.children.reduce((sum, child, index) => sum + measure(child) + (index ? childGap(unit.children[index - 1], child) : 0), 0);
    unit.subtreeWidth = Math.max(unit.width, descendantsWidth);
    measuring.delete(unit.id);
    return unit.subtreeWidth;
  };
  const placed = new Set();
  const place = (unit, left) => {
    if (placed.has(unit.id)) return;
    placed.add(unit.id);
    unit.x = left + (unit.subtreeWidth - unit.width) / 2;
    const descendantsWidth = unit.children.reduce((sum, child, index) => sum + child.subtreeWidth + (index ? childGap(unit.children[index - 1], child) : 0), 0);
    let childLeft = left + (unit.subtreeWidth - descendantsWidth) / 2;
    unit.children.forEach((child, index) => {
      if (index) childLeft += childGap(unit.children[index - 1], child);
      place(child, childLeft);
      childLeft += child.subtreeWidth;
    });
  };

  const topRootOf = (unit) => {
    let current = unit;
    const seen = new Set();
    while (current.primaryParentId && !seen.has(current.id)) {
      seen.add(current.id);
      const parent = unitById.get(current.primaryParentId);
      if (!parent) break;
      current = parent;
    }
    return current;
  };
  const roots = units.filter((unit) => !unit.primaryParentId).sort((first, second) => first.order - second.order);
  const satelliteTrunk = new Map();
  roots.forEach((root) => {
    if (root.children.length) return;
    const memberIds = new Set(root.people.map((person) => person.id));
    const linkedPerson = people.find((person) => !memberIds.has(person.id) && person.parents.some((parentId) => memberIds.has(parentId)));
    const linkedUnit = linkedPerson && unitByPersonId.get(linkedPerson.id);
    if (linkedUnit && linkedUnit.id !== root.id) satelliteTrunk.set(root.id, topRootOf(linkedUnit));
  });
  const trunkRoots = roots.filter((root) => !satelliteTrunk.has(root.id));
  const satellitesByTrunk = new Map();
  roots.forEach((root) => {
    const trunk = satelliteTrunk.get(root.id);
    if (!trunk) return;
    if (!satellitesByTrunk.has(trunk.id)) satellitesByTrunk.set(trunk.id, []);
    satellitesByTrunk.get(trunk.id).push(root);
  });
  const orderedRoots = [];
  trunkRoots.forEach((trunk) => {
    orderedRoots.push(trunk);
    (satellitesByTrunk.get(trunk.id) || []).forEach((satellite) => orderedRoots.push(satellite));
  });
  const orderedIds = new Set(orderedRoots.map((root) => root.id));
  roots.forEach((root) => { if (!orderedIds.has(root.id)) orderedRoots.push(root); });
  orderedRoots.forEach(measure);
  let cursor = STAGE_PADDING;
  orderedRoots.forEach((root) => {
    place(root, cursor);
    cursor += root.subtreeWidth + ROOT_FAMILY_GAP;
  });
  units.filter((unit) => !placed.has(unit.id)).forEach((unit) => {
    measure(unit);
    place(unit, cursor);
    cursor += unit.subtreeWidth + ROOT_FAMILY_GAP;
  });
  const height = STAGE_TOP + (highestGeneration - lowestGeneration) * GENERATION_GAP + CARD_HEIGHT + STAGE_BOTTOM;
  return { units, width: Math.max(940, cursor - ROOT_FAMILY_GAP + STAGE_PADDING), height: Math.max(300, height) };
}

function generationLabel(generation) {
  return generationMeta.find((item) => item.id === generation)?.label || `Поколение ${generation + 1}`;
}

function FamilyUnit({ unit, selectedId, focusIds, onSelect, register }) {
  const anchor = unit.people.reduce((best, person) => person.partnerIds.length > best.partnerIds.length ? person : best, unit.people[0]);
  const anchorIndex = unit.people.findIndex((person) => person.id === anchor.id);
  const extraMarriages = anchor.partnerIds
    .map((partnerId) => unit.people.findIndex((person) => person.id === partnerId))
    .filter((partnerIndex) => partnerIndex >= 0 && Math.abs(partnerIndex - anchorIndex) > 1);
  const cardCenter = (index) => index * (CARD_WIDTH + PARTNER_CONNECTOR_WIDTH) + CARD_WIDTH / 2;
  const gapCenter = (leftIndex) => leftIndex * (CARD_WIDTH + PARTNER_CONNECTOR_WIDTH) + CARD_WIDTH + PARTNER_CONNECTOR_WIDTH / 2;
  const unitColor = branchColor(unit.primaryMarriageKey || unit.id);
  return (
    <div
      className={`family-unit positioned-family ${unit.people.length > 1 ? "partner-pair" : "single-person"} ${extraMarriages.length ? "multi-spouse-unit" : ""}`}
      style={{ left: `${unit.x}px`, top: `${unit.y}px`, "--family-color": unitColor }}
      data-family={unit.id}
    >
      {extraMarriages.length ? <svg className="marriage-rails" viewBox={`0 0 ${unit.width} ${CARD_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        {extraMarriages.map((partnerIndex) => {
          const anchorX = cardCenter(anchorIndex);
          const partnerX = cardCenter(partnerIndex);
          const lowIndex = Math.min(anchorIndex, partnerIndex);
          const highIndex = Math.max(anchorIndex, partnerIndex);
          const gaps = [];
          for (let index = lowIndex; index < highIndex; index += 1) gaps.push(gapCenter(index));
          const partner = unit.people[partnerIndex];
          return <g key={partner.id} className="marriage-rail" style={{ "--family-color": branchColor(marriageKey(anchor.id, partner.id)) }}>
            <path d={`M ${anchorX} ${CARD_HEIGHT / 2} H ${partnerX}`}/>
            {gaps.map((gapX) => <React.Fragment key={gapX}>
              <circle cx={gapX - 4} cy={CARD_HEIGHT / 2} r="4.5"/>
              <circle cx={gapX + 4} cy={CARD_HEIGHT / 2} r="4.5"/>
            </React.Fragment>)}
          </g>;
        })}
      </svg> : null}
      {unit.people.map((person, index) => <React.Fragment key={person.id}>
        {index > 0 ? arePartners(unit.people[index - 1], person) ? <span className="partner-connector" style={{ "--family-color": branchColor(marriageKey(unit.people[index - 1].id, person.id)) }} role="img" aria-label="Супруги"><i/><i/></span> : <span className="partner-spacer"/> : null}
        <PersonCard person={person} selected={person.id === selectedId} focus={focusIds ? (focusIds.has(person.id) ? (person.id === selectedId ? "" : "on") : "dim") : ""} onSelect={onSelect} register={register}/>
      </React.Fragment>)}
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
        <p>Супруги перемещаются вместе.</p>
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
    parents: [], partnerIds: [], birthplace: "", deathplace: "", maidenName: "", note: "",
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
      return { ...current, partnerIds, generation: generations.length ? Math.max(...generations) : current.generation };
    });
  };
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
            <legend>Супруги и супруги</legend>
            <div className="spouse-options">
              {people.filter((item) => item.id !== person?.id).map((item) => <label className="spouse-option" key={item.id}><input type="checkbox" checked={form.partnerIds.includes(item.id)} onChange={(e) => togglePartner(item.id, e.target.checked)}/><span>{item.name}</span></label>)}
              {people.filter((item) => item.id !== person?.id).length === 0 ? <span className="empty-spouse-copy">Сначала добавьте второго человека</span> : null}
            </div>
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
  useLayoutEffect(() => {
    const draw = () => {
      const stageNode = stage.current;
      if (!stageNode) return;
      const base = stageNode.getBoundingClientRect();
      const point = (id, side) => {
        const rect = nodes.current.get(id)?.getBoundingClientRect();
        if (!rect) return null;
        return {
          x: (rect.left - base.left + rect.width / 2) / scale,
          y: (side === "top" ? rect.top - base.top : side === "center" ? rect.top - base.top + rect.height / 2 : rect.bottom - base.top) / scale,
        };
      };
      const parentOrigin = (parentIds) => {
        if (parentIds.length === 1) return point(parentIds[0], "top");
        const parentPeople = parentIds.map((id) => people.find((person) => person.id === id)).filter(Boolean);
        const anchor = parentPeople.reduce((best, person) => person.partnerIds.length > best.partnerIds.length ? person : best, parentPeople[0]);
        const partner = parentPeople.find((person) => person.id !== anchor?.id);
        const anchorRect = anchor ? nodes.current.get(anchor.id)?.getBoundingClientRect() : null;
        const partnerRect = partner ? nodes.current.get(partner.id)?.getBoundingClientRect() : null;
        if (anchorRect && partnerRect && anchor.partnerIds.length > 2) {
          const anchorCenter = anchorRect.left + anchorRect.width / 2;
          const partnerCenter = partnerRect.left + partnerRect.width / 2;
          const adjacentLimit = (anchorRect.width + partnerRect.width) / 2 + PARTNER_CONNECTOR_WIDTH * scale * 1.5;
          if (Math.abs(anchorCenter - partnerCenter) > adjacentLimit) {
            return point(partner.id, "top");
          }
        }
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
    };
    const frame = requestAnimationFrame(draw);
    const observer = new ResizeObserver(draw);
    if (stage.current) observer.observe(stage.current);
    nodes.current.forEach((node) => observer.observe(node));
    window.addEventListener("resize", draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", draw); };
  }, [people, nodes, stage, scale]);
  const selectedPerson = selectedId ? people.find((person) => person.id === selectedId) : null;
  const flowIds = selectedPerson ? new Set([selectedPerson.id]) : null;
  return (
    <svg className="connections" aria-hidden="true">
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
  const familyLayout = buildFamilyLayout(visiblePeople);
  const stageWidth = familyLayout.width;
  const register = (id, node) => node ? nodeRefs.current.set(id, node) : nodeRefs.current.delete(id);
  const centerTree = (behavior = "smooth") => {
    const board = boardRef.current;
    if (board) board.scrollTo({ left: Math.max(0, (board.scrollWidth - board.clientWidth) / 2), top: 0, behavior });
  };
  const fitTree = () => {
    const board = boardRef.current;
    if (!board) return;
    const widthScale = (board.clientWidth - 40) / stageWidth;
    const heightScale = (board.clientHeight - 40) / familyLayout.height;
    const fittedScale = Math.max(.08, Math.min(1, widthScale, heightScale));
    setScale(+fittedScale.toFixed(2));
  };
  const didAutoFit = useRef(false);
  useEffect(() => {
    if (!people.length || didAutoFit.current) return;
    const board = boardRef.current;
    if (!board || !board.clientWidth) return;
    didAutoFit.current = true;
    const frame = requestAnimationFrame(() => fitTree());
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
  }, [selectedId, people]);
  const savePerson = (draft) => {
    const normalizedDraft = normalizePerson(draft);
    if (draft.id) {
      commitPeople((current) => {
        const previous = current.find((person) => person.id === draft.id);
        return current.map((person) => {
          if (person.id === normalizedDraft.id) return normalizedDraft;
          const wasPartner = previous?.partnerIds.includes(person.id);
          const isPartner = normalizedDraft.partnerIds.includes(person.id);
          if (isPartner) return { ...person, partnerIds: [...new Set([...person.partnerIds, normalizedDraft.id])], generation: normalizedDraft.generation };
          if (wasPartner) return { ...person, partnerIds: person.partnerIds.filter((id) => id !== normalizedDraft.id) };
          return person;
        });
      }, "Запись сохранена в общем древе");
      setSelectedId(normalizedDraft.id);
    } else {
      const created = { ...normalizedDraft, id: `person-${Date.now()}` };
      commitPeople((current) => [...current.map((person) => created.partnerIds.includes(person.id) ? { ...person, partnerIds: [...new Set([...person.partnerIds, created.id])], generation: created.generation } : person), created], "Человек добавлен в общее древо");
      setSelectedId(created.id);
    }
    setEditor(false);
  };
  const movePerson = (id, direction) => {
    commitPeople((current) => {
      const person = current.find((item) => item.id === id);
      if (!person) return current;
      const byId = new Map(current.map((item) => [item.id, item]));
      const familyIds = new Set();
      const queue = [person.id];
      while (queue.length) {
        const familyId = queue.shift();
        if (familyIds.has(familyId)) continue;
        familyIds.add(familyId);
        byId.get(familyId)?.partnerIds.forEach((partnerId) => { if (!familyIds.has(partnerId)) queue.push(partnerId); });
      }

      if (direction === "up" || direction === "down") {
        const step = direction === "up" ? 1 : -1;
        const generation = Math.max(0, person.generation + step);
        if (generation === person.generation) return current;
        return current.map((item) => familyIds.has(item.id) ? { ...item, generation, manualGeneration: true } : item);
      }

      const row = current.filter((item) => item.generation === person.generation);
      const units = groupPartnerUnits(row);
      const unitIndex = units.findIndex((unit) => unit.some((item) => familyIds.has(item.id)));
      const nextIndex = direction === "left" ? unitIndex - 1 : unitIndex + 1;
      if (unitIndex < 0 || nextIndex < 0 || nextIndex >= units.length) return current;
      [units[unitIndex], units[nextIndex]] = [units[nextIndex], units[unitIndex]];
      const reordered = units.flat();
      let rowIndex = 0;
      return current.map((item) => item.generation === person.generation ? reordered[rowIndex++] : item);
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
                <TreeConnections people={visiblePeople} nodes={nodeRefs} stage={stageRef} scale={scale} selectedId={selectedId}/>
                {familyLayout.units.map((unit) => <FamilyUnit key={unit.id} unit={unit} selectedId={selectedId} focusIds={focusIds} onSelect={setSelectedId} register={register}/>)}
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
