import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { onAuthStateChanged } from "firebase/auth";
import { generationMeta } from "./data";
import {
  auth,
  isOwnerUser,
  signInOwner,
  signOutOwner,
  subscribeToPeople,
  syncPeople,
} from "./firebase";
import { formatLifespan, dateSortValue } from "./formatters";
import {
  CARD_WIDTH,
  buildCanvasFrame,
  buildFamilyLayout as buildHierarchyLayout,
  DEFAULT_CANVAS_MARGIN,
  MANUAL_POSITION_VERSION,
} from "./layout";
import {
  searchFamilyBranch,
  selectionFocusIds,
  directRelatives,
  relationshipLabel,
} from "./relations";
import { buildConnections } from "./routing";
import "./styles.css";
import "./canvas-layout.css";

const STORAGE_KEY = "istoki-family-tree-v2";
const FIT_PADDING = 38;

function Icon({ name, size = 20 }) {
  const paths = {
    menu: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    photo: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8" cy="9" r="1.5" />
        <path d="m3 17 5-5 4 4 4-6 5 7" />
      </>
    ),
    list: (
      <>
        <path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 2M12 17h.01" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
      </>
    ),
    tree: (
      <>
        <path d="M12 3v18M7 7c0-2 2-4 5-4s5 2 5 4-2 4-5 4-5-2-5-4Z" />
        <path d="M5 13c0-1.7 1.5-3 3.4-3 1.8 0 3.6 1.3 3.6 3s-1.8 3-3.6 3C6.5 16 5 14.7 5 13Zm7 2.5c0-1.9 1.7-3.5 3.8-3.5s3.7 1.6 3.7 3.5-1.6 3.5-3.7 3.5-3.8-1.6-3.8-3.5Z" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.3-4 2.2-6 5.5-6s5.2 2 5.5 6M16 5.5a3 3 0 0 1 0 5.8M16.5 14c2.5.2 3.8 1.8 4 5" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5C7 4 9.5 4.3 12 6v14c-2.5-1.7-5-2-8-.5v-14Z" />
        <path d="M20 5.5C17 4 14.5 4.3 12 6v14c2.5-1.7 5-2 8-.5v-14Z" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    edit: (
      <>
        <path d="m4 20 4.2-1 10.6-10.6-3.2-3.2L5 15.8 4 20Z" />
        <path d="m13.8 7 3.2 3.2" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="1.5" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </>
    ),
    chevron: <path d="m9 6 6 6-6 6" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
      </>
    ),
    cloud: (
      <>
        <path d="M7 18h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.4-1.7A4.8 4.8 0 0 0 7 18Z" />
        <path d="m9 13 2 2 4-4" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function initials(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function normalizePerson(person) {
  const {
    occupation: _removedOccupation,
    partnerId: legacyPartnerId,
    ...clean
  } = person;
  const partnerIds = Array.isArray(clean.partnerIds)
    ? clean.partnerIds
    : legacyPartnerId
      ? [legacyPartnerId]
      : [];
  return {
    id: clean.id || "",
    name: clean.name || "",
    birth: clean.birth || "",
    death: clean.death || "",
    relation: clean.relation || "",
    generation: Number.isFinite(clean.generation)
      ? Math.max(0, Math.round(clean.generation))
      : 0,
    parents: Array.isArray(clean.parents) ? clean.parents : [],
    partnerIds: [...new Set(partnerIds.filter(Boolean))],
    currentPartnerId: clean.currentPartnerId || "",
    formerPartnerIds: [
      ...new Set(
        (Array.isArray(clean.formerPartnerIds)
          ? clean.formerPartnerIds
          : []
        ).filter(Boolean),
      ),
    ],
    birthplace: clean.birthplace || "",
    deathplace: clean.deathplace || "",
    maidenName: clean.maidenName || "",
    manualGeneration: Boolean(clean.manualGeneration),
    manualX: Number.isFinite(clean.manualX) ? clean.manualX : null,
    manualY: Number.isFinite(clean.manualY) ? clean.manualY : null,
    manualPositionVersion: Number.isFinite(clean.manualPositionVersion)
      ? clean.manualPositionVersion
      : 0,
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
    person.partnerIds = person.partnerIds.filter(
      (id) => id !== person.id && byId.has(id),
    );
    person.partnerIds.forEach((partnerId) => {
      const partner = byId.get(partnerId);
      if (!partner.partnerIds.includes(person.id))
        partner.partnerIds.push(person.id);
    });
    if (!person.partnerIds.includes(person.currentPartnerId))
      person.currentPartnerId = "";
    person.formerPartnerIds = person.formerPartnerIds.filter(
      (id) => person.partnerIds.includes(id) && id !== person.currentPartnerId,
    );
  });
  const maxPasses = Math.min(normalized.length + 2, 64);
  for (let pass = 0; pass < maxPasses; pass += 1) {
    normalized.forEach((person) => {
      const parentGenerations = person.parents
        .map((id) => byId.get(id)?.generation)
        .filter(Number.isFinite);
      if (parentGenerations.length) {
        const highestParent = Math.max(...parentGenerations);
        const requiredGeneration = highestParent + 1;
        if (!person.manualGeneration || person.generation <= highestParent)
          person.generation = requiredGeneration;
      }
      person.partnerIds.forEach((partnerId) => {
        const partner = byId.get(partnerId);
        if (partner)
          person.generation = partner.generation = Math.max(
            person.generation,
            partner.generation,
          );
      });
    });
  }
  return normalized;
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
        const ratio = Math.min(
          1,
          maxSide / Math.max(image.naturalWidth, image.naturalHeight),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        const context = canvas.getContext("2d");
        context.fillStyle = "#f7f5ef";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.76));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function BotanicalPortraitFrame() {
  return (
    <svg
      className="botanical-portrait-frame"
      viewBox="0 0 100 136"
      aria-hidden="true"
    >
      <path
        className="vine-stem vine-stem-left"
        d="M48 133C26 127 12 111 11 89 10 69 19 59 13 43 8 28 20 11 47 3"
      />
      <path
        className="vine-stem vine-stem-right"
        d="M52 133C75 126 89 110 89 88 89 68 80 58 87 42 93 27 80 10 53 3"
      />
      <path
        className="vine-twig"
        d="M14 49c8-5 14-11 18-19M87 43c-8-4-14-10-19-18M13 91c8 3 15 8 20 16M88 87c-8 4-14 9-18 17"
      />
      <path
        className="vine-weave"
        d="M47 3c10 8 21 13 29 25M53 133c-11-7-22-12-30-25"
      />
    </svg>
  );
}

function Portrait({ person, className, botanical = false, crop = false }) {
  return (
    <span
      className={`${className} ${botanical ? "has-botanical-frame" : ""}`}
      aria-hidden="true"
    >
      <span className="portrait-crop">
        {person.photo ? (
          <img
            className="portrait-image"
            src={person.photo}
            alt=""
            style={{
              objectFit: crop ? "cover" : "contain",
              objectPosition: crop ? `${person.photoX ?? 50}% ${person.photoY ?? 50}%` : "center",
              transform: crop ? `scale(${person.photoScale ?? 1})` : "none",
            }}
          />
        ) : (
          initials(person.name || "?")
        )}
      </span>
      {botanical ? <BotanicalPortraitFrame /> : null}
    </span>
  );
}

function PersonCard({ person, selected, focus, onSelect, register }) {
  return (
    <button
      className={`person-card ${selected ? "is-selected" : ""} ${focus === "dim" ? "is-dimmed" : ""} ${focus === "on" ? "is-focused" : ""}`}
      onClick={() => onSelect(person.id)}
      ref={(node) => register(person.id, node)}
      type="button"
      aria-pressed={selected}
    >
      <Portrait person={person} className="avatar" />
      <span className="person-copy">
        <strong>
          <span className="person-surname">{person.name.split(" ")[0]}</span>
          <span>{person.name.split(" ").slice(1).join(" ")}</span>
        </strong>
        <span className="person-years">{formatLifespan(person)}</span>
        {(person.maidenName || person.relation) && (
          <small className="person-role">
            {[
              person.maidenName ? `урожд. ${person.maidenName}` : "",
              person.relation,
            ]
              .filter(Boolean)
              .join(" · ")}
          </small>
        )}
        {person.birthplace && (
          <small className="person-place">{person.birthplace}</small>
        )}
      </span>
    </button>
  );
}

function branchColor() {
  return "#748078";
}

function generationLabel(generation) {
  return (
    generationMeta.find((item) => item.id === generation)?.label ||
    `Поколение ${generation + 1}`
  );
}

function PositionedPerson({
  card,
  selectedId,
  focusIds,
  onSelect,
  register,
  canManage,
  scale,
  canvasOffsetX,
  canvasOffsetY,
  onDragEnd,
}) {
  const [drag, setDrag] = useState(null);
  const draggedRef = useRef(false);
  const redrawFrame = useRef(null);
  const clickResetTimer = useRef(null);
  useEffect(
    () => () => {
      cancelAnimationFrame(redrawFrame.current);
      clearTimeout(clickResetTimer.current);
    },
    [],
  );
  const redrawConnections = () => {
    cancelAnimationFrame(redrawFrame.current);
    redrawFrame.current = requestAnimationFrame(() =>
      window.dispatchEvent(new Event("family-layout-change")),
    );
  };
  const beginDrag = (event) => {
    if (!canManage || (event.pointerType === "mouse" && event.button !== 0))
      return;
    event.preventDefault();
    const start = {
      x: event.clientX,
      y: event.clientY,
      moved: false,
      pointerId: event.pointerId,
    };
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== start.pointerId) return;
      const dx = (moveEvent.clientX - start.x) / (scale || 1);
      const dy = (moveEvent.clientY - start.y) / (scale || 1);
      if (
        !start.moved &&
        Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) < 4
      )
        return;
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
        onDragEnd(card.person.id, card.x + dx, card.y + dy);
        clickResetTimer.current = setTimeout(() => {
          draggedRef.current = false;
        }, 0);
      }
      setDrag(null);
      redrawConnections();
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  };
  const suppressClickAfterDrag = (event) => {
    if (draggedRef.current) {
      event.stopPropagation();
      event.preventDefault();
      draggedRef.current = false;
    }
  };
  const person = card.person;
  const left = card.x + canvasOffsetX + (drag?.dx || 0);
  const top = card.y + canvasOffsetY + (drag?.dy || 0);
  return (
    <div
      className={`positioned-person ${canManage ? "draggable" : ""} ${drag ? "is-dragging" : ""}`}
      style={{ left: `${left}px`, top: `${top}px` }}
      data-person-id={person.id}
      onPointerDown={beginDrag}
      onClickCapture={suppressClickAfterDrag}
    >
      <PersonCard
        person={person}
        selected={person.id === selectedId}
        focus={
          focusIds
            ? focusIds.has(person.id)
              ? person.id === selectedId
                ? ""
                : "on"
              : "dim"
            : ""
        }
        onSelect={onSelect}
        register={register}
      />
    </div>
  );
}

function DetailPanel({
  person,
  people,
  canEdit,
  expanded,
  onToggleExpand,
  onClose,
  onEdit,
  onDelete,
  onSelect,
  onFocus,
}) {
  if (!person) return null;
  const related = directRelatives(people, person);
  return (
    <aside
      className={`detail-panel ${expanded ? "is-expanded" : ""}`}
      aria-label={`Сведения: ${person.name}`}
    >
      <button
        className="sheet-handle"
        onClick={onToggleExpand}
        aria-label={expanded ? "Свернуть" : "Показать подробнее"}
      >
        <i />
      </button>
      <button
        className="icon-button detail-close"
        onClick={onClose}
        aria-label="Закрыть карточку"
      >
        <Icon name="close" />
      </button>
      <div className="detail-heading" onClick={onToggleExpand}>
        <Portrait person={person} className="detail-avatar" />
        <div>
          <h2>{person.name}</h2>
          <p>{formatLifespan(person)}</p>
        </div>
      </div>
      <button className="sheet-more" onClick={onToggleExpand}>
        {expanded ? "Свернуть" : "Место рождения, заметки и связи"}
        <Icon name="chevron" size={15} />
      </button>
      <section className="detail-section">
        <div className="section-title">
          <h3>О человеке</h3>
          {canEdit && (
            <button
              className="bare-icon"
              onClick={onEdit}
              aria-label="Редактировать"
            >
              <Icon name="edit" size={18} />
            </button>
          )}
        </div>
        <dl>
          <div>
            <dt>Девичья фамилия</dt>
            <dd>{person.maidenName || "Не указана"}</dd>
          </div>
          <div>
            <dt>Дата рождения</dt>
            <dd>{person.birth || "Не указана"}</dd>
          </div>
          <div>
            <dt>Место рождения</dt>
            <dd>{person.birthplace || "Не указано"}</dd>
          </div>
          <div>
            <dt>Дата смерти</dt>
            <dd>{person.death || "Не указана"}</dd>
          </div>
          <div>
            <dt>Место смерти</dt>
            <dd>{person.deathplace || "Не указано"}</dd>
          </div>
          <div>
            <dt>Примечание</dt>
            <dd>{person.note || "Пока нет заметок"}</dd>
          </div>
        </dl>
      </section>
      <section className="detail-section relations">
        <div className="section-title">
          <h3>Родственные связи</h3>
        </div>
        {related.length ? (
          related.map((relative) => (
            <button
              key={relative.id}
              className="relation-row"
              onClick={() => onSelect(relative.id)}
            >
              <Portrait person={relative} className="relation-avatar" />
              <span>
                <em>{relationshipLabel(person, relative)}</em>
                <strong>{relative.name}</strong>
                <small>{formatLifespan(relative)}</small>
              </span>
              <Icon name="chevron" size={17} />
            </button>
          ))
        ) : (
          <p className="empty-copy">Связи ещё не добавлены.</p>
        )}
      </section>
      <button className="button ghost focus-branch" onClick={onFocus}>
        <Icon name="tree" size={16} />
        Показать семейную ветвь
      </button>
      <div className="detail-actions">
        {canEdit && (
          <button className="button secondary" onClick={onEdit}>
            <Icon name="edit" size={18} />
            Редактировать
          </button>
        )}
        <button className="button ghost" onClick={onClose}>
          Закрыть
        </button>
      </div>
      {canEdit && (
        <button className="delete-action" onClick={onDelete}>
          <Icon name="trash" size={17} />
          Удалить человека
        </button>
      )}
    </aside>
  );
}

function PersonEditor({ person, people, onSave, onClose }) {
  const isNew = !person;
  const photoInputRef = useRef(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [form, setForm] = useState({
    name: "",
    birth: "",
    death: "",
    relation: "",
    generation: 0,
    parents: [],
    partnerIds: [],
    currentPartnerId: "",
    formerPartnerIds: [],
    birthplace: "",
    deathplace: "",
    maidenName: "",
    note: "",
    photo: "",
    photoX: 50,
    photoY: 50,
    photoScale: 1,
    ...(person ? normalizePerson(person) : {}),
  });
  const highestGeneration = Math.max(
    3,
    form.generation,
    ...people.map((item) => item.generation),
  );
  const generationOptions = Array.from(
    { length: highestGeneration + 2 },
    (_, generation) => generation,
  ).reverse();
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const choosePhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const photo = await optimizePhoto(file);
      setForm((current) => ({
        ...current,
        photo,
        photoX: 50,
        photoY: 50,
        photoScale: 1,
      }));
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
      const uniqueParents = parents.filter(
        (id, itemIndex, all) => id && all.indexOf(id) === itemIndex,
      );
      const parentGenerations = uniqueParents
        .map((id) => people.find((item) => item.id === id)?.generation)
        .filter(Number.isFinite);
      const generation = parentGenerations.length
        ? Math.max(...parentGenerations) + 1
        : current.generation;
      return {
        ...current,
        parents: uniqueParents,
        generation,
        manualGeneration: false,
      };
    });
  };
  const togglePartner = (partnerId, checked) => {
    setForm((current) => {
      const partnerIds = checked
        ? [...new Set([...current.partnerIds, partnerId])]
        : current.partnerIds.filter((id) => id !== partnerId);
      const generations = partnerIds
        .map((id) => people.find((item) => item.id === id)?.generation)
        .filter(Number.isFinite);
      const currentPartnerId = checked
        ? current.currentPartnerId
        : current.currentPartnerId === partnerId
          ? ""
          : current.currentPartnerId;
      const formerPartnerIds = checked
        ? current.formerPartnerIds
        : current.formerPartnerIds.filter((id) => id !== partnerId);
      return {
        ...current,
        partnerIds,
        currentPartnerId,
        formerPartnerIds,
        generation: generations.length
          ? Math.max(...generations)
          : current.generation,
      };
    });
  };
  const setCurrentPartner = (partnerId, isCurrent) =>
    setForm((current) => ({
      ...current,
      currentPartnerId: isCurrent ? "" : partnerId,
      formerPartnerIds: current.formerPartnerIds.filter(
        (id) => id !== partnerId,
      ),
    }));
  const setFormerPartner = (partnerId, isFormer) =>
    setForm((current) => ({
      ...current,
      currentPartnerId:
        current.currentPartnerId === partnerId ? "" : current.currentPartnerId,
      formerPartnerIds: isFormer
        ? current.formerPartnerIds.filter((id) => id !== partnerId)
        : [...new Set([...current.formerPartnerIds, partnerId])],
    }));
  const submit = (event) => {
    event.preventDefault();
    onSave(form);
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        className="editor"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Добавить человека" : "Редактировать запись"}
        onSubmit={submit}
      >
        <div className="editor-header">
          <div>
            <h2>{isNew ? "Добавить человека" : "Редактировать запись"}</h2>
            <p>Заполните только то, что уже известно.</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="photo-editor">
          <Portrait
            person={{ ...form, name: form.name || "Фото" }}
            className="editor-photo-preview"
            crop
          />
          <div className="photo-editor-body">
            <strong>Фотография</strong>
            <p>Загрузите снимок, затем подгоните лицо внутри овала.</p>
            <input
              ref={photoInputRef}
              className="visually-hidden"
              type="file"
              accept="image/*"
              onChange={choosePhoto}
            />
            <div className="photo-buttons">
              <button
                type="button"
                className="button ghost compact"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoBusy}
              >
                {photoBusy
                  ? "Обрабатываем…"
                  : form.photo
                    ? "Заменить фото"
                    : "Добавить фото"}
              </button>
              {form.photo && (
                <button
                  type="button"
                  className="bare-text-button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      photo: "",
                      photoX: 50,
                      photoY: 50,
                      photoScale: 1,
                    }))
                  }
                >
                  Убрать
                </button>
              )}
            </div>
            {photoError && (
              <span className="field-error" role="alert">
                {photoError}
              </span>
            )}
            {form.photo && (
              <div className="photo-controls">
                <label>
                  По горизонтали
                  <input
                    aria-label="Положение фото по горизонтали"
                    type="range"
                    min="0"
                    max="100"
                    value={form.photoX}
                    onChange={(e) => update("photoX", Number(e.target.value))}
                  />
                </label>
                <label>
                  По вертикали
                  <input
                    aria-label="Положение фото по вертикали"
                    type="range"
                    min="0"
                    max="100"
                    value={form.photoY}
                    onChange={(e) => update("photoY", Number(e.target.value))}
                  />
                </label>
                <label>
                  Масштаб
                  <input
                    aria-label="Масштаб фото"
                    type="range"
                    min="1"
                    max="2"
                    step="0.05"
                    value={form.photoScale}
                    onChange={(e) =>
                      update("photoScale", Number(e.target.value))
                    }
                  />
                </label>
              </div>
            )}
          </div>
        </div>
        <div className="form-grid">
          <label className="wide">
            Имя и фамилия
            <input
              name="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Дата рождения
            <input
              name="birth"
              value={form.birth}
              onChange={(e) => update("birth", e.target.value)}
              placeholder="ДД.ММ.ГГГГ"
            />
          </label>
          <label>
            Дата смерти
            <input
              name="death"
              value={form.death}
              onChange={(e) => update("death", e.target.value)}
              placeholder="ДД.ММ.ГГГГ"
            />
          </label>
          <label>
            Поколение
            <select
              value={form.generation}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  generation: Number(e.target.value),
                  manualGeneration: true,
                }))
              }
            >
              {generationOptions.map((generation) => (
                <option value={generation} key={generation}>
                  {generationLabel(generation)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Кем приходится
            <input
              value={form.relation}
              onChange={(e) => update("relation", e.target.value)}
              placeholder="например, прабабушка"
            />
          </label>
          <label>
            Первый родитель
            <select
              name="parentId1"
              value={form.parents?.[0] || ""}
              onChange={(e) => chooseParent(0, e.target.value)}
            >
              <option value="">Не выбран</option>
              {people
                .filter((item) => item.id !== person?.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Второй родитель
            <select
              name="parentId2"
              value={form.parents?.[1] || ""}
              onChange={(e) => chooseParent(1, e.target.value)}
            >
              <option value="">Не выбран</option>
              {people
                .filter((item) => item.id !== person?.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <fieldset className="wide spouse-field">
            <legend>Супруги</legend>
            <div className="spouse-options">
              {people
                .filter((item) => item.id !== person?.id)
                .map((item) => {
                  const checked = form.partnerIds.includes(item.id);
                  const isCurrent =
                    form.currentPartnerId === item.id ||
                    item.currentPartnerId === form.id;
                  const isFormer =
                    form.formerPartnerIds.includes(item.id) ||
                    item.formerPartnerIds.includes(form.id);
                  return (
                    <span className="spouse-option" key={item.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            togglePartner(item.id, e.target.checked)
                          }
                        />
                        <span>{item.name}</span>
                      </label>
                      {checked && (
                        <span className="marriage-status-controls">
                          <button
                            type="button"
                            className={`current-marriage-toggle ${isCurrent ? "is-current" : ""}`}
                            onClick={() =>
                              setCurrentPartner(item.id, isCurrent)
                            }
                          >
                            {isCurrent ? "Текущий брак" : "Отметить текущим"}
                          </button>
                          <button
                            type="button"
                            className={`former-marriage-toggle ${isFormer ? "is-former" : ""}`}
                            onClick={() => setFormerPartner(item.id, isFormer)}
                          >
                            {isFormer ? "Бывший брак" : "Отметить бывшим"}
                          </button>
                        </span>
                      )}
                    </span>
                  );
                })}
              {people.filter((item) => item.id !== person?.id).length === 0 ? (
                <span className="empty-spouse-copy">
                  Сначала добавьте второго человека
                </span>
              ) : null}
            </div>
            {form.partnerIds.length > 0 && (
              <p className="spouse-hint">
                Отметьте текущий или бывший брак. Рамка показывается только у
                текущей пары; бывшие супруги остаются рядом без фона.
              </p>
            )}
          </fieldset>
          <label className="wide">
            Девичья фамилия
            <input
              value={form.maidenName}
              onChange={(e) => update("maidenName", e.target.value)}
              placeholder="Фамилия до брака"
            />
          </label>
          <label className="wide">
            Место рождения
            <input
              value={form.birthplace}
              onChange={(e) => update("birthplace", e.target.value)}
            />
          </label>
          <label className="wide">
            Место смерти
            <input
              value={form.deathplace}
              onChange={(e) => update("deathplace", e.target.value)}
            />
          </label>
          <label className="wide">
            Заметка
            <textarea
              rows="3"
              value={form.note}
              onChange={(e) => update("note", e.target.value)}
            />
          </label>
        </div>
        <div className="editor-actions">
          <button type="button" className="button ghost" onClick={onClose}>
            Отмена
          </button>
          <button className="button primary" type="submit">
            Сохранить
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDelete({ person, onConfirm, onClose }) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
      >
        <span className="confirm-icon">
          <Icon name="trash" size={24} />
        </span>
        <h2 id="delete-title">Удалить {person.name}?</h2>
        <p>
          Карточка исчезнет из древа. Остальные родственники сохранятся, а
          связанные линии будут аккуратно удалены.
        </p>
        <div className="confirm-actions">
          <button className="button ghost" onClick={onClose}>
            Отмена
          </button>
          <button className="button danger" onClick={onConfirm}>
            Удалить
          </button>
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
      const bounds = new Map();
      people.forEach((person) => {
        const rect = nodes.current.get(person.id)?.getBoundingClientRect();
        if (rect)
          bounds.set(person.id, {
            left: (rect.left - base.left) / scale,
            right: (rect.right - base.left) / scale,
            top: (rect.top - base.top) / scale,
            bottom: (rect.bottom - base.top) / scale,
          });
      });
      const result = buildConnections(people, bounds);
      setPaths(result.paths);
      setMarriages(result.marriages);
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
  const selectedPerson = selectedId
    ? people.find((person) => person.id === selectedId)
    : null;
  return (
    <svg className="connections" aria-hidden="true">
      {marriages.map((marriage) => {
        const isFocused =
          selectedPerson && marriage.people.includes(selectedPerson.id);
        return (
          <g
            key={marriage.id}
            className={`marriage-connection ${marriage.current ? "is-current" : ""} ${marriage.former ? "is-former" : ""} ${isFocused ? "is-focused" : ""} ${selectedPerson && !isFocused ? "is-dimmed-line" : ""}`}
            style={{ "--branch-color": marriage.color }}
          >
            <path d={marriage.d} className="marriage-line" />
          </g>
        );
      })}
      {paths.map((path) => {
        const isFlow = selectedPerson
          ? path.parentIds.includes(selectedPerson.id) ||
            path.childIds.includes(selectedPerson.id)
          : false;
        const isDim = selectedPerson ? !isFlow : false;
        const classes = [
          isFlow ? "is-flowing" : isDim ? "is-dimmed-line" : "",
          path.distant && !isFlow ? "is-distant" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <g
            key={path.id}
            className={classes}
            style={{ "--branch-color": path.color }}
          >
            <path d={path.d} className="parent-line" />
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
      initialLocalPeople.current = Array.isArray(stored)
        ? normalizePeople(stored)
        : [];
    } catch {
      initialLocalPeople.current = [];
    }
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
  const [view, setView] = useState("tree");
  const [treeScope, setTreeScope] = useState("branch");
  const [rootId, setRootId] = useState(null);
  const [manualLayout, setManualLayout] = useState(false);
  const [generationFilter, setGenerationFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [helpOpen, setHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const panRef = useRef(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const stageRef = useRef(null);
  const boardRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const selected = people.find((person) => person.id === selectedId) || null;
  const focusIds = selectionFocusIds(people, selectedId);
  const ownerSignedIn = isOwnerUser(authUser);
  const migrationNeeded =
    cloudState === "empty" && initialLocalPeople.current.length > 0;
  const canManage =
    ownerSignedIn &&
    cloudState !== "loading" &&
    cloudState !== "error" &&
    !migrationNeeded;

  useEffect(() => onAuthStateChanged(auth, setAuthUser), []);
  useEffect(
    () =>
      subscribeToPeople(
        (cloudPeople) => {
          if (!cloudPeople.length) {
            setCloudState("empty");
            return;
          }
          const normalized = normalizePeople(cloudPeople);
          peopleRef.current = normalized;
          setPeople(normalized);
          setCloudState("ready");
        },
        () => {
          setCloudState("error");
          setNotice("Не удалось подключиться к общему древу");
        },
      ),
    [],
  );
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
      setNotice(
        "Хранилище браузера заполнено. Попробуйте фото меньшего размера.",
      );
    }
  }, [people]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  const commitPeople = (createNext, successMessage) => {
    if (!canManage) {
      setNotice(
        ownerSignedIn
          ? "Дождитесь окончания синхронизации"
          : "Войдите как владелец",
      );
      return peopleRef.current;
    }
    const previous = peopleRef.current;
    const next = normalizePeople(
      typeof createNext === "function" ? createNext(previous) : createNext,
    );
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
      if (error?.code !== "auth/popup-closed-by-user")
        setNotice("Не удалось войти через Google");
    }
  };

  const searchResult = searchFamilyBranch(people, query);
  const defaultRoot = useMemo(
    () =>
      people.find((person) => {
        const count = directRelatives(people, person).length;
        return person.photo && count >= 4 && count <= 8;
      }) || people[0],
    [people],
  );
  const branchRoot = people.find((p) => p.id === rootId) || defaultRoot;
  const branchIds = new Set(
    branchRoot
      ? [branchRoot.id, ...directRelatives(people, branchRoot).map((p) => p.id)]
      : [],
  );
  const visiblePeople = searchResult.visiblePeople.filter(
    (person) =>
      (query.trim() || treeScope === "all" || branchIds.has(person.id)) &&
      (generationFilter === "all" ||
        person.generation === Number(generationFilter)),
  );
  const directoryPeople = people
    .filter(
      (person) =>
        (generationFilter === "all" ||
          person.generation === Number(generationFilter)) &&
        (!query.trim() ||
          [person.name, person.maidenName, person.birthplace]
            .join(" ")
            .toLocaleLowerCase("ru")
            .includes(query.trim().toLocaleLowerCase("ru"))),
    )
    .sort((a, b) =>
      sort === "birth"
        ? dateSortValue(a.birth) - dateSortValue(b.birth)
        : a.name.localeCompare(b.name, "ru"),
    );
  const generations = [
    ...new Set(people.map((person) => person.generation)),
  ].sort((a, b) => a - b);
  const photoPeople = directoryPeople.filter((person) => person.photo);
  const selectPerson = (id) => {
    setSelectedId(id);
    setSheetExpanded(true);
  };
  const exportArchive = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { version: 2, exportedAt: new Date().toISOString(), people },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `istoki-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Семейный архив сохранён");
  };
  const searchMatchIds = searchResult.matchIds;
  const familyLayout = buildHierarchyLayout(
    manualLayout
      ? visiblePeople
      : visiblePeople.map((p) => ({ ...p, manualPositionVersion: 0 })),
  );
  const canvasFrame = buildCanvasFrame(
    familyLayout,
    DEFAULT_CANVAS_MARGIN,
    140 / scale,
    70 / scale,
  );
  const canvasOffsetX = canvasFrame.offsetX;
  const canvasOffsetY = canvasFrame.offsetY;
  const stageWidth = canvasFrame.width;
  const stageHeight = canvasFrame.height;
  const register = (id, node) =>
    node ? nodeRefs.current.set(id, node) : nodeRefs.current.delete(id);
  const hasManualLayout = people.some(
    (person) =>
      person.manualPositionVersion === MANUAL_POSITION_VERSION &&
      Number.isFinite(person.manualX) &&
      Number.isFinite(person.manualY),
  );
  const handlePersonDrag = (id, x, y) => {
    commitPeople(
      (current) =>
        current.map((person) =>
          person.id === id
            ? {
                ...person,
                manualX: x,
                manualY: y,
                manualPositionVersion: MANUAL_POSITION_VERSION,
              }
            : person,
        ),
      "Расположение сохранено",
    );
  };
  const resetLayout = () =>
    commitPeople(
      (current) =>
        current.map((person) => ({
          ...person,
          manualX: null,
          manualY: null,
          manualPositionVersion: 0,
        })),
      "Раскладка сброшена",
    );
  const centerTree = (behavior = "smooth") => {
    const board = boardRef.current;
    if (!board) return;
    const rootCard = familyLayout.cards.find(
      (card) => card.person.id === branchRoot?.id,
    );
    const contentCenterX =
      canvasOffsetX +
      (treeScope === "branch" && board.clientWidth < 650 && rootCard
        ? rootCard.x + CARD_WIDTH / 2
        : (familyLayout.contentLeft + familyLayout.contentRight) / 2);
    const contentTop = canvasOffsetY + familyLayout.contentTop;
    board.scrollTo({
      left: Math.max(0, contentCenterX * scale - board.clientWidth / 2),
      top: Math.max(
        0,
        contentTop * scale -
          Math.max(
            board.clientWidth > 650 && board.clientHeight < 740 ? 80 : 108,
            (board.clientHeight - familyLayout.contentHeight * scale) / 2,
          ),
      ),
      behavior,
    });
  };
  const treeScale = () => {
    const board = boardRef.current;
    if (!board) return null;
    const fitWidth = Math.max(360, familyLayout.contentWidth + FIT_PADDING * 2);
    const fitHeight = Math.max(
      280,
      familyLayout.contentHeight + FIT_PADDING * 2,
    );
    const widthScale = (board.clientWidth - 40) / fitWidth;
    const heightScale = (board.clientHeight - 40) / fitHeight;
    const fittedScale = Math.max(0.08, Math.min(1, widthScale, heightScale));
    return +fittedScale.toFixed(2);
  };
  const initialTreeScale = () => {
    const board = boardRef.current;
    if (!board || treeScope !== "branch") return treeScale();
    if (board.clientWidth <= 650) return 1;
    const topInset = board.clientHeight < 740 ? 80 : 108;
    const heightScale =
      (board.clientHeight - topInset - 80) / familyLayout.contentHeight;
    const widthScale = (board.clientWidth - 48) / familyLayout.contentWidth;
    return +Math.max(0.8, Math.min(1, heightScale, widthScale)).toFixed(2);
  };
  const fitTree = () => {
    const fittedScale = treeScale();
    if (fittedScale != null) setScale(fittedScale);
  };
  const didAutoFit = useRef(false);
  useEffect(() => {
    didAutoFit.current = false;
  }, [treeScope, rootId, query, generationFilter, manualLayout]);
  useEffect(() => {
    if (!people.length || didAutoFit.current) return;
    const board = boardRef.current;
    if (!board || !board.clientWidth) return;
    didAutoFit.current = true;
    const frame = requestAnimationFrame(() => {
      const fittedScale = initialTreeScale();
      if (fittedScale != null) setScale(fittedScale);
    });
    return () => cancelAnimationFrame(frame);
  }, [
    people.length,
    familyLayout.contentWidth,
    familyLayout.contentHeight,
    rootId,
    treeScope,
    query,
    generationFilter,
    manualLayout,
    view,
  ]);
  useEffect(() => {
    setSheetExpanded(false);
  }, [selectedId]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setSelectedId(null);
        setEditor(false);
        setHelpOpen(false);
        setDeleteCandidate(null);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("family-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const board = boardRef.current;
    if (!board || view !== "tree") return;
    const observer = new ResizeObserver(() =>
      window.dispatchEvent(new Event("family-layout-change")),
    );
    observer.observe(board);
    return () => observer.disconnect();
  }, [view, selectedId]);
  useEffect(() => {
    if (!people.length) return;
    const frame = requestAnimationFrame(() => centerTree("auto"));
    return () => cancelAnimationFrame(frame);
  }, [
    scale,
    people.length,
    view,
    query,
    rootId,
    treeScope,
    generationFilter,
    manualLayout,
  ]);
  useEffect(() => {
    const handleResize = () => {
      const fitted = initialTreeScale();
      if (fitted != null) setScale(fitted);
      requestAnimationFrame(() => centerTree("auto"));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [scale, people.length, rootId, treeScope, view, selectedId]);
  const previousCanvasOrigin = useRef(null);
  useLayoutEffect(() => {
    const board = boardRef.current;
    const previous = previousCanvasOrigin.current;
    if (board && previous) {
      board.scrollLeft += (canvasOffsetX - previous.x) * scale;
      board.scrollTop += (canvasOffsetY - previous.y) * scale;
    }
    previousCanvasOrigin.current = { x: canvasOffsetX, y: canvasOffsetY };
  }, [canvasOffsetX, canvasOffsetY, scale]);
  useEffect(() => {
    if (!selectedId) return;
    const frame = requestAnimationFrame(() => {
      const board = boardRef.current;
      const card = nodeRefs.current.get(selectedId);
      if (!board || !card) return;
      const boardRect = board.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const left =
        board.scrollLeft +
        cardRect.left +
        cardRect.width / 2 -
        boardRect.left -
        (board.clientWidth -
          (window.matchMedia("(min-width: 901px)").matches ? 340 : 0)) /
          2;
      const top =
        board.scrollTop +
        cardRect.top -
        boardRect.top -
        Math.max(140, (board.clientHeight - cardRect.height) / 2);
      board.scrollTo({
        left: Math.max(0, left),
        top: Math.max(0, top),
        behavior: "smooth",
      });
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
          if (isPartner)
            return {
              ...person,
              partnerIds: [
                ...new Set([...person.partnerIds, normalizedDraft.id]),
              ],
              currentPartnerId:
                normalizedDraft.currentPartnerId === person.id
                  ? normalizedDraft.id
                  : person.currentPartnerId === normalizedDraft.id
                    ? ""
                    : person.currentPartnerId,
              formerPartnerIds: normalizedDraft.formerPartnerIds.includes(
                person.id,
              )
                ? [...new Set([...person.formerPartnerIds, normalizedDraft.id])]
                : person.formerPartnerIds.filter(
                    (id) => id !== normalizedDraft.id,
                  ),
              generation: normalizedDraft.generation,
            };
          if (wasPartner)
            return {
              ...person,
              partnerIds: person.partnerIds.filter(
                (id) => id !== normalizedDraft.id,
              ),
              currentPartnerId:
                person.currentPartnerId === normalizedDraft.id
                  ? ""
                  : person.currentPartnerId,
              formerPartnerIds: person.formerPartnerIds.filter(
                (id) => id !== normalizedDraft.id,
              ),
            };
          return person;
        });
      }, "Запись сохранена в общем древе");
      setSelectedId(normalizedDraft.id);
    } else {
      const created = { ...normalizedDraft, id: `person-${Date.now()}` };
      commitPeople(
        (current) => [
          ...current.map((person) =>
            created.partnerIds.includes(person.id)
              ? {
                  ...person,
                  partnerIds: [...new Set([...person.partnerIds, created.id])],
                  currentPartnerId:
                    created.currentPartnerId === person.id
                      ? created.id
                      : person.currentPartnerId,
                  formerPartnerIds: created.formerPartnerIds.includes(person.id)
                    ? [...new Set([...person.formerPartnerIds, created.id])]
                    : person.formerPartnerIds,
                  generation: created.generation,
                }
              : person,
          ),
          created,
        ],
        "Человек добавлен в общее древо",
      );
      setSelectedId(created.id);
    }
    setEditor(false);
  };
  const deletePerson = () => {
    if (!deleteCandidate) return;
    const id = deleteCandidate.id;
    commitPeople(
      (current) =>
        current
          .filter((person) => person.id !== id)
          .map((person) => ({
            ...person,
            parents: person.parents.filter((parentId) => parentId !== id),
            partnerIds: person.partnerIds.filter(
              (partnerId) => partnerId !== id,
            ),
            currentPartnerId:
              person.currentPartnerId === id ? "" : person.currentPartnerId,
            formerPartnerIds: person.formerPartnerIds.filter(
              (partnerId) => partnerId !== id,
            ),
          })),
      "Человек удалён из общего древа",
    );
    setSelectedId(null);
    setDeleteCandidate(null);
  };

  return (
    <div className="app-shell">
      <div className="main-shell">
        <header className="topbar">
          <a
            className="brand"
            href="#tree"
            onClick={() => setView("tree")}
            aria-label="Истоки — семейное древо"
          >
            <span className="tree-rings" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>Истоки</span>
          </a>
          <nav aria-label="Основная навигация">
            {[
              ["tree", "tree", "Древо"],
              ["family", "users", "Родственники"],
              ["photos", "photo", "Фотоальбом"],
            ].map(([id, icon, label]) => (
              <button
                key={id}
                aria-label={label}
                className={`nav-item ${view === id ? "active" : ""}`}
                onClick={() => {
                  setView(id);
                  setGenerationFilter("all");
                  setMenuOpen(false);
                }}
                aria-current={view === id ? "page" : undefined}
              >
                <Icon name={icon} size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <label className="search-field">
              <Icon name="search" size={18} />
              <input
                id="family-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Найти родственника…"
                aria-label="Найти родственника"
              />
              {query ? (
                <button
                  className="clear-search"
                  onClick={() => setQuery("")}
                  aria-label="Очистить поиск"
                >
                  <Icon name="close" size={14} />
                </button>
              ) : (
                <kbd>⌘ K</kbd>
              )}
            </label>
            <button
              className="button primary add-button"
              aria-label="Добавить человека"
              onClick={() =>
                canManage ? setEditor("new") : handleOwnerAccess()
              }
            >
              <Icon name="plus" size={18} />
              <span>Добавить человека</span>
            </button>
            <button
              className="icon-button archive-menu-toggle"
              aria-label="Меню архива"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Icon name="menu" size={20} />
            </button>
            {menuOpen && (
              <div className="archive-menu">
                <span
                  className={`sync-state ${cloudState === "error" ? "offline" : ""}`}
                >
                  <i />
                  {cloudState === "loading"
                    ? "Подключаем архив"
                    : cloudState === "error"
                      ? "Нет связи с архивом"
                      : "Архив синхронизирован"}
                </span>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleOwnerAccess();
                  }}
                >
                  <Icon name="user" size={17} />
                  {ownerSignedIn
                    ? "Выйти из режима владельца"
                    : "Войти владельцу"}
                </button>
                <button
                  onClick={() => {
                    exportArchive();
                    setMenuOpen(false);
                  }}
                  disabled={!people.length}
                >
                  <Icon name="download" size={17} />
                  Сохранить архив
                </button>
                <button
                  onClick={() => {
                    setHelpOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <Icon name="help" size={17} />
                  Как устроено древо
                </button>
              </div>
            )}
          </div>
        </header>
        <main id="tree" className={`workspace workspace-${view}`}>
          <h1 className="visually-hidden">
            {view === "tree"
              ? "Семейное древо"
              : view === "family"
                ? "Родственники"
                : "Фотоальбом"}
          </h1>
          <section
            className={`tree-area ${selected ? "has-detail" : ""}`}
            aria-label="Семейный архив"
          >
            <div className="canvas-heading">
              <span className="canvas-view-title">
                {view === "tree"
                  ? "Семейное древо"
                  : view === "family"
                    ? "Родственники"
                    : "Фотоальбом"}
              </span>
              {view === "tree" && (
                <div className="scope-switch">
                  <button
                    className={treeScope === "branch" ? "active" : ""}
                    onClick={() => setTreeScope("branch")}
                  >
                    Семейная ветвь
                  </button>
                  <button
                    className={treeScope === "all" ? "active" : ""}
                    onClick={() => setTreeScope("all")}
                  >
                    Весь род
                  </button>
                </div>
              )}
              <label className="generation-filter">
                <span className="visually-hidden">Поколение</span>
                <select
                  value={generationFilter}
                  onChange={(e) => {
                    setGenerationFilter(e.target.value);
                    setSelectedId(null);
                  }}
                >
                  <option value="all">Все поколения</option>
                  {generations.map((g) => (
                    <option value={g} key={g}>
                      {g + 1} поколение
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {cloudState === "error" && (
              <div className="connection-banner" role="status">
                Не удалось обновить данные.{" "}
                {people.length
                  ? "Показана сохранённая копия."
                  : "Проверьте подключение."}
                <button onClick={() => window.location.reload()}>
                  Повторить
                </button>
              </div>
            )}
            {people.length === 0 ? (
              <div className="empty-state">
                <div className="empty-album">
                  <div className="album-line" />
                  <Icon name="tree" size={64} />
                  <span>Истоки</span>
                  <small>Ваша семейная история</small>
                </div>
                <h2>
                  {cloudState === "loading"
                    ? "Открываем семейный архив…"
                    : "У каждой истории есть начало"}
                </h2>
                <p>
                  {cloudState === "loading"
                    ? "Собираем поколения и родственные связи."
                    : "Начните с одного имени. Добавьте близкого человека, его родителей и воспоминания — так вырастет история вашей семьи."}
                </p>
                {cloudState !== "loading" && (
                  <button
                    className="button primary"
                    onClick={() =>
                      canManage ? setEditor("new") : handleOwnerAccess()
                    }
                  >
                    <Icon name="plus" size={18} />
                    {canManage
                      ? "Добавить первого человека"
                      : "Войти и начать историю"}
                  </button>
                )}
              </div>
            ) : view === "tree" && !visiblePeople.length ? (
              <div className="inline-empty">
                <Icon name="search" size={30} />
                <h2>Никого не нашли</h2>
                <p>Попробуйте другое имя или поколение.</p>
                <button
                  className="button ghost"
                  onClick={() => {
                    setQuery("");
                    setGenerationFilter("all");
                  }}
                >
                  Сбросить фильтры
                </button>
              </div>
            ) : view === "tree" ? (
              <>
                <div
                  className="tree-board"
                  ref={boardRef}
                  onPointerDown={(event) => {
                    if (
                      event.pointerType === "touch" ||
                      event.button !== 0 ||
                      event.target.closest(
                        "button, input, select, .positioned-person",
                      )
                    )
                      return;
                    panRef.current = {
                      id: event.pointerId,
                      x: event.clientX,
                      y: event.clientY,
                      left: event.currentTarget.scrollLeft,
                      top: event.currentTarget.scrollTop,
                    };
                    event.currentTarget.setPointerCapture(event.pointerId);
                    event.currentTarget.classList.add("is-panning");
                  }}
                  onPointerMove={(event) => {
                    const pan = panRef.current;
                    if (!pan || pan.id !== event.pointerId) return;
                    event.currentTarget.scrollLeft =
                      pan.left - (event.clientX - pan.x);
                    event.currentTarget.scrollTop =
                      pan.top - (event.clientY - pan.y);
                  }}
                  onPointerUp={(event) => {
                    if (panRef.current?.id !== event.pointerId) return;
                    panRef.current = null;
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    event.currentTarget.classList.remove("is-panning");
                  }}
                  onPointerCancel={(event) => {
                    panRef.current = null;
                    event.currentTarget.classList.remove("is-panning");
                  }}
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget)
                      setSelectedId(null);
                  }}
                >
                  <div
                    className="tree-scaler"
                    style={{
                      width: `${stageWidth * scale}px`,
                      minWidth: `${stageWidth * scale}px`,
                      minHeight: `${stageHeight * scale}px`,
                    }}
                    onMouseDown={(event) => {
                      if (event.target === event.currentTarget)
                        setSelectedId(null);
                    }}
                  >
                    <div
                      className="tree-stage"
                      ref={stageRef}
                      style={{
                        width: `${stageWidth}px`,
                        minWidth: `${stageWidth}px`,
                        height: `${stageHeight}px`,
                        transform: `scale(${scale})`,
                      }}
                      onMouseDown={(event) => {
                        if (event.target === event.currentTarget)
                          setSelectedId(null);
                      }}
                    >
                      <>
                        {familyLayout.clusters.map((cluster) => (
                          <div
                            className={`family-cluster ${focusIds && !cluster.people.some((person) => focusIds.has(person.id)) ? "is-dimmed" : ""}`}
                            key={cluster.id}
                            style={{
                              "--family-color": branchColor(cluster.id),
                              left: `${cluster.x + canvasOffsetX - 14}px`,
                              top: `${cluster.y + canvasOffsetY - 14}px`,
                              width: `${cluster.width + 28}px`,
                              height: `${cluster.height + 28}px`,
                            }}
                            aria-hidden="true"
                          >
                            <span>В браке</span>
                          </div>
                        ))}
                        {familyLayout.generations.map((row) => (
                          <div
                            className="generation-guide"
                            key={row.generation}
                            style={{ top: `${row.y + canvasOffsetY - 38}px` }}
                            aria-hidden="true"
                          >
                            <span>{row.generation + 1} поколение</span>
                          </div>
                        ))}
                        <TreeConnections
                          people={visiblePeople}
                          nodes={nodeRefs}
                          stage={stageRef}
                          scale={scale}
                          selectedId={selectedId}
                        />
                        {familyLayout.cards.map((card) => (
                          <PositionedPerson
                            key={card.person.id}
                            card={card}
                            selectedId={selectedId}
                            focusIds={focusIds}
                            onSelect={selectPerson}
                            register={register}
                            canManage={canManage && manualLayout}
                            scale={scale}
                            canvasOffsetX={canvasOffsetX}
                            canvasOffsetY={canvasOffsetY}
                            onDragEnd={handlePersonDrag}
                          />
                        ))}
                        {!visiblePeople.length && (
                          <div className="no-results">
                            Никого не нашли. Попробуйте изменить запрос.
                          </div>
                        )}
                      </>
                    </div>
                  </div>
                </div>
                {treeScope === "branch" && !query && branchRoot && (
                  <div className="branch-caption">
                    <span>Ветвь семьи</span>
                    <strong>{branchRoot.name}</strong>
                    <small>
                      {visiblePeople.length} человек · выберите карточку
                    </small>
                  </div>
                )}
                <div className="canvas-footer">
                  <div className="connection-legend">
                    <span>
                      <i />
                      Родители и дети
                    </span>
                    <span>
                      <i className="marriage" />В браке
                    </span>
                    <span>
                      <i className="former" />
                      Бывший брак
                    </span>
                  </div>
                  <div className="zoom-controls" aria-label="Масштаб">
                    <button
                      onClick={() =>
                        setScale((v) => Math.max(0.08, +(v - 0.1).toFixed(2)))
                      }
                      aria-label="Уменьшить"
                    >
                      −
                    </button>
                    <output>{Math.round(scale * 100)}%</output>
                    <button
                      onClick={() =>
                        setScale((v) => Math.min(1.5, +(v + 0.1).toFixed(2)))
                      }
                      aria-label="Увеличить"
                    >
                      +
                    </button>
                    <button
                      className="center-button"
                      onClick={fitTree}
                      title="Вместить всё древо"
                    >
                      <Icon name="target" size={17} />
                    </button>
                  </div>
                </div>
                {selected && (
                  <button
                    className="selection-reset"
                    onClick={() => setSelectedId(null)}
                  >
                    Показаны прямые связи · Снять выделение{" "}
                    <Icon name="close" size={13} />
                  </button>
                )}
              </>
            ) : view === "family" ? (
              <div className="directory">
                <div className="directory-heading">
                  <span>Найдено: {directoryPeople.length}</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    aria-label="Сортировка"
                  >
                    <option value="name">По имени</option>
                    <option value="birth">По дате рождения</option>
                  </select>
                </div>
                <div className="family-table">
                  <div className="table-head">
                    <span>Родственник</span>
                    <span>Годы жизни</span>
                    <span>Место рождения</span>
                    <span>Поколение</span>
                  </div>
                  {directoryPeople.map((person) => (
                    <button
                      className={`table-row ${selectedId === person.id ? "selected" : ""}`}
                      key={person.id}
                      onClick={() => selectPerson(person.id)}
                    >
                      <span className="table-person">
                        <Portrait person={person} className="list-avatar" />
                        <span>
                          <strong>{person.name}</strong>
                          <small>
                            {person.maidenName
                              ? `урожд. ${person.maidenName}`
                              : person.relation}
                          </small>
                        </span>
                      </span>
                      <span>{formatLifespan(person)}</span>
                      <span>{person.birthplace || "Не указано"}</span>
                      <span>
                        {person.generation + 1}
                        <Icon name="chevron" size={15} />
                      </span>
                    </button>
                  ))}
                </div>
                {!directoryPeople.length && (
                  <div className="inline-empty">
                    <Icon name="search" size={30} />
                    <h2>Никого не нашли</h2>
                    <p>Попробуйте другое имя или поколение.</p>
                    <button
                      className="button ghost"
                      onClick={() => {
                        setQuery("");
                        setGenerationFilter("all");
                      }}
                    >
                      Сбросить фильтры
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="photo-gallery">
                {photoPeople.map((person) => (
                  <button
                    className="album-photo"
                    onClick={() => selectPerson(person.id)}
                    key={person.id}
                  >
                    <div>
                      <img
                        src={person.photo}
                        alt={person.name}
                        style={{
                          objectFit: "contain",
                          objectPosition: "center",
                        }}
                        loading="lazy"
                      />
                    </div>
                    <strong>{person.name}</strong>
                    <span>{formatLifespan(person)}</span>
                  </button>
                ))}
                {!photoPeople.length && (
                  <div className="inline-empty">
                    <Icon name="photo" size={36} />
                    <h2>Место для воспоминаний</h2>
                    <p>
                      {query || generationFilter !== "all"
                        ? "Для выбранных родственников пока нет фотографий."
                        : "Фотографии появятся здесь, когда вы добавите их в карточки родственников."}
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="workspace-status">
              <span>
                {people.length} человек · {generations.length} поколений
              </span>
              <span>
                {view === "tree"
                  ? "Выберите карточку, чтобы увидеть родственные связи"
                  : "Выберите человека, чтобы открыть его историю"}
              </span>
              {canManage && (
                <button onClick={() => setManualLayout((v) => !v)}>
                  {manualLayout
                    ? "Автоматическая раскладка"
                    : "Ручная раскладка"}
                </button>
              )}
              {canManage && hasManualLayout && manualLayout && (
                <button onClick={resetLayout}>Сбросить позиции</button>
              )}
            </div>
          </section>
          <DetailPanel
            person={selected}
            people={people}
            canEdit={canManage}
            expanded={sheetExpanded}
            onToggleExpand={() => setSheetExpanded((v) => !v)}
            onClose={() => setSelectedId(null)}
            onEdit={() => setEditor(selected)}
            onDelete={() => setDeleteCandidate(selected)}
            onSelect={selectPerson}
            onFocus={() => {
              setRootId(selected.id);
              setTreeScope("branch");
              setQuery("");
              setGenerationFilter("all");
              setView("tree");
            }}
          />
        </main>
      </div>
      {helpOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setHelpOpen(false)}
        >
          <section
            className="help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
          >
            <button
              className="icon-button detail-close"
              onClick={() => setHelpOpen(false)}
              aria-label="Закрыть справку"
            >
              <Icon name="close" />
            </button>
            <Icon name="book" size={32} />
            <h2 id="help-title">У каждой связи — своя история</h2>
            <p>
              Нажмите на человека: его ближайшие родные останутся выделенными, а
              справа откроется история жизни.
            </p>
            <ul>
              <li>Сплошные линии связывают родителей и детей.</li>
              <li>Двойные кольца обозначают брак, пунктир — бывший брак.</li>
              <li>Масштаб и кнопка с прицелом помогут увидеть всё древо.</li>
              <li>
                Поиск находит родственника и показывает его ближайшую семью.
              </li>
              <li>
                Владелец может добавлять людей, менять связи и перемещать
                карточки.
              </li>
            </ul>
            <button
              className="button primary"
              onClick={() => setHelpOpen(false)}
            >
              Вернуться к семье
            </button>
          </section>
        </div>
      )}
      {editor && (
        <PersonEditor
          person={editor === "new" ? null : editor}
          people={people}
          onSave={savePerson}
          onClose={() => setEditor(false)}
        />
      )}
      {deleteCandidate && (
        <ConfirmDelete
          person={deleteCandidate}
          onConfirm={deletePerson}
          onClose={() => setDeleteCandidate(null)}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
