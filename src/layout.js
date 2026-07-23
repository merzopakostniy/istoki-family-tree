export const CARD_WIDTH = 258;
export const CARD_HEIGHT = 134;
export const COUPLE_GAP = 34;
export const GENERATION_GAP = 224;
export const STAGE_PADDING = 72;
export const STAGE_TOP = 52;
export const STAGE_BOTTOM = 82;
export const EMPTY_STAGE_HEIGHT = 770;
export const MANUAL_POSITION_VERSION = 2;

const SIBLING_UNIT_GAP = 30;
const BRANCH_UNIT_GAP = 68;
const MIN_STAGE_WIDTH = 940;

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function sameParentBranch(first, second) {
  return Boolean(first.primaryParentKey && first.primaryParentKey === second.primaryParentKey);
}

function gapBetween(first, second) {
  return sameParentBranch(first, second) ? SIBLING_UNIT_GAP : BRANCH_UNIT_GAP;
}

function createUnits(people) {
  const sourceOrder = new Map(people.map((person, index) => [person.id, index]));
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const parentBranchSize = new Map();
  people.forEach((person) => {
    const key = [...person.parents].sort().join("--");
    if (key) parentBranchSize.set(key, (parentBranchSize.get(key) || 0) + 1);
  });
  const assigned = new Set();
  const units = [];

  people.forEach((person) => {
    if (assigned.has(person.id)) return;
    const component = [];
    const queue = [person];
    const componentIds = new Set();
    while (queue.length) {
      const member = queue.shift();
      if (!member || componentIds.has(member.id) || assigned.has(member.id) || member.generation !== person.generation) continue;
      componentIds.add(member.id);
      component.push(member);
      member.partnerIds.forEach((partnerId) => {
        const partner = peopleById.get(partnerId);
        if (partner && !componentIds.has(partner.id) && !assigned.has(partner.id)) queue.push(partner);
      });
    }
    const anchor = component.reduce((best, member) => {
      if (member.partnerIds.length !== best.partnerIds.length) return member.partnerIds.length > best.partnerIds.length ? member : best;
      return (sourceOrder.get(member.id) ?? 0) < (sourceOrder.get(best.id) ?? 0) ? member : best;
    }, component[0]);
    const currentPartner = component.find((member) => member.id === anchor.currentPartnerId || member.currentPartnerId === anchor.id);
    const remaining = component
      .filter((member) => member.id !== anchor.id && member.id !== currentPartner?.id)
      .sort((first, second) => (sourceOrder.get(first.id) ?? 0) - (sourceOrder.get(second.id) ?? 0));
    const members = [anchor, currentPartner, ...remaining].filter(Boolean);
    members.forEach((member) => assigned.add(member.id));
    const primaryMember = members
      .filter((member) => member.parents.length)
      .sort((first, second) => {
        const firstKey = [...first.parents].sort().join("--");
        const secondKey = [...second.parents].sort().join("--");
        const branchDifference = (parentBranchSize.get(secondKey) || 0) - (parentBranchSize.get(firstKey) || 0);
        if (branchDifference) return branchDifference;
        if (first.id === anchor.id) return -1;
        if (second.id === anchor.id) return 1;
        return (sourceOrder.get(first.id) ?? 0) - (sourceOrder.get(second.id) ?? 0);
      })[0];
    const primaryParents = primaryMember?.parents || [];
    units.push({
      id: members.map((member) => member.id).sort().join("--"),
      people: members,
      generation: person.generation,
      width: members.length * CARD_WIDTH + Math.max(0, members.length - 1) * COUPLE_GAP,
      order: Math.min(...members.map((member) => sourceOrder.get(member.id) ?? 0)),
      primaryParentKey: [...primaryParents].sort().join("--"),
      parents: new Set(),
      children: new Set(),
      partners: new Set(),
      x: 0,
      y: 0,
    });
  });

  const unitByPersonId = new Map();
  units.forEach((unit) => unit.people.forEach((person) => unitByPersonId.set(person.id, unit)));
  units.forEach((unit) => {
    unit.people.forEach((person) => {
      person.parents.forEach((parentId) => {
        const parentUnit = unitByPersonId.get(parentId);
        if (!parentUnit || parentUnit.id === unit.id) return;
        unit.parents.add(parentUnit.id);
        parentUnit.children.add(unit.id);
      });
      person.partnerIds.forEach((partnerId) => {
        const partnerUnit = unitByPersonId.get(partnerId);
        if (!partnerUnit || partnerUnit.id === unit.id) return;
        unit.partners.add(partnerUnit.id);
        partnerUnit.partners.add(unit.id);
      });
    });
  });

  return { units, unitByPersonId };
}

function branchBlocks(row) {
  const grouped = new Map();
  row.forEach((unit) => {
    const key = unit.primaryParentKey ? `family:${unit.primaryParentKey}` : `unit:${unit.id}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(unit);
  });
  return [...grouped.values()].map((units) => units.sort((first, second) => first.order - second.order));
}

function orderRows(rows, unitById, generations) {
  const rank = new Map();
  const updateRanks = () => rows.forEach((row) => row.forEach((unit, index) => rank.set(unit.id, index)));
  updateRanks();

  const targetFor = (unit, direction) => {
    const ids = direction === "parents" ? unit.parents : unit.children;
    const structural = [...ids].map((id) => rank.get(id)).filter(Number.isFinite);
    const spouse = [...unit.partners].map((id) => rank.get(id)).filter(Number.isFinite);
    return median([...structural, ...spouse.map((value) => value * .35 + (rank.get(unit.id) ?? 0) * .65)]);
  };
  const sortRow = (row, direction) => {
    const blocks = branchBlocks(row);
    blocks.sort((first, second) => {
      const firstTarget = average(first.map((unit) => targetFor(unit, direction)).filter(Number.isFinite));
      const secondTarget = average(second.map((unit) => targetFor(unit, direction)).filter(Number.isFinite));
      if (firstTarget != null && secondTarget != null && Math.abs(firstTarget - secondTarget) > .001) return firstTarget - secondTarget;
      if (firstTarget != null && secondTarget == null) return -1;
      if (firstTarget == null && secondTarget != null) return 1;
      return Math.min(...first.map((unit) => unit.order)) - Math.min(...second.map((unit) => unit.order));
    });
    row.splice(0, row.length, ...blocks.flat());
  };

  for (let pass = 0; pass < 10; pass += 1) {
    for (let index = 1; index < generations.length; index += 1) {
      sortRow(rows.get(generations[index]), "children");
      updateRanks();
    }
    for (let index = generations.length - 2; index >= 0; index -= 1) {
      sortRow(rows.get(generations[index]), "parents");
      updateRanks();
    }
  }
}

function compactRows(rows, unitById, generations) {
  rows.forEach((row) => {
    let cursor = 0;
    row.forEach((unit, index) => {
      if (index) cursor += gapBetween(row[index - 1], unit);
      unit.x = cursor;
      cursor += unit.width;
    });
    const centre = cursor / 2;
    row.forEach((unit) => { unit.x -= centre; });
  });

  const neighbourCentres = (unit) => {
    const structural = [...unit.parents, ...unit.children]
      .map((id) => unitById.get(id))
      .filter(Boolean)
      .map((item) => item.x + item.width / 2);
    const partners = [...unit.partners]
      .map((id) => unitById.get(id))
      .filter(Boolean)
      .map((item) => item.x + item.width / 2);
    return [...structural, ...partners.map((value) => value * .45 + (unit.x + unit.width / 2) * .55)];
  };

  for (let pass = 0; pass < 18; pass += 1) {
    const direction = pass % 2 ? [...generations].reverse() : generations;
    direction.forEach((generation) => {
      const row = rows.get(generation);
      const targets = row.map((unit) => average(neighbourCentres(unit)) ?? (unit.x + unit.width / 2));
      for (let index = 0; index < row.length; index += 1) {
        const desiredLeft = targets[index] - row[index].width / 2;
        const minimumLeft = index ? row[index - 1].x + row[index - 1].width + gapBetween(row[index - 1], row[index]) : -Infinity;
        row[index].x = Math.max(desiredLeft, minimumLeft);
      }
      for (let index = row.length - 2; index >= 0; index -= 1) {
        const maximumLeft = row[index + 1].x - gapBetween(row[index], row[index + 1]) - row[index].width;
        row[index].x = Math.min(row[index].x, maximumLeft);
      }
      const correction = average(row.map((unit, index) => targets[index] - (unit.x + unit.width / 2))) || 0;
      row.forEach((unit) => { unit.x += correction; });
    });
  }
}

function removeHorizontalDrift(rows, unitById, generations) {
  rows.forEach((row) => {
    const previousCentre = average(row.map((unit) => unit.x + unit.width / 2)) || 0;
    let cursor = 0;
    row.forEach((unit, index) => {
      if (index) cursor += gapBetween(row[index - 1], unit);
      unit.x = cursor;
      cursor += unit.width;
    });
    const packedCentre = average(row.map((unit) => unit.x + unit.width / 2)) || 0;
    row.forEach((unit) => { unit.x += previousCentre - packedCentre; });
  });

  for (let pass = 0; pass < 12; pass += 1) {
    const shifts = new Map();
    generations.forEach((generation) => {
      const row = rows.get(generation);
      const deltas = [];
      row.forEach((unit) => {
        const centre = unit.x + unit.width / 2;
        [...unit.parents, ...unit.children].forEach((id) => {
          const neighbour = unitById.get(id);
          if (neighbour) deltas.push(neighbour.x + neighbour.width / 2 - centre);
        });
      });
      shifts.set(generation, median(deltas) || 0);
    });
    generations.forEach((generation) => {
      const delta = shifts.get(generation) * .55;
      rows.get(generation).forEach((unit) => { unit.x += delta; });
    });
  }
}

export function buildFamilyLayout(people) {
  if (!people.length) {
    return { units: [], cards: [], clusters: [], generations: [], width: MIN_STAGE_WIDTH, height: EMPTY_STAGE_HEIGHT };
  }

  const { units } = createUnits(people);
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const generationNumbers = [...new Set(units.map((unit) => unit.generation))].sort((first, second) => first - second);
  const highestGeneration = Math.max(...generationNumbers);
  const lowestGeneration = Math.min(...generationNumbers);
  const rows = new Map(generationNumbers.map((generation) => [
    generation,
    units.filter((unit) => unit.generation === generation).sort((first, second) => first.order - second.order),
  ]));

  orderRows(rows, unitById, generationNumbers);
  compactRows(rows, unitById, generationNumbers);
  removeHorizontalDrift(rows, unitById, generationNumbers);

  let minimumAutoX = Infinity;
  units.forEach((unit) => { minimumAutoX = Math.min(minimumAutoX, unit.x); });
  const normaliseX = STAGE_PADDING - minimumAutoX;
  units.forEach((unit) => {
    unit.x += normaliseX;
    unit.y = STAGE_TOP + (highestGeneration - unit.generation) * GENERATION_GAP;
  });

  const cards = [];
  units.forEach((unit) => unit.people.forEach((person, index) => {
    const hasCurrentManualPosition = person.manualPositionVersion === MANUAL_POSITION_VERSION
      && Number.isFinite(person.manualX)
      && Number.isFinite(person.manualY);
    cards.push({
      person,
      unitId: unit.id,
      x: hasCurrentManualPosition ? person.manualX : unit.x + index * (CARD_WIDTH + COUPLE_GAP),
      y: hasCurrentManualPosition ? person.manualY : unit.y,
    });
  }));

  const contentRight = Math.max(...cards.map((card) => card.x + CARD_WIDTH), ...units.map((unit) => unit.x + unit.width));
  const contentBottom = Math.max(...cards.map((card) => card.y + CARD_HEIGHT));
  const cardByPersonId = new Map(cards.map((card) => [card.person.id, card]));
  const clusters = units.filter((unit) => unit.people.length > 1).map((unit) => {
    const memberCards = unit.people.map((person) => cardByPersonId.get(person.id)).filter(Boolean);
    const left = Math.min(...memberCards.map((card) => card.x));
    const right = Math.max(...memberCards.map((card) => card.x + CARD_WIDTH));
    const top = Math.min(...memberCards.map((card) => card.y));
    const bottom = Math.max(...memberCards.map((card) => card.y + CARD_HEIGHT));
    return { id: unit.id, people: unit.people, x: left, y: top, width: right - left, height: bottom - top };
  });
  return {
    units,
    cards,
    clusters,
    generations: generationNumbers.map((generation) => ({
      generation,
      y: STAGE_TOP + (highestGeneration - generation) * GENERATION_GAP,
    })).sort((first, second) => first.y - second.y),
    width: Math.max(MIN_STAGE_WIDTH, contentRight + STAGE_PADDING),
    height: Math.max(EMPTY_STAGE_HEIGHT, contentBottom + STAGE_BOTTOM, STAGE_TOP + (highestGeneration - lowestGeneration) * GENERATION_GAP + CARD_HEIGHT + STAGE_BOTTOM),
  };
}
