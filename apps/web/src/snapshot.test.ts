import { describe, expect, it, vi } from 'vitest';
import { emptyScene, type CanvasObject } from '@aniforge/shared';
import { baseObject } from './editor';
import { loadSnapshotImages } from './snapshot';

const image = (id: string, assetId: string, hidden = false): CanvasObject => ({ ...baseObject(id, 0, '#123456'), type: 'image', assetId, crop: null, hidden });
const canvas = emptyScene('project', 'scene', '2026-10-12T00:00:00.000Z').canvas;

describe('canonical snapshot source loading', () => {
  it('waits for authorized image decoding, deduplicates shared sources, and omits hidden images', async () => {
    const blob = new Blob(['original']);
    const fetchAsset = vi.fn(async () => blob);
    let complete!: (image: HTMLImageElement) => void;
    const decode = vi.fn(() => new Promise<HTMLImageElement>((resolve) => { complete = resolve; }));
    let finished = false;
    const result = loadSnapshotImages({ ...canvas, objects: [image('first', 'asset'), image('second', 'asset'), image('hidden', 'secret', true)] }, fetchAsset, decode).then((value) => { finished = true; return value; });
    await Promise.resolve();
    expect(fetchAsset.mock.calls).toEqual([['asset']]);
    expect(decode).toHaveBeenCalledWith(blob);
    expect(finished).toBe(false);
    const decoded = { naturalWidth: 300, naturalHeight: 200 } as HTMLImageElement;
    complete(decoded);
    expect((await result).get('asset')).toBe(decoded);
  });
  it('rejects missing and corrupt assets instead of proceeding with a placeholder', async () => {
    const source = { ...canvas, objects: [image('first', 'asset')] };
    const decode = vi.fn();
    await expect(loadSnapshotImages(source, async () => { throw new Error('Access denied'); }, decode)).rejects.toThrow('Access denied');
    expect(decode).not.toHaveBeenCalled();
    await expect(loadSnapshotImages(source, async () => new Blob(), async () => { throw new Error('Corrupt original'); })).rejects.toThrow('Corrupt original');
  });
});
