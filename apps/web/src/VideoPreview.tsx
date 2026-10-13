import { useEffect, useRef, useState } from 'react';
import type { Timeline } from '@aniforge/shared';
import { errorMessage, type ProjectApi } from './api';
import { Pause, Play } from 'lucide-react';
import { captionsAt, previewRange, timelineIssue } from './timeline';

export function VideoPreview({ api, projectId, versionId, label, timeline, onDuration, visible = true, onErrorChange }: { api: ProjectApi; projectId: string; versionId: string; label: string; timeline?: Timeline; onDuration?: (duration: number | null) => void; visible?: boolean; onErrorChange?: (message: string) => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [time, setTime] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [activated, setActivated] = useState(visible);
  useEffect(() => { if (visible) setActivated(true); }, [visible]);
  useEffect(() => { onErrorChange?.(error); }, [error, onErrorChange]);
  useEffect(() => { if (!visible) video.current?.pause(); }, [visible]);
  useEffect(() => {
    if (!activated) return;
    const controller = new AbortController(); let localUrl = ''; let active = true;
    setUrl(''); setError(''); setDuration(null); setTime(0); onDuration?.(null);
    void api.getVideoContent(projectId, versionId, controller.signal).then((blob) => {
      if (active) { localUrl = URL.createObjectURL(blob); setUrl(localUrl); }
    }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)); });
    return () => { active = false; controller.abort(); if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [api, projectId, versionId, retry, onDuration, activated]);
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
  const range = timeline && valid && duration !== null ? previewRange(timeline, duration) : { start: 0, end: duration ?? 0 };
  const position = Math.max(range.start, Math.min(time, range.end));
  const percentage = (value: number) => duration ? Math.max(0, Math.min(100, value / duration * 100)) : 0;
  return <div className="video-preview">
    <div className="video-frame">{url ? <video ref={video} aria-label={label} src={url} controls playsInline preload="metadata" onLoadedMetadata={(event) => { const value = event.currentTarget.duration; const actual = Number.isFinite(value) && value > 0 ? value : null; setDuration(actual); onDuration?.(actual); }} onTimeUpdate={(event) => { setTime(event.currentTarget.currentTime); enforceRange(event.currentTarget); }} onPlay={(event) => { setPlaying(true); enforceRange(event.currentTarget, true); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onSeeked={(event) => enforceRange(event.currentTarget)} onError={() => setError('This MP4 could not be played by your browser. Its stored version is preserved.')} /> : !error && <p role="status">Loading private video…</p>}
      {captions.length > 0 && <div className="video-captions" aria-label="Preview captions">{captions.map((caption) => <div key={caption.id}>{caption.text}</div>)}</div>}
    </div>
    {timeline && <div className="video-timeline" aria-label="Single clip preview timeline">
      <div className="video-timeline-toolbar"><button type="button" className="button secondary compact" disabled={!url || !duration || !!error} aria-label={playing ? 'Pause preview' : 'Play preview'} onClick={() => { const player = video.current; if (!player) return; if (player.paused) void player.play().catch((reason: unknown) => setError(errorMessage(reason))); else player.pause(); }}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? 'Pause' : 'Play'}</button><output aria-label="Preview clock" aria-live="off">{position.toFixed(2)}s / {duration === null ? '--' : duration.toFixed(2)}s</output><span>Single clip / Preview only</span></div>
      <div className="video-timeline-ruler" aria-hidden="true"><span>0s</span><span>{duration === null ? '--' : (duration / 2).toFixed(2) + 's'}</span><span>{duration === null ? '--' : duration.toFixed(2) + 's'}</span></div>
      <div className="video-clip-track" aria-hidden="true"><div className="video-kept-range" style={{ left: percentage(range.start) + '%', width: Math.max(0, percentage(range.end) - percentage(range.start)) + '%' }}><span>Video</span></div><span className="video-playhead" style={{ left: percentage(position) + '%' }} /></div>
      <label className="video-seek">Preview playhead (seconds)<input type="range" min={range.start} max={range.end || 1} step={0.01} value={position} aria-valuetext={position.toFixed(2) + ' seconds'} disabled={!duration || !url || !!error} onChange={(event) => { const value = Number(event.target.value); if (video.current) { video.current.currentTime = value; setTime(value); } }} /></label>
      {valid && timeline.captions.length > 0 && <div className="video-caption-track" aria-label="Caption timing overview">{timeline.captions.map((caption, index) => <div key={caption.id} style={{ marginLeft: percentage(caption.start) + '%', width: Math.max(0.5, percentage(caption.end) - percentage(caption.start)) + '%' }} title={caption.text + ' (' + caption.start + 's to ' + caption.end + 's)'}>{index + 1}. {caption.text || 'Empty caption'}</div>)}</div>}
      <p>{valid ? 'Shaded edges are trimmed in this preview. Captions use the original clip clock.' : 'Full clip preview. Complete valid trim and caption settings below to apply them.'}</p>
    </div>}
    {error && <p role="alert">{error}<button type="button" className="text-button" onClick={() => setRetry((value) => value + 1)}>Reload video</button></p>}
  </div>;
}
