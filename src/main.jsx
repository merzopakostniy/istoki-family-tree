import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { generationMeta } from "./data";
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
  };
  return <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function initials(name) {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("");
}

function years(person) {
  return `${person.birth || "?"} — ${person.death || ""}`;
}

function normalizePerson(person) {
  const { occupation: _removedOccupation, ...clean } = person;
  return {
    ...clean,
    parents: Array.isArray(clean.parents) ? clean.parents : [],
    partnerId: clean.partnerId || "",
    birthplace: clean.birthplace || "",
    deathplace: clean.deathplace || "",
    note: clean.note || "",
    photo: clean.photo || "",
    photoX: Number.isFinite(clean.photoX) ? clean.photoX : 50,
    photoY: Number.isFinite(clean.photoY) ? clean.photoY : 50,
    photoScale: Number.isFinite(clean.photoScale) ? clean.photoScale : 1,
  };
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
        const maxSide = 720;
        const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        const context = canvas.getContext("2d");
        context.fillStyle = "#f7f5ef";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", .82));
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

function PersonCard({ person, selected, onSelect, register }) {
  return (
    <button
      className={`person-card ${selected ? "is-selected" : ""}`}
      onClick={() => onSelect(person.id)}
      ref={(node) => register(person.id, node)}
      type="button"
      aria-pressed={selected}
    >
      <Portrait person={person} className="avatar"/>
      <span className="person-copy">
        <strong>{person.name}</strong>
        <span className="person-years">{years(person)}</span>
        <small>{person.relation || "родственник"}</small>
      </span>
    </button>
  );
}

function DetailPanel({ person, people, onClose, onEdit, onDelete, onSelect }) {
  if (!person) return null;
  const related = people.filter((item) => person.parents.includes(item.id) || item.parents.includes(person.id) || item.id === person.partnerId);
  return (
    <aside className="detail-panel" aria-label={`Сведения: ${person.name}`}>
      <button className="icon-button detail-close" onClick={onClose} aria-label="Закрыть карточку"><Icon name="close" /></button>
      <div className="detail-heading">
        <Portrait person={person} className="detail-avatar"/>
        <div><h2>{person.name}</h2><p>{years(person)}</p></div>
      </div>
      <section className="detail-section">
        <div className="section-title"><h3>О человеке</h3><button className="bare-icon" onClick={onEdit} aria-label="Редактировать"><Icon name="edit" size={18}/></button></div>
        <dl>
          <div><dt>Место рождения</dt><dd>{person.birthplace || "Не указано"}</dd></div>
          <div><dt>Место смерти</dt><dd>{person.deathplace || "Не указано"}</dd></div>
          <div><dt>Примечание</dt><dd>{person.note || "Пока нет заметок"}</dd></div>
        </dl>
      </section>
      <section className="detail-section relations">
        <div className="section-title"><h3>Родственные связи</h3></div>
        {related.length ? related.map((relative) => (
          <button key={relative.id} className="relation-row" onClick={() => onSelect(relative.id)}>
            <span><strong>{relative.name}</strong><small>{years(relative)}</small></span><Icon name="chevron" size={17}/>
          </button>
        )) : <p className="empty-copy">Связи ещё не добавлены.</p>}
      </section>
      <div className="detail-actions">
        <button className="button secondary" onClick={onEdit}><Icon name="edit" size={18}/>Редактировать</button>
        <button className="button ghost" onClick={onClose}>Закрыть</button>
      </div>
      <button className="delete-action" onClick={onDelete}><Icon name="trash" size={17}/>Удалить человека</button>
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
    parents: [], partnerId: "", birthplace: "", deathplace: "", note: "",
    photo: "", photoX: 50, photoY: 50, photoScale: 1,
    ...(person ? normalizePerson(person) : {}),
  });
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
  const submit = (event) => {
    event.preventDefault();
    const parentIds = [event.currentTarget.elements.parentId1.value, event.currentTarget.elements.parentId2.value].filter((id, index, all) => id && all.indexOf(id) === index);
    onSave({ ...form, parents: parentIds });
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="editor" onSubmit={submit}>
        <div className="editor-header"><div><h2>{isNew ? "Добавить человека" : "Редактировать запись"}</h2><p>Заполните только то, что уже известно.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button></div>
        <div className="photo-editor">
          <Portrait person={{ ...form, name: form.name || "Фото" }} className="editor-photo-preview"/>
          <div className="photo-editor-body">
            <strong>Фотография</strong>
            <p>Загрузите снимок, затем подгоните лицо внутри круга.</p>
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
          <label>Поколение<select value={form.generation} onChange={(e) => update("generation", Number(e.target.value))}>{generationMeta.slice().reverse().map((gen) => <option value={gen.id} key={gen.id}>{gen.label}</option>)}</select></label>
          <label>Кем приходится<input value={form.relation} onChange={(e) => update("relation", e.target.value)} placeholder="например, прабабушка" /></label>
          <label>Первый родитель<select name="parentId1" defaultValue={form.parents?.[0] || ""}><option value="">Не выбран</option>{people.filter((item) => item.id !== person?.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Второй родитель<select name="parentId2" defaultValue={form.parents?.[1] || ""}><option value="">Не выбран</option>{people.filter((item) => item.id !== person?.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="wide">Супруг или супруга<select value={form.partnerId || ""} onChange={(e) => update("partnerId", e.target.value)}><option value="">Не выбран</option>{people.filter((item) => item.id !== person?.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
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

function TreeConnections({ people, nodes, stage, scale }) {
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
          y: (side === "top" ? rect.top - base.top : rect.bottom - base.top) / scale,
        };
      };
      const next = [];
      people.forEach((child) => child.parents.forEach((parentId) => {
        const from = point(parentId, "top");
        const to = point(child.id, "bottom");
        if (!from || !to) return;
        const mid = from.y + (to.y - from.y) / 2;
        next.push({ id: `${parentId}-${child.id}`, d: `M ${from.x} ${from.y} C ${from.x} ${mid}, ${to.x} ${mid}, ${to.x} ${to.y}`, partner: false });
      }));
      people.forEach((person) => {
        if (!person.partnerId || person.id > person.partnerId) return;
        const a = point(person.id, "top");
        const b = point(person.partnerId, "top");
        const aNode = nodes.current.get(person.id)?.getBoundingClientRect();
        const bNode = nodes.current.get(person.partnerId)?.getBoundingClientRect();
        if (!a || !b || !aNode || !bNode) return;
        const y = ((aNode.top - base.top) + aNode.height / 2) / scale;
        next.push({ id: `partner-${person.id}`, d: `M ${a.x} ${y} L ${b.x} ${y}`, partner: true });
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
  return <svg className="connections" aria-hidden="true">{paths.map((path) => <path key={path.id} d={path.d} className={path.partner ? "partner-line" : "parent-line"} />)}</svg>;
}

function App() {
  const [people, setPeople] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(stored) ? stored.map(normalizePerson) : [];
    } catch { return []; }
  });
  const [selectedId, setSelectedId] = useState(null);
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

  const visiblePeople = people.filter((person) => person.name.toLowerCase().includes(query.trim().toLowerCase()));
  const register = (id, node) => node ? nodeRefs.current.set(id, node) : nodeRefs.current.delete(id);
  const centerTree = () => {
    const board = boardRef.current;
    if (board) board.scrollTo({ left: Math.max(0, (board.scrollWidth - board.clientWidth) / 2), top: 0, behavior: "smooth" });
  };
  const savePerson = (draft) => {
    const normalizedDraft = normalizePerson(draft);
    if (draft.id) {
      setPeople((current) => {
        const previous = current.find((person) => person.id === draft.id);
        return current.map((person) => {
          if (person.id === normalizedDraft.id) return normalizedDraft;
          if (person.id === previous?.partnerId && previous.partnerId !== normalizedDraft.partnerId && person.partnerId === normalizedDraft.id) return { ...person, partnerId: "" };
          if (person.id === normalizedDraft.partnerId) return { ...person, partnerId: normalizedDraft.id };
          return person;
        });
      });
      setSelectedId(normalizedDraft.id);
    } else {
      const created = { ...normalizedDraft, id: `person-${Date.now()}` };
      setPeople((current) => [...current.map((person) => person.id === created.partnerId ? { ...person, partnerId: created.id } : person), created]);
      setSelectedId(created.id);
    }
    setEditor(false);
    setNotice("Запись сохранена в этом браузере");
  };
  const deletePerson = () => {
    if (!deleteCandidate) return;
    const id = deleteCandidate.id;
    setPeople((current) => current
      .filter((person) => person.id !== id)
      .map((person) => ({
        ...person,
        parents: person.parents.filter((parentId) => parentId !== id),
        partnerId: person.partnerId === id ? "" : person.partnerId,
      })));
    setSelectedId(null);
    setDeleteCandidate(null);
    setNotice("Человек удалён из древа");
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
          <button className="button primary add-button" onClick={() => setEditor("new")}><Icon name="plus"/><span>Добавить человека</span></button>
          <button className="icon-button" onClick={() => { setSearchOpen((open) => !open); setQuery(""); }} aria-label="Поиск"><Icon name={searchOpen ? "close" : "search"}/></button>
          <button className="icon-button settings-button" onClick={() => setNotice("Настройки приватности добавим перед реальными данными")} aria-label="Настройки"><Icon name="settings"/></button>
        </div>
      </header>

      <main id="tree" className="workspace">
        <aside className="generation-rail" aria-label="Поколения">
          {generationMeta.map((item) => <div className="generation-marker" key={item.id}><span className={`marker-dot ${item.tone}`}/><span>{item.label}</span></div>)}
          <svg className="botanical" viewBox="0 0 100 130" aria-hidden="true"><path d="M10 126C25 92 34 63 50 20M24 94c-14-4-17-14-15-25 11 4 18 11 15 25Zm12-23c11-2 18-9 20-20-11 0-19 6-20 20Zm4 20c-8-8-8-18-3-27 9 7 11 16 3 27Zm-22 18c-9-2-15-8-17-17 10 0 16 6 17 17Zm29-52c-7-8-6-17-1-26 8 7 9 15 1 26Z"/></svg>
        </aside>

        <section className={`tree-area ${selected ? "has-detail" : ""}`} aria-label="Семейное древо">
          <div className="canvas-heading">
            <div><h1>Семейное древо</h1><p>Начните с самых дальних известных предков</p></div>
            <div className="zoom-controls" aria-label="Масштаб">
              <button onClick={() => setScale((value) => Math.max(.75, +(value - .1).toFixed(2)))} aria-label="Уменьшить">−</button>
              <output>{Math.round(scale * 100)}%</output>
              <button onClick={() => setScale((value) => Math.min(1.25, +(value + .1).toFixed(2)))} aria-label="Увеличить">+</button>
              <button className="center-button" onClick={centerTree}><Icon name="target" size={18}/>По центру</button>
            </div>
          </div>

          <div className="tree-board" ref={boardRef}>
            <div className="tree-scaler" style={{ width: `${100 * scale}%`, minHeight: `${720 * scale}px` }}>
              <div className="tree-stage" ref={stageRef} style={{ transform: `scale(${scale})` }}>
                {people.length === 0 ? (
                  <div className="empty-tree">
                    <span className="empty-rings" aria-hidden="true"><i/><i/><i/></span>
                    <h2>Начните с корней</h2>
                    <p>Добавьте самого дальнего известного предка. От него постепенно вырастут ветви вашей семьи.</p>
                    <button className="button primary" onClick={() => setEditor("new")}><Icon name="plus"/>Добавить первого предка</button>
                  </div>
                ) : <>
                <TreeConnections people={visiblePeople} nodes={nodeRefs} stage={stageRef} scale={scale}/>
                {generationMeta.map((generation) => (
                  <div className={`tree-row generation-${generation.id}`} key={generation.id}>
                    <span className="mobile-generation-label">{generation.label}</span>
                    {visiblePeople.filter((person) => person.generation === generation.id).map((person) => <PersonCard key={person.id} person={person} selected={person.id === selectedId} onSelect={setSelectedId} register={register}/>) }
                  </div>
                ))}
                {!visiblePeople.length && <div className="no-results">Никого не нашли. Попробуйте изменить запрос.</div>}
                </>}
              </div>
            </div>
          </div>
        </section>

        <DetailPanel person={selected} people={people} onClose={() => setSelectedId(null)} onEdit={() => setEditor(selected)} onDelete={() => setDeleteCandidate(selected)} onSelect={setSelectedId}/>
      </main>
      {editor && <PersonEditor person={editor === "new" ? null : editor} people={people} onSave={savePerson} onClose={() => setEditor(false)}/>}
      {deleteCandidate && <ConfirmDelete person={deleteCandidate} onConfirm={deletePerson} onClose={() => setDeleteCandidate(null)}/>}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
