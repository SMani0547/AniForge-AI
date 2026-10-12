import { describe, expect, it } from 'vitest';
import { assetSchema, canvasSchema, createProjectSchema, emptyScene, sceneSchema, timelineSchema, updateSceneSchema } from './index.js';

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
  it('requires a revision and actual content when saving without accepting client-owned asset references', () => {
    expect(updateSceneSchema.safeParse({ title: 'New title' }).success).toBe(false);
    expect(updateSceneSchema.safeParse({ expectedRevision: 0 }).success).toBe(false);
    expect(updateSceneSchema.safeParse({ expectedRevision: 0, title: 'New title', sourceAssetIds: ['foreign'] }).success).toBe(false);
    expect(updateSceneSchema.parse({ expectedRevision: 3, title: 'New title' })).toEqual({ expectedRevision: 3, title: 'New title' });
  });
  it('upgrades earlier scene documents to revision zero', () => {
    const scene = emptyScene('project_1', 'scene_1', '2026-10-12T00:00:00.000Z');
    const { revision: _revision, ...earlierScene } = scene;
    expect(sceneSchema.parse(earlierScene).revision).toBe(0);
  });
  it('round-trips image crop metadata but rejects embedded image content', () => {
    const canvas = { width: 1920, height: 1080, background: '#111827', objects: [{ id: 'image_1', type: 'image', assetId: 'asset_1', x: 20, y: 40, width: 400, height: 300, rotation: 15, opacity: 1, locked: false, hidden: false, zIndex: 0, fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 0, crop: { x: 10, y: 20, width: 200, height: 150 } }] };
    expect(canvasSchema.parse(JSON.parse(JSON.stringify(canvas)))).toEqual(canvas);
    expect(canvasSchema.safeParse({ ...canvas, objects: [{ ...canvas.objects[0], src: 'data:image/png;base64,bytes' }] }).success).toBe(false);
    expect(canvasSchema.safeParse({ ...canvas, objects: [...canvas.objects, ...canvas.objects] }).success).toBe(false);
  });
  it('rejects media metadata without affirmation or with excessive dimensions', () => {
    const asset = { id: 'asset_1', ownerId: 'alice', projectId: 'project_1', sceneId: 'scene_1', mimeType: 'image/png', sizeBytes: 1024, width: 1920, height: 1080, copyrightAttested: true, createdAt: '2026-10-12T00:00:00.000Z' };
    expect(assetSchema.safeParse(asset).success).toBe(true);
    expect(assetSchema.safeParse({ ...asset, copyrightAttested: false }).success).toBe(false);
    expect(assetSchema.safeParse({ ...asset, width: 16000, height: 16000 }).success).toBe(false);
  });
});
