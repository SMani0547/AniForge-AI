import { describe, expect, it } from 'vitest';
import { canvasSchema, emptyScene } from '@aniforge/shared';
import { createShape, editorHistory, editorReducer, HISTORY_LIMIT, patchObject, resizeObject, strokeObject } from './editor';

const blank = emptyScene('project', 'scene', '2026-10-12T00:00:00.000Z').canvas;
describe('editable scene history and geometry', () => {
  it('keeps a bounded history and clears redo after a new branch', () => {
    let state = editorHistory(blank);
    for (let index = 0; index < HISTORY_LIMIT + 10; index++) state = editorReducer(state, { type: 'commit', canvas: { ...blank, objects: [{ ...createShape('rect', 'rectangle', 0, '#123456'), x: index }] } });
    expect(state.past).toHaveLength(HISTORY_LIMIT);
    const undone = editorReducer(state, { type: 'undo' });
    expect(undone.present.objects[0]?.x).toBe(HISTORY_LIMIT + 8);
    expect(editorReducer(undone, { type: 'redo' }).present).toEqual(state.present);
    expect(editorReducer(undone, { type: 'commit', canvas: blank }).future).toEqual([]);
  });
  it('serializes local stroke coordinates and resizes their actual points', () => {
    const stroke = strokeObject('stroke', 0, [200, 100, 400, 300], '#123456', 12, false);
    expect(stroke).toMatchObject({ x: 200, y: 100, width: 200, height: 200, points: [0, 0, 200, 200] });
    const resized = resizeObject(stroke, 400, 100);
    expect(resized).toMatchObject({ points: [0, 0, 400, 100], width: 400, height: 100 });
    const canvas = canvasSchema.parse({ ...blank, objects: [resized] });
    expect(canvasSchema.parse(JSON.parse(JSON.stringify(canvas)))).toEqual(canvas);
  });
  it('protects locked geometry while permitting an explicit unlock', () => {
    const object = { ...createShape('ellipse', 'ellipse', 0, '#123456'), locked: true };
    const canvas = { ...blank, objects: [object] };
    expect(patchObject(canvas, object.id, { x: 999 }).objects[0]).toEqual(object);
    expect(patchObject(canvas, object.id, { locked: false }, true).objects[0]?.locked).toBe(false);
  });
  it('preserves crop and asset references through edits, undo and JSON roundtrips', () => {
    const image = { ...createShape('rect', 'image', 0, '#123456'), type: 'image' as const, assetId: 'private-asset', crop: { x: 20, y: 30, width: 100, height: 200 } };
    const initial = editorHistory({ ...blank, objects: [image] });
    const changed = editorReducer(initial, { type: 'commit', canvas: patchObject(initial.present, image.id, { x: 800, opacity: 0.6 }) });
    expect(changed.present.objects[0]).toMatchObject({ assetId: 'private-asset', crop: image.crop, x: 800 });
    expect(editorReducer(changed, { type: 'undo' }).present).toEqual(initial.present);
    expect(JSON.stringify(changed.present)).not.toContain('data:');
  });
  it('normalizes layer order without mutating prior history', () => {
    const first = createShape('rect', 'first', 4, '#123456');
    const second = createShape('text', 'second', 9, '#123456');
    const initial = editorHistory({ ...blank, objects: [first, second] });
    const reordered = editorReducer(initial, { type: 'commit', canvas: { ...blank, objects: [second, first] } });
    expect(reordered.present.objects.map((object) => [object.id, object.zIndex])).toEqual([['second', 0], ['first', 1]]);
    expect(initial.present.objects[0]?.zIndex).toBe(4);
  });
});
