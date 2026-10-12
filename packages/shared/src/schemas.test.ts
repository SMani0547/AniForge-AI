import { describe, expect, it } from 'vitest';
import { canvasSchema, createProjectSchema, emptyScene, sceneSchema, timelineSchema } from './index.js';

describe('persisted source schemas', () => {
  it('round-trips editable scene JSON independently of Konva', () => {
    const scene = emptyScene('project_1', 'scene_1', new Date().toISOString());
    scene.canvas.objects.push({ id: 'shape_1', type: 'rect', x: 120, y: 80, width: 250, height: 200, rotation: 0, opacity: 0.7, locked: false, hidden: false, zIndex: 0, fill: '#4285F4', stroke: '#FFFFFF', strokeWidth: 2 });
    expect(sceneSchema.parse(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
  });
  it('rejects identity injection and empty titles', () => {
    expect(createProjectSchema.safeParse({ title: 'Sketch', ownerId: 'victim' }).success).toBe(false);
    expect(createProjectSchema.safeParse({ title: '   ' }).success).toBe(false);
  });
  it('rejects noncanonical canvas sizes, embedded media and reverse trim ranges', () => {
    expect(canvasSchema.safeParse({ width: 1280, height: 720, background: '#111827', objects: [] }).success).toBe(false);
    expect(canvasSchema.safeParse({ width: 1920, height: 1080, background: '#111827', objects: [], image: 'data:image/png;base64,secret' }).success).toBe(false);
    expect(timelineSchema.safeParse({ trimStart: 8, trimEnd: 2, captions: [] }).success).toBe(false);
  });
});
