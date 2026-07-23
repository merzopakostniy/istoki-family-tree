export function immediateFamilyIds(people, seedIds) {
  const seeds = new Set(seedIds);
  const familyIds = new Set(seeds);
  people.forEach((person) => {
    if (seeds.has(person.id)) {
      person.parents.forEach((id) => familyIds.add(id));
      person.partnerIds.forEach((id) => familyIds.add(id));
    }
    if (person.parents.some((id) => seeds.has(id)) || person.partnerIds.some((id) => seeds.has(id))) {
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
  const matches = people.filter((person) => person.name.toLocaleLowerCase("ru").includes(normalizedQuery));
  const matchIds = new Set(matches.map((person) => person.id));
  const visibleIds = immediateFamilyIds(people, matchIds);
  return {
    matchIds,
    visiblePeople: people.filter((person) => visibleIds.has(person.id)),
  };
}
