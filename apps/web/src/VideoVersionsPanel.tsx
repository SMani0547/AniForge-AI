import { useCallback, useEffect, useRef, useState } from 'react';
import { editVideoSchema, resourceIdSchema, type AnalysisAvailability, type EditVideo, type Scene, type Timeline, type VideoJob, type VideoVersion } from '@aniforge/shared';
import { z } from 'zod';
import { errorMessage, type ProjectApi } from './api';
import type { SceneSaver } from './sceneSaver';
import { VideoPreview } from './VideoPreview';
import { timelineIssue } from './timeline';
import { Download, Film, GitBranch, Pencil, SlidersHorizontal } from 'lucide-react';

const pendingEditSchema = z.strictObject({ parentVersionId: resourceIdSchema, input: editVideoSchema });
type PendingEdit = z.infer<typeof pendingEditSchema>;
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function versionLabel(version: VideoVersion) {
  return `${version.generationKind === 'edit' ? 'Edited' : 'Original'} · ${new Date(version.createdAt).toLocaleString()} · ${version.id.slice(0, 8)}`;
}

export function VideoVersionsPanel({ visible, scene, api, saver, versions, availability, activeJob, blocked, onBusyChange, onQueued, onPendingChange, onErrorChange, loaded, loadFailed, onOpenPlan, onOpenSource }: { visible: boolean; scene: Scene; api: ProjectApi; saver: SceneSaver; versions: VideoVersion[]; availability: AnalysisAvailability | null; activeJob: boolean; blocked: boolean; onBusyChange: (busy: boolean) => void; onQueued: (job: VideoJob) => void; onPendingChange: (pending: boolean) => void; onErrorChange: (error: string) => void; loaded: boolean; loadFailed: boolean; onOpenPlan: () => void; onOpenSource: () => void }) {
  const [document, setDocument] = useState(saver.document);
  const [selected, setSelected] = useState(scene.selectedVideoVersionId ?? '');
  const [extraVersions, setExtraVersions] = useState<VideoVersion[]>([]);
  const [error, setError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [parentError, setParentError] = useState('');
  const [compare, setCompare] = useState(true);
  useEffect(() => { onErrorChange(error || previewError || parentError); }, [error, previewError, parentError, onErrorChange]);
  const [metadataRetry, setMetadataRetry] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<EditVideo['mode']>('interaction');
  const [paid, setPaid] = useState(false);
  const [copyright, setCopyright] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const downloadController = useRef<AbortController | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const attemptKey = `aniforge-video-edit:${scene.projectId}:${scene.id}`;
  const [attempt, setAttempt] = useState<PendingEdit | null>(() => {
    try { const parsed = pendingEditSchema.safeParse(JSON.parse(sessionStorage.getItem(attemptKey) ?? 'null')); return parsed.success ? parsed.data : null; }
    catch { return null; }
  });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; downloadController.current?.abort(); }; }, []);
  useEffect(() => saver.subscribe(() => setDocument(saver.document)), [saver]);
  useEffect(() => { onPendingChange(!!attempt); }, [attempt, onPendingChange]);
  useEffect(() => { setSelected((current) => current || versions[0]?.id || ''); }, [versions]);
  const choices = [...versions, ...extraVersions.filter((version) => !versions.some((item) => item.id === version.id))];
  const version = choices.find((item) => item.id === selected);
  const parent = choices.find((item) => item.id === version?.parentVersionId);
  useEffect(() => {
    let active = true;
    const missing = [...new Set([selected, version?.parentVersionId, document.selectedVideoVersionId].filter((id): id is string => !!id && !choices.some((item) => item.id === id)))];
    if (missing.length) void Promise.all(missing.map((id) => api.getVideoVersion(scene.projectId, id))).then((values) => {
      if (values.some((value) => value.sceneId !== scene.id)) throw new Error('This version does not belong to the current scene.');
      if (active) setExtraVersions((current) => [...current.filter((item) => !values.some((value) => value.id === item.id)), ...values]);
    }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)); });
    return () => { active = false; };
  }, [api, scene.projectId, scene.id, selected, version?.parentVersionId, document.selectedVideoVersionId, versions, extraVersions, metadataRetry]);
  const onDuration = useCallback((value: number | null) => { setDuration(value); saver.setVideoDuration(value); }, [saver]);
  const timelineError = timelineIssue(document.timeline, duration);
  const duplicateCaptionIds = new Set(document.timeline.captions.map((caption) => caption.id)).size !== document.timeline.captions.length;
  const uploadTooLong = mode === 'upload' && duration !== null && duration > 10;
  function previewVersion(id: string) { if (id === selected) return; setSelected(id); setDuration(null); saver.setVideoDuration(null); setPaid(false); setCopyright(false); setError(''); setPreviewError(''); setParentError(''); }
  async function selectVersion(id: string) {
    saver.setSelectedVideoVersion(id);
    await saver.save();
    if (saver.state.status !== 'saved') setError('Version selection has not been saved. Resolve the scene save error before reloading.');
  }
  function changeTimeline(timeline: Timeline) {
    if (!selected) return;
    saver.setSelectedVideoVersion(selected);
    saver.setTimeline(timeline);
  }
  function patchCaption(id: string, patch: Partial<Timeline['captions'][number]>) {
    changeTimeline({ ...document.timeline, captions: document.timeline.captions.map((caption) => caption.id === id ? { ...caption, ...patch } : caption) });
  }
  async function edit(retry: boolean) {
    if (running.current || blocked || !paid || !copyright || !availability?.available) return;
    if (!retry && uploadTooLong) { setError('Uploaded video edits require the original stored MP4 to be 10 seconds or shorter. Preview trimming does not shorten the uploaded file.'); return; }
    const pending = retry ? attempt : version ? { parentVersionId: version.id, input: { jobId: crypto.randomUUID(), prompt: prompt.trim(), mode, copyrightAttested: true as const, confirmPaid: true as const } } : null;
    if (!pending) return;
    const validated = pendingEditSchema.safeParse(pending);
    if (!validated.success) { setError('Enter an edit instruction of 1–8000 characters.'); return; }
    running.current = true; setBusy(true); onBusyChange(true); setError('');
    try {
      sessionStorage.setItem(attemptKey, JSON.stringify(validated.data));
      setAttempt(validated.data);
      const job = await api.editVideo(scene.projectId, scene.id, validated.data.parentVersionId, validated.data.input);
      sessionStorage.removeItem(attemptKey);
      if (mounted.current) { setAttempt(null); setPaid(false); onQueued(job); }
    } catch (reason) { if (mounted.current) setError(errorMessage(reason)); }
    finally { running.current = false; if (mounted.current) { setBusy(false); onBusyChange(false); } }
  }
  async function exportVideo() {
    if (!version || downloading) return;
    const controller = new AbortController(); downloadController.current = controller; setDownloading(true); setError('');
    try { const blob = await api.exportVideo(scene.projectId, scene.id, version.id, controller.signal); if (mounted.current) download(blob, `${scene.id}-${version.id}-original.mp4`); }
    catch (reason) { if (mounted.current) setError(errorMessage(reason)); }
    finally { if (mounted.current) setDownloading(false); }
  }

  if (!selected && !attempt) return <section className="video-empty" aria-label="Video preview"><div className="video-empty-stage"><Film size={42} /><h3>{loadFailed ? 'Your video library is unavailable' : !loaded ? 'Opening your video library' : 'Your first clip starts here'}</h3><p>{loadFailed ? 'Refresh video status to check your stored clips. Your source stays available.' : !loaded ? 'Checking for saved versions...' : 'Draw or import an original scene, review its shot plan, then request an animation.'}</p><span>16:9 / Rendered video</span></div><div className="video-empty-actions"><button type="button" className="button secondary compact" onClick={onOpenSource}><Pencil size={16} />Keep drawing</button><button type="button" className="button primary compact" onClick={onOpenPlan}>Plan an animation</button></div><p>Generated clips are separate from the editable drawing. No video is generated by opening this view.</p></section>;
  return <section className="video-player video-version-workspace" aria-label="Video versions and editing">
    <div className="video-section-heading"><div><span className="video-eyebrow">YOUR VERSIONS</span><h3>Review & refine</h3></div><div className="video-review-tools"><span className="video-count">{choices.length} loaded</span>{parent && <button type="button" className="button secondary compact video-compare-toggle" aria-pressed={compare} onClick={() => setCompare(!compare)}><GitBranch size={16} />Compare with parent</button>}</div></div>


    {version && <>
      <div className={`video-comparison ${parent && compare ? 'has-parent' : ''}`}>
        {parent && <div hidden={!compare}><h3>Preserved parent</h3><VideoPreview visible={visible && compare} onErrorChange={setParentError} key={parent.id} api={api} projectId={scene.projectId} versionId={parent.id} label="Parent animation" /><p>{versionLabel(parent)} · Untrimmed comparison</p></div>}
        <div><h3>{parent ? 'Revised version' : 'Clip preview'}</h3><VideoPreview visible={visible} key={version.id} api={api} projectId={scene.projectId} versionId={version.id} label="Generated animation" onErrorChange={setPreviewError} timeline={document.timeline} onDuration={onDuration} /><p>{versionLabel(version)} · {version.model}</p></div>
      </div>
    <ul className="video-version-strip" aria-label="Version previews">{choices.map((item) => <li key={item.id}><button type="button" disabled={busy || blocked} aria-pressed={selected === item.id} aria-label={'Preview ' + (item.generationKind === 'edit' ? 'edited' : 'original') + ' version ' + item.id.slice(0, 8)} onClick={() => previewVersion(item.id)}><span><Film size={16} />{item.generationKind === 'edit' ? 'Edited version' : 'Original animation'}</span><strong>{item.id.slice(0, 8)} <small>{document.selectedVideoVersionId === item.id ? 'Scene selection' : selected === item.id ? 'Previewing' : 'Preview'}</small></strong><span>Source revision {item.sourceRevision}</span><span>{new Date(item.createdAt).toLocaleString()}</span>{item.parentVersionId && <span>Parent {item.parentVersionId.slice(0, 8)}</span>}</button></li>)}</ul>
    <label>Video version<select value={selected} disabled={busy || blocked} onChange={(event) => previewVersion(event.target.value)}>{selected && !version && <option value={selected}>Loading saved version…</option>}{choices.map((item) => <option key={item.id} value={item.id}>{versionLabel(item)}</option>)}</select></label>
      <div className="analysis-actions"><button type="button" className="button secondary compact" disabled={blocked || busy || duration === null || !!timelineError || document.selectedVideoVersionId === selected} onClick={() => { void selectVersion(selected); }}>Use this version</button>{parent && <button type="button" className="button secondary compact" disabled={blocked || busy} onClick={() => previewVersion(parent.id)}>Preview parent version</button>}</div>
      <p role="status">{document.selectedVideoVersionId === selected ? `Selected for this scene${saver.state.dirty ? saver.state.status === 'saving' ? ' · saving changes' : ' · selection or scene changes are not yet saved' : ''}.` : document.selectedVideoVersionId ? 'Previewing another version. Use this version to save your selection.' : 'Previewing the latest available version. Use this version to save your selection.'}</p>
      <details className="prompt-preview"><summary>Saved version prompt & provenance</summary><dl className="video-provenance"><dt>Source revision</dt><dd>{version.sourceRevision}</dd><dt>Parent</dt><dd>{version.parentVersionId ?? 'Original generation'}</dd><dt>Model</dt><dd>{version.model}</dd><dt>Request type</dt><dd>{version.editMode ?? 'Initial animation'}</dd></dl><pre>{version.prompt}</pre></details>
      {version.parentVersionId && !parent && <p role="status">Loading the preserved parent for comparison…</p>}
      <div className="video-editing-grid"><fieldset className="editable-shot-plan video-timeline-settings" disabled={busy || blocked || duration === null}><legend><SlidersHorizontal size={16} />Trim & captions</legend>
        <p>Trim and captions are saved as editable scene metadata. They affect this browser preview only. Times use the original clip clock; selecting another version keeps these settings for review.</p>
        <div className="shot-plan-fields"><label>Trim start (seconds)<input type="number" min={0} max={duration ?? 300} step={0.1} value={document.timeline.trimStart} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) changeTimeline({ ...document.timeline, trimStart: event.target.valueAsNumber }); }} /></label><label>Trim end (seconds, 0 = full clip)<input type="number" min={0} max={duration ?? 300} step={0.1} value={document.timeline.trimEnd} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) changeTimeline({ ...document.timeline, trimEnd: event.target.valueAsNumber }); }} /></label></div>
        <button type="button" className="text-button" onClick={() => changeTimeline({ ...document.timeline, trimStart: 0, trimEnd: 0 })}>Reset trim</button>
        {duplicateCaptionIds && <div className="plan-validation"><p>This saved timeline has duplicate caption IDs. Repair the IDs to edit and save each caption separately; all text and times are preserved.</p><button type="button" className="button secondary compact" onClick={() => changeTimeline({ ...document.timeline, captions: document.timeline.captions.map((caption) => ({ ...caption, id: crypto.randomUUID() })) })}>Repair caption IDs</button></div>}
        {document.timeline.captions.map((caption, index) => <fieldset key={`${caption.id}:${index}`} className="caption-row" disabled={duplicateCaptionIds}><legend>Caption {index + 1}</legend><label>Caption {index + 1} text<textarea maxLength={1000} value={caption.text} onChange={(event) => patchCaption(caption.id, { text: event.target.value })} /></label><div className="shot-plan-fields"><label>Caption {index + 1} start<input type="number" min={0} max={duration ?? 300} step={0.1} value={caption.start} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) patchCaption(caption.id, { start: event.target.valueAsNumber }); }} /></label><label>Caption {index + 1} end<input type="number" min={0} max={duration ?? 300} step={0.1} value={caption.end} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) patchCaption(caption.id, { end: event.target.valueAsNumber }); }} /></label></div><button type="button" className="text-button" onClick={() => changeTimeline({ ...document.timeline, captions: document.timeline.captions.filter((item) => item.id !== caption.id) })}>Remove caption {index + 1}</button></fieldset>)}
        <button type="button" className="button secondary compact" disabled={document.timeline.captions.length >= 50} onClick={() => changeTimeline({ ...document.timeline, captions: [...document.timeline.captions, { id: crypto.randomUUID(), text: '', start: 0, end: Math.min(duration ?? 1, 3) }] })}>Add caption</button>
        {timelineError && <p className="plan-validation" role="alert">{timelineError} This draft will not save until corrected. Preview uses the full clip while these settings are invalid.</p>}
      </fieldset>
      <fieldset className="editable-shot-plan video-revision-form" disabled={busy || blocked}><legend><GitBranch size={16} />Edit this video with AI</legend>
        <p>Describe a change to this version. The result becomes a separate clip; this version and the source drawing stay available.</p>
        <label className="plan-label">Video edit instruction<textarea maxLength={8000} placeholder="For example: slow the camera movement and keep the same character design." value={prompt} onChange={(event) => { setPrompt(event.target.value); setPaid(false); }} /></label>
        <label className="plan-label">Edit source<select value={mode} onChange={(event) => { setMode(event.target.value as EditVideo['mode']); setPaid(false); }}><option value="interaction">Continue the previous Google interaction</option><option value="upload">Upload this stored MP4 as a new video source</option></select></label>
        <p>{mode === 'interaction' ? 'Uses the saved Google interaction. If its history has expired, the request can fail; it will never silently start a second paid attempt.' : 'Explicit fallback: uploads this exact stored MP4 to Google and starts a new paid edit without the earlier conversation. The original MP4 must be 10 seconds or shorter; preview trimming does not shorten the uploaded file. Google currently does not offer uploaded video edits in the EEA, Switzerland or the UK. Voice editing is not supported.'}</p>
        {uploadTooLong && <p className="plan-validation" role="alert">This stored clip is {duration?.toFixed(2)} seconds long. Choose interaction mode or a source clip of 10 seconds or less. A pending request can still be checked using Retry same video edit.</p>}
        <label className="ownership-checkbox"><input type="checkbox" checked={copyright} onChange={(event) => setCopyright(event.target.checked)} />I own or have permission to send this video and edit instruction to Google.</label>
        <label className="ownership-checkbox"><input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} />I approve a paid video edit attempt. Failure or timeout may still incur Google API charges.</label>
        <div className="analysis-actions"><button type="button" className="button primary compact" disabled={!!attempt || activeJob || uploadTooLong || !availability?.available || !prompt.trim() || !paid || !copyright} onClick={() => { void edit(false); }}>Create edited version</button>{attempt && <button type="button" className="button secondary compact" disabled={!paid || !copyright || !availability?.available} onClick={() => { void edit(true); }}>Retry same video edit</button>}</div>
      </fieldset>
      </div>
      <section className="video-downloads" aria-label="Download video and timeline"><div><Download size={20} /><h3>Take your work with you</h3><p>Original MP4: the stored clip, without preview trim or captions.<br />Editable timeline JSON: your current preview settings, including any unsaved draft.</p></div>      <div className="video-download-actions"><button type="button" className="button secondary compact" disabled={downloading} onClick={() => { void exportVideo(); }}>{downloading ? 'Downloading MP4…' : 'Download original MP4'}</button><button type="button" className="button secondary compact" onClick={() => download(new Blob([JSON.stringify({ sceneId: scene.id, versionId: selected, timeline: document.timeline, rendering: 'Browser preview only; MP4 is unchanged.' }, null, 2)], { type: 'application/json' }), `${scene.id}-timeline.json`)}>Download editable timeline JSON</button></div>
      <p>The MP4 download contains the original stored clip, without preview trim or captions. No new AI call is made when switching, comparing or downloading versions.</p>
</section>
    </>}
    {!version && <label>Video version<select value={selected} disabled={busy || blocked} onChange={(event) => previewVersion(event.target.value)}>{selected && !version && <option value={selected}>Loading saved version…</option>}{choices.map((item) => <option key={item.id} value={item.id}>{versionLabel(item)}</option>)}</select></label>}
    {busy && <p role="status">Queuing your video edit… Drawing resumes after submission.</p>}
    {attempt && <div className="analysis-suggestion"><p>Pending edit {attempt.input.jobId} of version {attempt.parentVersionId}. Retry preserves this request ID, source, instruction and mode, even if the controls above change.</p><p>Mode: {attempt.input.mode === 'interaction' ? 'Previous interaction' : 'Uploaded stored MP4'}</p><pre>{attempt.input.prompt}</pre><button type="button" className="text-button" disabled={busy || blocked || activeJob} onClick={() => { if (window.confirm('Check the server job list and AI Studio first. Clearing this request allows a NEW paid edit that could incur another charge. Clear it?')) { sessionStorage.removeItem(attemptKey); setAttempt(null); } }}>Clear pending video edit</button></div>}
    {error && <p className="error-banner" role="alert">{error}<button type="button" className="text-button" onClick={() => { setError(''); setMetadataRetry((value) => value + 1); }}>Refresh version details</button></p>}
    <p className="muted small">Rendered MP4s have no editable drawing layers. Showing the latest 30 versions plus the selected clip and its parent. Older versions remain stored privately.</p>
  </section>;
}
