export function formatLifespan(person) {
  if (person.birth && person.death) return `${person.birth} — ${person.death}`;
  if (person.birth) return `рожд. ${person.birth}`;
  if (person.death) return `ум. ${person.death}`;
  return "Нет данных";
}
