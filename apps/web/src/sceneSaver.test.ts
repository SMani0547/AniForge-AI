import { describe, expect, it, vi } from 'vitest';
import { emptyScene, type Scene, type ShotPlan } from '@aniforge/shared';
import { ApiError } from './api';
import { SceneSaver, type SceneDocument } from './sceneSaver';

const scene = emptyScene('project', 'scene', '2026-10-12T00:00:00.000Z');
const first = { ...scene.canvas, background: '#123456' };
const second = { ...scene.canvas, background: '#654321' };
const plan: ShotPlan = { sceneSummary: 'Original geometric scene', subjects: [{ name: 'Triangle', appearance: 'Blue paper shape' }], action: 'The shape floats', camera: { shotType: 'Wide', movement: 'Static' }, environment: 'White background', mood: 'Calm', animationPrompt: 'A blue triangle floats slowly.', preserve: ['Keep the blue color'], uncertainties: [] };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function document(canvas = scene.canvas, shotPlan: ShotPlan | null = null): SceneDocument { return { canvas, shotPlan, timeline: scene.timeline, selectedVideoVersionId: null }; }

describe('revision checked scene persistence', () => {
  it('saves concurrent canvas and shot plan edits together without clobbering either', async () => {
    const pending = deferred<Scene>();
    const write = vi.fn<(revision: number, document: SceneDocument) => Promise<Scene>>().mockImplementationOnce(() => pending.promise).mockImplementation(async (revision, document) => ({ ...scene, ...document, revision: revision + 1 }));
    const saver = new SceneSaver(scene, write);
    saver.setShotPlan(plan);
    const completion = saver.save();
    saver.setCanvas(first);
    saver.setShotPlan({ ...plan, animationPrompt: 'The triangle spins.' });
    pending.resolve({ ...scene, shotPlan: plan, revision: 1 });
    await completion;
    expect(write.mock.calls).toEqual([[0, document(scene.canvas, plan)], [1, document(first, { ...plan, animationPrompt: 'The triangle spins.' })]]);
    expect(saver.state).toMatchObject({ status: 'saved', dirty: false, revision: 2 });
  });
  it('keeps incomplete shot plan drafts locally, then saves after validation is repaired', async () => {
    const write = vi.fn(async (revision: number, document: SceneDocument) => ({ ...scene, ...document, revision: revision + 1 }));
    const saver = new SceneSaver(scene, write);
    saver.setCanvas(first);
    saver.setShotPlan({ ...plan, animationPrompt: '' });
    await saver.save();
    expect(write).not.toHaveBeenCalled();
    expect(saver.state).toMatchObject({ status: 'error', dirty: true });
    expect(saver.document.shotPlan?.animationPrompt).toBe('');
    saver.setShotPlan(plan);
    await saver.save();
    expect(write).toHaveBeenCalledWith(0, document(first, plan));
    expect(saver.state.status).toBe('saved');
  });
  it('retains the local plan and drawing when a shot plan write conflicts', async () => {
    const write = vi.fn().mockRejectedValue(new ApiError('Revision changed.', 409));
    const saver = new SceneSaver({ ...scene, shotPlan: plan }, write);
    saver.setShotPlan({ ...plan, action: 'A new action' });
    saver.setCanvas(first); await saver.save();
    saver.setShotPlan({ ...plan, action: 'A later action' }); await saver.save();
    expect(write).toHaveBeenCalledTimes(1);
    expect(saver.document).toEqual(document(first, { ...plan, action: 'A later action' }));
    expect(saver.state.status).toBe('conflict');
  });
  it('serializes writes and saves edits made while an earlier request is in flight', async () => {
    const pending = deferred<Scene>();
    const write = vi.fn<(revision: number, document: SceneDocument) => Promise<Scene>>().mockImplementationOnce(() => pending.promise).mockImplementationOnce(async (revision, document) => ({ ...scene, ...document, revision: revision + 1 }));
    const saver = new SceneSaver(scene, write);
    saver.setCanvas(first); const completion = saver.save();
    saver.setCanvas(second);
    expect(saver.save()).toBe(completion);
    expect(write).toHaveBeenCalledTimes(1);
    pending.resolve({ ...scene, canvas: first, revision: 1 }); await completion;
    expect(write.mock.calls).toEqual([[0, document(first)], [1, document(second)]]);
    expect(saver.state).toMatchObject({ status: 'saved', dirty: false, revision: 2 });
  });
  it('persists an undo back to the original during an in-flight save', async () => {
    const pending = deferred<Scene>();
    const write = vi.fn<(revision: number, document: SceneDocument) => Promise<Scene>>().mockImplementationOnce(() => pending.promise).mockImplementationOnce(async (revision, document) => ({ ...scene, ...document, revision: revision + 1 }));
    const saver = new SceneSaver(scene, write);
    saver.setCanvas(first); const completion = saver.save(); saver.setCanvas(scene.canvas);
    pending.resolve({ ...scene, canvas: first, revision: 1 }); await completion;
    expect(write.mock.calls).toEqual([[0, document(first)], [1, document(scene.canvas)]]);
    expect(saver.state.dirty).toBe(false);
  });
  it('keeps local edits after conflict and does not overwrite newer server data', async () => {
    const write = vi.fn().mockRejectedValue(new ApiError('Scene changed in another tab.', 409));
    const saver = new SceneSaver(scene, write);
    saver.setCanvas(first); await saver.save();
    saver.setCanvas(second); await saver.save();
    expect(write).toHaveBeenCalledTimes(1);
    expect(saver.state).toMatchObject({ status: 'conflict', dirty: true, revision: 0 });
  });
  it('keeps failed writes dirty and retries using the latest canvas', async () => {
    const write = vi.fn<(revision: number, document: SceneDocument) => Promise<Scene>>().mockRejectedValueOnce(new ApiError('Network down.', 0)).mockImplementationOnce(async (revision, document) => ({ ...scene, ...document, revision: revision + 1 }));
    const saver = new SceneSaver(scene, write);
    saver.setCanvas(first); await saver.save();
    expect(saver.state).toMatchObject({ status: 'error', dirty: true });
    saver.setCanvas(second); await saver.save();
    expect(write.mock.calls).toEqual([[0, document(first)], [0, document(second)]]);
    expect(saver.state.status).toBe('saved');
  });
  it('serializes version selection and timeline changes made while a drawing save is in flight', async () => {
    const pending = deferred<Scene>();
    const write = vi.fn<(revision: number, document: SceneDocument) => Promise<Scene>>().mockImplementationOnce(() => pending.promise).mockImplementation(async (revision, doc) => ({ ...scene, ...doc, revision: revision + 1 }));
    const saver = new SceneSaver(scene, write);
    saver.setCanvas(first); const completion = saver.save();
    saver.setSelectedVideoVersion('edited-version');
    const timeline = { trimStart: 1, trimEnd: 0, captions: [{ id: 'caption', text: 'Original artwork', start: 1, end: 2 }] };
    saver.setTimeline(timeline); saver.setShotPlan(plan);
    pending.resolve({ ...scene, canvas: first, revision: 1 }); await completion;
    expect(write.mock.calls).toEqual([[0, document(first)], [1, { canvas: first, shotPlan: plan, selectedVideoVersionId: 'edited-version', timeline }]]);
    expect(saver.state).toMatchObject({ status: 'saved', revision: 2 });
  });
  it('keeps invalid or out-of-duration timeline drafts local until corrected', async () => {
    const write = vi.fn(async (revision: number, doc: SceneDocument) => ({ ...scene, ...doc, revision: revision + 1 }));
    const saver = new SceneSaver(scene, write); saver.setVideoDuration(2);
    saver.setTimeline({ trimStart: 1, trimEnd: 0.5, captions: [] }); await saver.save();
    expect(write).not.toHaveBeenCalled();
    saver.setTimeline({ trimStart: 1, trimEnd: 3, captions: [] }); await saver.save();
    expect(write).not.toHaveBeenCalled(); expect(saver.document.timeline.trimEnd).toBe(3);
    saver.setTimeline({ trimStart: 1, trimEnd: 0, captions: [] }); await saver.save();
    expect(write).toHaveBeenCalledTimes(1); expect(saver.state.status).toBe('saved');
  });
  it('retains timeline and selection alongside canvas after revision conflicts', async () => {
    const write = vi.fn().mockRejectedValue(new ApiError('Revision changed.', 409));
    const saver = new SceneSaver(scene, write); saver.setCanvas(first);
    saver.setSelectedVideoVersion('original-version'); saver.setTimeline({ trimStart: 0.5, trimEnd: 0, captions: [] });
    await saver.save(); saver.setSelectedVideoVersion('edited-version'); await saver.save();
    expect(write).toHaveBeenCalledTimes(1);
    expect(saver.document).toMatchObject({ canvas: first, selectedVideoVersionId: 'edited-version', timeline: { trimStart: 0.5 } });
    expect(saver.state.status).toBe('conflict');
  });
});
