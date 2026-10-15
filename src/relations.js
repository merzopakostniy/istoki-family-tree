export function immediateFamilyIds(people, seedIds) {
  const seeds = new Set(seedIds);
  const familyIds = new Set(seeds);
  people.forEach((person) => {
    if (seeds.has(person.id)) {
      person.parents.forEach((id) => familyIds.add(id));
      person.partnerIds.forEach((id) => familyIds.add(id));
    }
    const sibling = people.some(
      (seed) =>
        seeds.has(seed.id) &&
        seed.parents.some((id) => person.parents.includes(id)),
    );
    if (
      sibling ||
      person.parents.some((id) => seeds.has(id)) ||
      person.partnerIds.some((id) => seeds.has(id))
    ) {
      familyIds.add(person.id);
    }
  });
  return familyIds;
}

export function selectionFocusIds(people, selectedId) {
  return selectedId ? immediateFamilyIds(people, [selectedId]) : null;
}

export function searchFamilyBranch(people, query) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  if (!normalizedQuery) {
    return { matchIds: new Set(), visiblePeople: people };
  }
  const matches = people.filter((person) =>
    [person.name, person.maidenName, person.birthplace]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ru")
      .replaceAll("ё", "е")
      .includes(normalizedQuery.replaceAll("ё", "е")),
  );
  const matchIds = new Set(matches.map((person) => person.id));
  const visibleIds = immediateFamilyIds(people, matchIds);
  return {
    matchIds,
    visiblePeople: people.filter((person) => visibleIds.has(person.id)),
  };
}

export function directRelatives(people, person) {
  if (!person) return [];
  return people.filter(
    (relative) =>
      relative.id !== person.id &&
      (person.parents.includes(relative.id) ||
        relative.parents.includes(person.id) ||
        person.partnerIds.includes(relative.id) ||
        relative.partnerIds.includes(person.id) ||
        person.parents.some((id) => relative.parents.includes(id))),
  );
}

export function relationshipLabel(person, relative) {
  if (
    person.currentPartnerId === relative.id ||
    relative.currentPartnerId === person.id
  )
    return "В браке";
  if (
    person.formerPartnerIds?.includes(relative.id) ||
    relative.formerPartnerIds?.includes(person.id)
  )
    return "Бывший супруг / супруга";
  if (
    person.partnerIds.includes(relative.id) ||
    relative.partnerIds.includes(person.id)
  )
    return "Супруг / супруга";
  if (person.parents.includes(relative.id)) return "Родитель";
  if (relative.parents.includes(person.id)) return "Ребёнок";
  if (person.parents.some((id) => relative.parents.includes(id)))
    return "Брат / сестра";
  return "Родственник";
}
