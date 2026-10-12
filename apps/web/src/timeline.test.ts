import { describe, expect, it } from 'vitest';
import { captionsAt, previewRange, timelineIssue } from './timeline';

describe('browser timeline preview', () => {
  it('interprets zero trim end as the remaining clip instead of an empty range', () => {
    const timeline = { trimStart: 2, trimEnd: 0, captions: [] };
    expect(timelineIssue(timeline, 5)).toBe('');
    expect(previewRange(timeline, 5)).toEqual({ start: 2, end: 5 });
  });
  it('rejects invalid intervals and points outside the actual playable clip', () => {
    expect(timelineIssue({ trimStart: 2, trimEnd: 1, captions: [] }, 5)).not.toBe('');
    expect(timelineIssue({ trimStart: 5, trimEnd: 0, captions: [] }, 5)).not.toBe('');
    expect(timelineIssue({ trimStart: 0, trimEnd: 6, captions: [] }, 5)).not.toBe('');
    expect(timelineIssue({ trimStart: 0, trimEnd: 0, captions: [{ id: 'one', text: 'Original', start: 1, end: 6 }] }, 5)).not.toBe('');
  });
  it('uses original clip times and exclusive ends for overlapping captions', () => {
    const timeline = { trimStart: 2, trimEnd: 0, captions: [{ id: 'one', text: 'One', start: 2, end: 3 }, { id: 'two', text: 'Two', start: 2.5, end: 4 }, { id: 'empty', text: ' ', start: 0, end: 4 }] };
    expect(captionsAt(timeline, 2.5).map((caption) => caption.text)).toEqual(['One', 'Two']);
    expect(captionsAt(timeline, 3).map((caption) => caption.text)).toEqual(['Two']);
    expect(captionsAt(timeline, 4)).toEqual([]);
  });
  it('explains historical timeline corrections without discarding caption values', () => {
    const caption = { id: 'legacy', text: 'Keep my caption', start: 1, end: 1 };
    const duplicate = { trimStart: 2, trimEnd: 2, captions: [caption, { ...caption, text: 'Keep the other caption' }] };
    const before = structuredClone(duplicate);
    expect(timelineIssue(duplicate, null)).toContain('Repair caption IDs');
    expect(timelineIssue({ ...duplicate, captions: [caption] }, null)).toContain('trim has zero length');
    expect(timelineIssue({ ...duplicate, trimEnd: 0, captions: [caption] }, null)).toContain('caption has zero length');
    expect(duplicate).toEqual(before);
    expect(timelineIssue({ trimStart: 2, trimEnd: 0, captions: [{ ...caption, end: 1.5 }] }, 5)).toBe('');
  });
});
