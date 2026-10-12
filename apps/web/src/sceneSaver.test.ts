import { describe, expect, it, vi } from 'vitest';
import { emptyScene, type Canvas, type Scene } from '@aniforge/shared';
import { ApiError } from './api';
import { SceneSaver } from './sceneSaver';

const scene = emptyScene('project', 'scene', '2026-10-12T00:00:00.000Z');
const first = { ...scene.canvas, background: '#123456' };
const second = { ...scene.canvas, background: '#654321' };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }

describe('revision checked scene persistence', () => {
  it('serializes writes and saves edits made while an earlier request is in flight', async () => {
    const pending = deferred<Scene>();
    const write = vi.fn<(revision: number, canvas: Canvas) => Promise<Scene>>().mockImplementationOnce(() => pending.promise).mockImplementationOnce(async (revision, canvas) => ({ ...scene, canvas, revision: revision + 1 }));
    const saver = new SceneSaver(scene, write);
    saver.setCanvas(first); const completion = saver.save();
    saver.setCanvas(second);
    expect(saver.save()).toBe(completion);
    expect(write).toHaveBeenCalledTimes(1);
    pending.resolve({ ...scene, canvas: first, revision: 1 }); await completion;
    expect(write.mock.calls).toEqual([[0, first], [1, second]]);
    expect(saver.state).toMatchObject({ status: 'saved', dirty: false, revision: 2 });
  });
  it('persists an undo back to the original during an in-flight save', async () => {
    const pending = deferred<Scene>();
    const write = vi.fn<(revision: number, canvas: Canvas) => Promise<Scene>>().mockImplementationOnce(() => pending.promise).mockImplementationOnce(async (revision, canvas) => ({ ...scene, canvas, revision: revision + 1 }));
    const saver = new SceneSaver(scene, write);
    saver.setCanvas(first); const completion = saver.save(); saver.setCanvas(scene.canvas);
    pending.resolve({ ...scene, canvas: first, revision: 1 }); await completion;
    expect(write.mock.calls).toEqual([[0, first], [1, scene.canvas]]);
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
    const write = vi.fn<(revision: number, canvas: Canvas) => Promise<Scene>>().mockRejectedValueOnce(new ApiError('Network down.', 0)).mockImplementationOnce(async (revision, canvas) => ({ ...scene, canvas, revision: revision + 1 }));
    const saver = new SceneSaver(scene, write);
    saver.setCanvas(first); await saver.save();
    expect(saver.state).toMatchObject({ status: 'error', dirty: true });
    saver.setCanvas(second); await saver.save();
    expect(write.mock.calls).toEqual([[0, first], [0, second]]);
    expect(saver.state.status).toBe('saved');
  });
});
