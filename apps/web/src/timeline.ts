import { timelineSchema, type Timeline } from '@aniforge/shared';

/** Caption times use the original clip's clock, including after an in-point trim. */
export function timelineIssue(timeline: Timeline, duration: number | null): string {
  if (new Set(timeline.captions.map((caption) => caption.id)).size !== timeline.captions.length) return 'Some saved captions share an ID. Repair caption IDs before saving; their text and times are preserved.';
  if (timeline.trimStart > 0 && timeline.trimStart === timeline.trimEnd) return 'The saved trim has zero length. Set a later end, or set trim end to 0 for the full remaining clip.';
  if (timeline.captions.some((caption) => caption.start === caption.end)) return 'A saved caption has zero length. Set its end after its start before saving; its text is preserved.';
  if (!timelineSchema.safeParse(timeline).success) return 'Use nonnegative times, an end after its start, and at most 50 captions. Trim end 0 means the full clip.';
  if (duration === null || !Number.isFinite(duration) || duration <= 0) return '';
  if (timeline.trimStart >= duration || timeline.trimEnd > duration) return `Trim points must fit this clip (${duration.toFixed(2)} seconds). Adjust them or reset the trim.`;
  if (timeline.captions.some((caption) => caption.start >= duration || caption.end > duration)) return `Caption times must fit this clip (${duration.toFixed(2)} seconds).`;
  return '';
}

export function previewRange(timeline: Timeline, duration: number) {
  return { start: timeline.trimStart, end: timeline.trimEnd === 0 ? duration : timeline.trimEnd };
}

export function captionsAt(timeline: Timeline, time: number) {
  return timeline.captions.filter((caption) => caption.start <= time && time < caption.end && caption.text.trim());
}
