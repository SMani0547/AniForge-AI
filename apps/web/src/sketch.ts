export type SketchTool = 'pencil' | 'brush' | 'eraser';
export interface Stroke { tool: SketchTool; color: string; points: number[]; width: number }
export interface SketchHistory { past: Stroke[][]; present: Stroke[]; future: Stroke[][] }
export const emptySketch: SketchHistory = { past: [], present: [], future: [] };
export type SketchAction = { type: 'commit'; strokes: Stroke[] } | { type: 'undo' } | { type: 'redo' };

export function sketchReducer(state: SketchHistory, action: SketchAction): SketchHistory {
  if (action.type === 'commit') {
    return { past: [...state.past.slice(-49), state.present], present: action.strokes, future: [] };
  }
  if (action.type === 'undo') {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
  }
  const next = state.future[0];
  if (!next) return state;
  return { past: [...state.past, state.present], present: next, future: state.future.slice(1) };
}
