export function formatLifespan(person) {
  if (person.birth && person.death) return `${person.birth} — ${person.death}`;
  if (person.birth) return `рожд. ${person.birth}`;
  if (person.death) return `ум. ${person.death}`;
  return "Нет данных";
}

export function dateSortValue(value) {
  const text = String(value || "").trim();
  const full = text.match(/^(\d{1,2})\.(\d{1,2})\.\s*(\d{4})$/);
  if (full)
    return Number(full[3]) * 10000 + Number(full[2]) * 100 + Number(full[1]);
  if (/^\d{4}$/.test(text)) return Number(text) * 10000;
  return Infinity;
}
