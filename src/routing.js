// Rectilinear routes live in the whitespace around measured card bounds.
// A single obstacle graph is shared by every connection in a render.
const CLEARANCE = 16;
const EPS = 0.01;
export function intersectsCard(a, b, r) {
  if (Math.abs(a.x - b.x) < EPS)
    return (
      a.x > r.left + EPS &&
      a.x < r.right - EPS &&
      Math.max(a.y, b.y) > r.top + EPS &&
      Math.min(a.y, b.y) < r.bottom - EPS
    );
  return (
    a.y > r.top + EPS &&
    a.y < r.bottom - EPS &&
    Math.max(a.x, b.x) > r.left + EPS &&
    Math.min(a.x, b.x) < r.right - EPS
  );
}
function simplify(points) {
  return points.filter(
    (p, i) =>
      !i ||
      i === points.length - 1 ||
      !(
        (points[i - 1].x === p.x && p.x === points[i + 1].x) ||
        (points[i - 1].y === p.y && p.y === points[i + 1].y)
      ),
  );
}
export function roundedPath(points, radius = 7) {
  if (!points.length) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1],
      b = points[i],
      c = points[i + 1];
    const before = Math.min(
      radius,
      (Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / 2,
    );
    const after = Math.min(
      radius,
      (Math.abs(c.x - b.x) + Math.abs(c.y - b.y)) / 2,
    );
    const p = {
      x: b.x - Math.sign(b.x - a.x) * before,
      y: b.y - Math.sign(b.y - a.y) * before,
    };
    const q = {
      x: b.x + Math.sign(c.x - b.x) * after,
      y: b.y + Math.sign(c.y - b.y) * after,
    };
    d += ` L ${p.x} ${p.y} Q ${b.x} ${b.y} ${q.x} ${q.y}`;
  }
  const last = points.at(-1);
  return d + ` L ${last.x} ${last.y}`;
}
class Heap {
  values = [];
  push(item) {
    const v = this.values;
    v.push(item);
    let i = v.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (v[p].score <= item.score) break;
      v[i] = v[p];
      i = p;
    }
    v[i] = item;
  }
  pop() {
    const v = this.values,
      first = v[0],
      last = v.pop();
    if (v.length) {
      let i = 0;
      while (i * 2 + 1 < v.length) {
        let c = i * 2 + 1;
        if (c + 1 < v.length && v[c + 1].score < v[c].score) c++;
        if (v[c].score >= last.score) break;
        v[i] = v[c];
        i = c;
      }
      v[i] = last;
    }
    return first;
  }
}
export function createRouter(boxes, extraPoints = []) {
  const obstacles = boxes.map((r) => ({
    ...r,
    left: r.left - CLEARANCE,
    right: r.right + CLEARANCE,
    top: r.top - CLEARANCE,
    bottom: r.bottom + CLEARANCE,
  }));
  const clear = (a, b) => !obstacles.some((r) => intersectsCard(a, b, r));
  let grid;
  function buildGrid() {
    const xs = [
      ...new Set([
        ...obstacles.flatMap((r) => [r.left, r.right, (r.left + r.right) / 2]),
        ...extraPoints.map((p) => p.x),
      ]),
    ].sort((a, b) => a - b);
    const ys = [
      ...new Set([
        ...obstacles.flatMap((r) => [r.top, r.bottom, (r.top + r.bottom) / 2]),
        ...extraPoints.map((p) => p.y),
      ]),
    ].sort((a, b) => a - b);
    const w = xs.length,
      h = ys.length,
      edges = new Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x,
          a = { x: xs[x], y: ys[y] };
        edges[i] = [];
        if (
          obstacles.some(
            (r) =>
              a.x > r.left + EPS &&
              a.x < r.right - EPS &&
              a.y > r.top + EPS &&
              a.y < r.bottom - EPS,
          )
        )
          continue;
        for (const [nx, ny, dir] of [
          [x - 1, y, 0],
          [x, y - 1, 1],
        ]) {
          if (nx < 0 || ny < 0) continue;
          const j = ny * w + nx,
            b = { x: xs[nx], y: ys[ny] };
          if (clear(a, b)) {
            const distance = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
            edges[i].push([j, distance, dir]);
            edges[j].push([i, distance, dir]);
          }
        }
      }
    return { xs, ys, w, edges };
  }
  return (start, end) => {
    if (start.x === end.x && start.y === end.y) return [start];
    const candidates = [
      [start, { x: start.x, y: end.y }, end],
      [start, { x: end.x, y: start.y }, end],
    ];
    for (const y of [
      (start.y + end.y) / 2,
      ...obstacles.flatMap((r) => [r.top, r.bottom]),
    ])
      candidates.push([start, { x: start.x, y }, { x: end.x, y }, end]);
    const valid = candidates
      .filter((p) => p.slice(1).every((b, i) => clear(p[i], b)))
      .sort((a, b) => length(a) - length(b));
    if (valid.length) return simplify(valid[0]);
    grid ||= buildGrid();
    const { xs, ys, w, edges } = grid;
    const s = ys.indexOf(start.y) * w + xs.indexOf(start.x),
      t = ys.indexOf(end.y) * w + xs.indexOf(end.x);
    if (
      xs.indexOf(start.x) < 0 ||
      ys.indexOf(start.y) < 0 ||
      xs.indexOf(end.x) < 0 ||
      ys.indexOf(end.y) < 0
    )
      return [];
    const costs = new Map(),
      previous = new Map(),
      heap = new Heap();
    for (const dir of [0, 1]) {
      costs.set(s * 2 + dir, 0);
      heap.push({ state: s * 2 + dir, cost: 0, score: 0 });
    }
    let final;
    while (heap.values.length) {
      const entry = heap.pop(),
        node = Math.floor(entry.state / 2),
        dir = entry.state % 2;
      if (entry.cost !== costs.get(entry.state)) continue;
      if (node === t) {
        final = entry.state;
        break;
      }
      for (const [next, distance, nextDir] of edges[node]) {
        const state = next * 2 + nextDir,
          cost = entry.cost + distance + (nextDir === dir ? 0 : 32);
        if (cost >= (costs.get(state) ?? Infinity)) continue;
        costs.set(state, cost);
        previous.set(state, entry.state);
        const heuristic =
          Math.abs(xs[next % w] - end.x) +
          Math.abs(ys[Math.floor(next / w)] - end.y);
        heap.push({ state, cost, score: cost + heuristic });
      }
    }
    if (final === undefined) return []; // Never fall back to a line through a card.
    const points = [];
    for (let state = final; state !== undefined; state = previous.get(state)) {
      const node = Math.floor(state / 2);
      points.push({ x: xs[node % w], y: ys[Math.floor(node / w)] });
    }
    return simplify(points.reverse());
  };
}
function length(p) {
  return p
    .slice(1)
    .reduce(
      (sum, b, i) => sum + Math.abs(b.x - p[i].x) + Math.abs(b.y - p[i].y),
      0,
    );
}
function port(r, side) {
  const x = (r.left + r.right) / 2,
    y = (r.top + r.bottom) / 2;
  return side === "top"
    ? { x, y: r.top }
    : side === "bottom"
      ? { x, y: r.bottom }
      : side === "left"
        ? { x: r.left, y }
        : { x: r.right, y };
}
function exit(p, side) {
  return {
    x: p.x + (side === "left" ? -CLEARANCE : side === "right" ? CLEARANCE : 0),
    y: p.y + (side === "top" ? -CLEARANCE : side === "bottom" ? CLEARANCE : 0),
  };
}
export function buildConnections(people, bounds) {
  const boxes = [...bounds.values()],
    plans = [],
    marriages = [],
    families = [];
  const add = (a, b, sideA, sideB, meta, output) => {
    const p = port(a, sideA),
      q = port(b, sideB),
      start = exit(p, sideA),
      end = exit(q, sideB);
    plans.push({ p, q, start, end, meta, output });
  };
  const seen = new Set();
  people.forEach((person) =>
    (person.partnerIds || []).forEach((id) => {
      const key = [person.id, id].sort().join("--");
      if (seen.has(key)) return;
      seen.add(key);
      const a = bounds.get(person.id),
        b = bounds.get(id),
        other = people.find((p) => p.id === id);
      if (!a || !b || !other) return;
      const adjacent =
        Math.abs(a.top - b.top) < 1 &&
        !boxes.some(
          (r) =>
            r !== a &&
            r !== b &&
            r.left > Math.min(a.left, b.left) &&
            r.right < Math.max(a.right, b.right) &&
            r.top < a.bottom &&
            r.bottom > a.top,
        );
      const right = b.left > a.left;
      add(
        a,
        b,
        adjacent ? (right ? "right" : "left") : "top",
        adjacent ? (right ? "left" : "right") : "top",
        {
          id: key,
          people: [person.id, id],
          current:
            person.currentPartnerId === id ||
            other.currentPartnerId === person.id,
          former:
            (person.formerPartnerIds || []).includes(id) ||
            (other.formerPartnerIds || []).includes(person.id),
        },
        marriages,
      );
    }),
  );
  // Parent links use their own boundary ports. No averaged origin can land in an unrelated card.
  const groups = new Map();
  people.forEach((child) => {
    const parents = (child.parents || []).filter((id) => bounds.has(id)).sort();
    if (!parents.length || !bounds.has(child.id)) return;
    const key = parents.join("--");
    if (!groups.has(key)) groups.set(key, { parents, children: [] });
    groups.get(key).children.push(child.id);
  });
  groups.forEach(({ parents, children }, key) => {
    const parentBoxes = parents.map((id) => bounds.get(id)),
      childBoxes = children.map((id) => bounds.get(id));
    const below =
      childBoxes.reduce((s, r) => s + r.top, 0) / childBoxes.length >=
      parentBoxes.reduce((s, r) => s + r.bottom, 0) / parentBoxes.length;
    const side = below ? "bottom" : "top",
      targetSide = below ? "top" : "bottom";
    const ordered = [...parentBoxes].sort((a, b) => a.left - b.left);
    const paired =
      ordered.length === 2 &&
      Math.abs(ordered[0].top - ordered[1].top) < 1 &&
      ordered[1].left - ordered[0].right >= CLEARANCE * 2 &&
      !boxes.some(
        (r) =>
          !parentBoxes.includes(r) &&
          r.left < ordered[1].left &&
          r.right > ordered[0].right &&
          r.top < ordered[0].bottom &&
          r.bottom > ordered[0].top,
      );
    const hub = paired
      ? {
          x: (ordered[0].right + ordered[1].left) / 2,
          y: (ordered[0].top + ordered[0].bottom) / 2,
        }
      : {
          x:
            parentBoxes.reduce((s, r) => s + (r.left + r.right) / 2, 0) /
            parentBoxes.length,
          y: below
            ? Math.max(...parentBoxes.map((r) => r.bottom)) + 40
            : Math.min(...parentBoxes.map((r) => r.top)) - 40,
        };
    // If an irregular manual placement puts the hub in a card, use the first parent's safe exit.
    if (
      boxes.some(
        (r) =>
          hub.x > r.left - CLEARANCE &&
          hub.x < r.right + CLEARANCE &&
          hub.y > r.top - CLEARANCE &&
          hub.y < r.bottom + CLEARANCE,
      )
    )
      Object.assign(hub, exit(port(parentBoxes[0], side), side));
    const segments = [];
    const meta = { id: key, parentIds: parents, childIds: children };
    families.push({ ...meta, segments });
    parentBoxes.forEach((r) => {
      const portSide = paired ? (r === ordered[0] ? "right" : "left") : side;
      const p = port(r, portSide);
      plans.push({
        p,
        start: exit(p, portSide),
        end: hub,
        meta,
        output: segments,
      });
    });
    childBoxes.forEach((r) => {
      const q = port(r, targetSide);
      plans.push({
        q,
        start: hub,
        end: exit(q, targetSide),
        meta,
        output: segments,
      });
    });
  });
  const route = createRouter(
    boxes,
    plans.flatMap((p) => [p.start, p.end]),
  );
  plans.forEach((plan) => {
    const mid = route(plan.start, plan.end);
    if (!mid.length) return;
    const points = simplify([
      ...(plan.p ? [plan.p] : []),
      ...mid,
      ...(plan.q ? [plan.q] : []),
    ]);
    const entry = { ...plan.meta, points, d: roundedPath(points) };
    plan.output.push(entry);
  });
  return {
    marriages,
    paths: families.map((f) => ({
      ...f,
      d: f.segments.map((s) => s.d).join(" "),
    })),
  };
}
