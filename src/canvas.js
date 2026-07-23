export const MIN_CANVAS_SCALE = 0.08;
export const MAX_CANVAS_SCALE = 1.25;

export function clampCanvasScale(value) {
  const safeValue = Number.isFinite(value) ? value : 1;
  return +Math.min(MAX_CANVAS_SCALE, Math.max(MIN_CANVAS_SCALE, safeValue)).toFixed(3);
}

export function wheelCanvasScale(currentScale, deltaY) {
  return clampCanvasScale(currentScale * Math.exp(-deltaY * 0.002));
}

export function pinchCanvasScale(startScale, startDistance, currentDistance) {
  if (!Number.isFinite(startDistance) || startDistance <= 0) return clampCanvasScale(startScale);
  return clampCanvasScale(startScale * currentDistance / startDistance);
}
