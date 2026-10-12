import { describe, expect, it } from 'vitest';
import { analyzeSceneSchema, analysisResultSchema, assetSchema, canvasSchema, createProjectSchema, editVideoSchema, emptyScene, exportVideoSchema, sceneSchema, selectVersionSchema, timelineSchema, updateSceneSchema, videoJobSchema } from './index.js';

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

describe('revision and timeline boundaries', () => {
  const jobId = 'bd7f7d76-d0c6-4fb9-ad7f-41ab407fd381';
  it('accepts explicit edit methods without client-supplied interaction IDs or URLs', () => {
    const input = { jobId, prompt: ' Make the original square purple. ', copyrightAttested: true, confirmPaid: true };
    expect(editVideoSchema.parse(input)).toMatchObject({ prompt: 'Make the original square purple.', mode: 'interaction' });
    expect(editVideoSchema.parse({ ...input, mode: 'upload' }).mode).toBe('upload');
    for (const changes of [{ interactionId: 'stolen' }, { videoUrl: 'https://attacker.invalid' }, { mode: 'automatic' }, { prompt: '   ' }, { prompt: 'x'.repeat(8001) }, { confirmPaid: false }, { copyrightAttested: false }]) expect(editVideoSchema.safeParse({ ...input, ...changes }).success).toBe(false);
  });
  it('requires a revision for version selection and disallows client media paths on export', () => {
    expect(selectVersionSchema.parse({ expectedRevision: 3, versionId: 'original' })).toEqual({ expectedRevision: 3, versionId: 'original' });
    expect(selectVersionSchema.safeParse({ versionId: 'original' }).success).toBe(false);
    expect(updateSceneSchema.safeParse({ expectedRevision: 3, selectedVideoVersionId: 'original', timeline: { trimStart: 0.2, trimEnd: 0, captions: [] } }).success).toBe(true);
    expect(exportVideoSchema.safeParse({ sceneId: 'scene', versionId: 'version', storagePath: 'other-user/video' }).success).toBe(false);
  });
  it('allows a full-remaining-clip trim while rejecting empty/reversed clips and duplicate captions', () => {
    expect(timelineSchema.safeParse({ trimStart: 1, trimEnd: 0, captions: [] }).success).toBe(true);
    expect(timelineSchema.safeParse({ trimStart: 1, trimEnd: 1, captions: [] }).success).toBe(false);
    const caption = { id: 'caption', text: 'Original caption', start: 0.1, end: 0.6 };
    expect(timelineSchema.safeParse({ trimStart: 0, trimEnd: 0, captions: [caption, caption] }).success).toBe(false);
    expect(timelineSchema.safeParse({ trimStart: 0, trimEnd: 0, captions: [{ ...caption, end: 0.1 }] }).success).toBe(false);
  });
  it('reads earlier initial job records without a migration', () => {
    const raw = { id: jobId, projectId: 'project', sceneId: 'scene', status: 'succeeded', sourceRevision: 1, snapshotAssetId: 'snapshot', createdAt: '2026-10-12T00:00:00.000Z', updatedAt: '2026-10-12T00:00:00.000Z', resultVersionId: jobId, errorCode: null, errorMessage: null };
    expect(videoJobSchema.parse(raw)).toMatchObject({ generationKind: 'initial', parentVersionId: null, editMode: null });
  });
  it('preserves historical timeline values while requiring correction before a new timeline write', () => {
    const timeline = { trimStart: 2, trimEnd: 2, captions: [{ id: 'legacy', text: 'Keep the first caption', start: 1, end: 1 }, { id: 'legacy', text: 'Keep the second caption', start: 1, end: 2 }] };
    const scene = emptyScene('project', 'scene', '2026-10-12T00:00:00.000Z');
    const loaded = sceneSchema.parse({ ...scene, timeline });
    expect(loaded.timeline).toEqual(timeline);
    expect(updateSceneSchema.safeParse({ expectedRevision: loaded.revision, timeline: loaded.timeline }).success).toBe(false);
    const corrected = { ...loaded.timeline, trimEnd: 0, captions: [{ ...loaded.timeline.captions[0]!, end: 1.5 }, { ...loaded.timeline.captions[1]!, id: 'repaired-caption' }] };
    expect(updateSceneSchema.parse({ expectedRevision: loaded.revision, timeline: corrected }).timeline).toEqual(corrected);
    expect(loaded.timeline).toEqual(timeline);
    expect(sceneSchema.safeParse({ ...scene, timeline: { ...timeline, trimEnd: 1 } }).success).toBe(false);
    expect(sceneSchema.safeParse({ ...scene, timeline: { ...timeline, captions: [{ ...timeline.captions[0]!, end: 0.5 }] } }).success).toBe(false);
  });
});

describe('analysis boundary schemas', () => {
  const request = { analysisId: 'bd7f7d76-d0c6-4fb9-ad7f-41ab407fd381', expectedRevision: 4, snapshotAssetId: 'snapshot_1', notes: 'Original geometric sketch', copyrightAttested: true, confirmPaid: true };
  it('requires explicit content rights and paid consent with a revision and stable request ID', () => {
    expect(analyzeSceneSchema.parse(request)).toEqual(request);
    for (const field of ['analysisId', 'expectedRevision', 'snapshotAssetId', 'copyrightAttested', 'confirmPaid']) {
      const incomplete: Record<string, unknown> = { ...request }; delete incomplete[field];
      expect(analyzeSceneSchema.safeParse(incomplete).success).toBe(false);
    }
    expect(analyzeSceneSchema.safeParse({ ...request, confirmPaid: false }).success).toBe(false);
    expect(analyzeSceneSchema.safeParse({ ...request, copyrightAttested: false }).success).toBe(false);
  });
  it('rejects URLs, client-selected models and excessive notes at the analysis boundary', () => {
    expect(analyzeSceneSchema.safeParse({ ...request, snapshotAssetId: 'https://example.com/private.png' }).success).toBe(false);
    expect(analyzeSceneSchema.safeParse({ ...request, model: 'client-selected-provider' }).success).toBe(false);
    expect(analyzeSceneSchema.safeParse({ ...request, ownerId: 'another-user' }).success).toBe(false);
    expect(analyzeSceneSchema.safeParse({ ...request, notes: 'x'.repeat(8001) }).success).toBe(false);
  });
  it('validates suggested plans while excluding server-only interaction metadata', () => {
    const result = { analysisId: request.analysisId, sourceRevision: 4, snapshotAssetId: 'snapshot_1', model: 'unit-test-fixture', analyzedAt: '2026-10-12T00:00:00.000Z', shotPlan: { sceneSummary: 'An original geometric shape', subjects: [{ name: 'Shape', appearance: 'A blue rectangle' }], action: 'Slight movement', camera: { shotType: 'Wide', movement: 'Static' }, environment: 'Plain background', mood: 'Calm', animationPrompt: 'Move the original blue rectangle gently.', preserve: ['Blue color'], uncertainties: [] } };
    expect(analysisResultSchema.parse(JSON.parse(JSON.stringify(result)))).toEqual(result);
    expect(analysisResultSchema.safeParse({ ...result, interactionId: 'server-only' }).success).toBe(false);
    expect(analysisResultSchema.safeParse({ ...result, shotPlan: { ...result.shotPlan, subjects: [] } }).success).toBe(false);
    const scene = emptyScene('project_1', 'scene_1', result.analyzedAt);
    const saved = sceneSchema.parse({ ...scene, shotPlan: result.shotPlan });
    expect(saved.canvas).toEqual(scene.canvas);
    expect(saved.shotPlan).toEqual(result.shotPlan);
  });
});
