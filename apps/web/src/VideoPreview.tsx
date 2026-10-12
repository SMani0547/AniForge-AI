import { useEffect, useRef, useState } from 'react';
import type { Timeline } from '@aniforge/shared';
import { errorMessage, type ProjectApi } from './api';
import { captionsAt, previewRange, timelineIssue } from './timeline';

export function VideoPreview({ api, projectId, versionId, label, timeline, onDuration }: { api: ProjectApi; projectId: string; versionId: string; label: string; timeline?: Timeline; onDuration?: (duration: number | null) => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [time, setTime] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const controller = new AbortController(); let localUrl = ''; let active = true;
    setUrl(''); setError(''); setDuration(null); setTime(0); onDuration?.(null);
    void api.getVideoContent(projectId, versionId, controller.signal).then((blob) => {
      if (active) { localUrl = URL.createObjectURL(blob); setUrl(localUrl); }
    }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)); });
    return () => { active = false; controller.abort(); if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [api, projectId, versionId, retry, onDuration]);
  const valid = !!timeline && duration !== null && !timelineIssue(timeline, duration);
  const captions = timeline && valid ? captionsAt(timeline, time) : [];
  function enforceRange(element: HTMLVideoElement, starting = false) {
    if (!timeline || !valid || duration === null) return;
    const range = previewRange(timeline, duration);
    if (element.currentTime < range.start || (starting && element.currentTime >= range.end)) element.currentTime = range.start;
    else if (element.currentTime >= range.end) { element.pause(); if (element.currentTime > range.end) element.currentTime = range.end; }
    setTime(element.currentTime);
  }
  useEffect(() => { if (video.current && valid) enforceRange(video.current); }, [timeline, duration]);
  return <div className="video-preview">
    <div className="video-frame">{url ? <video ref={video} aria-label={label} src={url} controls playsInline preload="metadata" onLoadedMetadata={(event) => { const value = event.currentTarget.duration; const actual = Number.isFinite(value) && value > 0 ? value : null; setDuration(actual); onDuration?.(actual); }} onTimeUpdate={(event) => { setTime(event.currentTarget.currentTime); enforceRange(event.currentTarget); }} onPlay={(event) => enforceRange(event.currentTarget, true)} onSeeked={(event) => enforceRange(event.currentTarget)} onError={() => setError('This MP4 could not be played by your browser. Its stored version is preserved.')} /> : !error && <p role="status">Loading private video…</p>}
      {captions.length > 0 && <div className="video-captions" aria-label="Preview captions">{captions.map((caption) => <div key={caption.id}>{caption.text}</div>)}</div>}
    </div>
    {error && <p role="alert">{error}<button type="button" className="text-button" onClick={() => setRetry((value) => value + 1)}>Reload video</button></p>}
  </div>;
}
