import { describe, expect, it } from 'vitest';
import { emptySketch, sketchReducer, type Stroke } from './sketch';

const stroke: Stroke = { tool: 'pencil', color: '#e8edf7', width: 5, points: [10, 20, 30, 40] };
describe('local sketch history', () => {
  it('restores editable stroke objects through undo and redo', () => {
    const drawn = sketchReducer(emptySketch, { type: 'commit', strokes: [stroke] });
    const undone = sketchReducer(drawn, { type: 'undo' });
    expect(undone.present).toEqual([]);
    expect(sketchReducer(undone, { type: 'redo' }).present).toEqual([stroke]);
    expect(emptySketch.present).toEqual([]);
  });
  it('clears redo when a new stroke branches from an earlier sketch', () => {
    const drawn = sketchReducer(emptySketch, { type: 'commit', strokes: [stroke] });
    const undone = sketchReducer(drawn, { type: 'undo' });
    const branched = sketchReducer(undone, { type: 'commit', strokes: [{ ...stroke, color: '#75a7ff' }] });
    expect(branched.future).toEqual([]);
    expect(sketchReducer(branched, { type: 'redo' })).toBe(branched);
  });
  it('makes clearing the sketch reversible', () => {
    const drawn = sketchReducer(emptySketch, { type: 'commit', strokes: [stroke] });
    const cleared = sketchReducer(drawn, { type: 'commit', strokes: [] });
    expect(sketchReducer(cleared, { type: 'undo' }).present).toEqual([stroke]);
  });
});
