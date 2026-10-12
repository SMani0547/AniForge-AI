import { canvasSchema, type Canvas, type CanvasObject } from '@aniforge/shared';

export type EditorTool = 'select' | 'pencil' | 'brush' | 'eraser' | 'rect' | 'ellipse' | 'line' | 'text' | 'pan';
export type History = { past: Canvas[]; present: Canvas; future: Canvas[] };
export type EditorAction = { type: 'commit'; canvas: Canvas } | { type: 'undo' } | { type: 'redo' };
export const HISTORY_LIMIT = 60;
export function editorHistory(canvas: Canvas): History { return { past: [], present: canvasSchema.parse(canvas), future: [] }; }
export function editorReducer(history: History, action: EditorAction): History {
  if (action.type === 'undo') {
    const previous = history.past.at(-1);
    return previous ? { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future].slice(0, HISTORY_LIMIT) } : history;
  }
  if (action.type === 'redo') {
    const next = history.future[0];
    return next ? { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: history.future.slice(1) } : history;
  }
  const canvas = canvasSchema.parse({ ...action.canvas, objects: action.canvas.objects.map((object, index) => ({ ...object, zIndex: index })) });
  if (JSON.stringify(canvas) === JSON.stringify(history.present)) return history;
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: canvas, future: [] };
}

export const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
export function baseObject(id: string, zIndex: number, color: string) {
  return { id, x: 160, y: 160, width: 480, height: 260, rotation: 0, opacity: 1, locked: false, hidden: false, zIndex, fill: color, stroke: color, strokeWidth: 5 };
}
export function createShape(type: 'rect' | 'ellipse' | 'line' | 'text', id: string, zIndex: number, color: string): CanvasObject {
  const base = baseObject(id, zIndex, color);
  if (type === 'text') return { ...base, height: 100, text: 'Your original story', fontSize: 64, strokeWidth: 0, type };
  if (type === 'line') return { ...base, type, points: [0, 0, base.width, base.height] };
  return { ...base, type };
}
export function strokeObject(id: string, zIndex: number, points: number[], color: string, width: number, eraser: boolean): CanvasObject {
  const xs = points.filter((_, index) => index % 2 === 0);
  const ys = points.filter((_, index) => index % 2 !== 0);
  const x = Math.min(...xs); const y = Math.min(...ys);
  return { ...baseObject(id, zIndex, color), type: 'brushStroke', tool: eraser ? 'eraser' : 'brush', x, y, width: Math.max(0.1, Math.max(...xs) - x), height: Math.max(0.1, Math.max(...ys) - y), strokeWidth: width, points: points.map((point, index) => point - (index % 2 === 0 ? x : y)) };
}
export function resizeObject(object: CanvasObject, width: number, height: number): CanvasObject {
  const next = { ...object, width: clamp(width, 0.1, 10000), height: clamp(height, 0.1, 10000) };
  if (next.type === 'line' || next.type === 'brushStroke') next.points = next.points.map((point, index) => point * (index % 2 === 0 ? next.width / object.width : next.height / object.height));
  return next;
}
export function patchObject(canvas: Canvas, id: string, patch: Partial<CanvasObject>, allowLocked = false): Canvas {
  return { ...canvas, objects: canvas.objects.map((object) => {
    if (object.id !== id || (object.locked && !allowLocked)) return object;
    const resized = patch.width !== undefined || patch.height !== undefined ? resizeObject(object, patch.width ?? object.width, patch.height ?? object.height) : object;
    return { ...resized, ...patch } as CanvasObject;
  }) };
}
export function layerName(object: CanvasObject): string {
  if (object.type === 'text') return object.text.trim().slice(0, 35) || 'Text';
  if (object.type === 'brushStroke') return object.tool === 'eraser' ? 'Eraser stroke' : 'Brush stroke';
  return { rect: 'Rectangle', ellipse: 'Ellipse', image: 'Imported image', line: 'Line' }[object.type];
}
