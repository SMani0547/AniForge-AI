import { useEffect, useRef, useState } from 'react';
import { generateSceneSchema, shotPlanSchema, videoPrompt, type AnalysisAvailability, type GenerateScene, type Scene, type ShotPlan, type VideoJob, type VideoVersion } from '@aniforge/shared';
import { errorMessage, type ProjectApi } from './api';
import type { SceneSaver } from './sceneSaver';
import { renderCanonicalSnapshot } from './snapshot';
import { VideoVersionsPanel } from './VideoVersionsPanel';

export function GenerationPanel({ scene, api, saver, plan, blocked, onBusyChange, onNotice }: { scene: Scene; api: ProjectApi; saver: SceneSaver; plan: ShotPlan | null; blocked: boolean; onBusyChange: (busy: boolean) => void; onNotice: (message: string) => void }) {
  const [availability, setAvailability] = useState<AnalysisAvailability | null>(null);
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [versions, setVersions] = useState<VideoVersion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState('');
  const [versionError, setVersionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editPending, setEditPending] = useState(false);
  const [copyright, setCopyright] = useState(false);
  const [paid, setPaid] = useState(false);
  const attemptKey = `aniforge-video-request:${scene.projectId}:${scene.id}`;
  const [attempt, setAttempt] = useState<GenerateScene | null>(() => {
    try { const parsed = generateSceneSchema.safeParse(JSON.parse(sessionStorage.getItem(attemptKey) ?? 'null')); return parsed.success ? parsed.data : null; }
    catch { return null; }
  });
  const [refresh, setRefresh] = useState(0);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    api.videoStatus().then((value) => { if (active) setAvailability(value); }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)); });
    return () => { active = false; };
  }, [api]);
  useEffect(() => {
    let active = true; let timer: ReturnType<typeof setTimeout> | undefined; let failures = 0;
    async function poll() {
      try {
        const [nextJobs, nextVersions] = await Promise.all([api.videoJobs(scene.projectId, scene.id), api.videoVersions(scene.projectId, scene.id)]);
        if (!active) return;
        failures = 0; setJobs(nextJobs); setVersions(nextVersions); setLoaded(true); setPollError('');
        // An active job can outlive the browser. The server bounds its lifetime to 30 minutes.
        timer = setTimeout(() => { void poll(); }, nextJobs.some((job) => ['queued', 'running'].includes(job.status)) ? 4000 : 15000);
      } catch (reason) {
        if (!active) return;
        failures++; setPollError(`${errorMessage(reason)}${failures >= 3 ? ' Automatic polling paused. Use Refresh video status.' : ''}`);
        if (failures < 3) timer = setTimeout(() => { void poll(); }, 8000);
      }
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [api, scene.projectId, scene.id, refresh]);
  const valid = plan ? shotPlanSchema.safeParse(plan).success : false;
  const prompt = plan && valid ? videoPrompt(plan) : '';
  const activeJob = jobs.some((job) => ['queued', 'running'].includes(job.status));

  useEffect(() => {
    onNotice(error || pollError || versionError || jobs.some((job) => job.status === 'failed') ? 'Video needs attention. Open the panel for status and recovery.' : activeJob ? 'Video job in progress. You can keep drawing.' : attempt || editPending ? 'A video request is pending. Review it before sending another.' : '');
  }, [error, pollError, versionError, jobs, activeJob, attempt, editPending, onNotice]);

  async function generate(retry: boolean) {
    if (running.current || blocked || !paid || !copyright || !availability?.available) return;
    running.current = true; setBusy(true); onBusyChange(true); setError('');
    try {
      let input = retry ? attempt : null;
      if (!input) {
        await saver.save();
        if (saver.state.dirty || saver.state.status !== 'saved' || !shotPlanSchema.safeParse(saver.document.shotPlan).success) throw new Error('Save a complete canvas and shot plan before generation.');
        const revision = saver.state.revision;
        const png = await renderCanonicalSnapshot(saver.document.canvas, (assetId) => api.getAssetContent(scene.projectId, assetId));
        const asset = await api.uploadAsset(scene.projectId, scene.id, new File([png], 'scene-generation.png', { type: 'image/png' }));
        input = { jobId: crypto.randomUUID(), expectedRevision: revision, snapshotAssetId: asset.id, copyrightAttested: true, confirmPaid: true };
        // Persist before dispatch so a reload can replay the same ID after a lost response.
        sessionStorage.setItem(attemptKey, JSON.stringify(input));
        if (mounted.current) setAttempt(input);
      }
      const job = await api.generateScene(scene.projectId, scene.id, input);
      sessionStorage.removeItem(attemptKey);
      if (mounted.current) { setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]); setAttempt(null); setPaid(false); setRefresh((value) => value + 1); }
    } catch (reason) { if (mounted.current) setError(errorMessage(reason)); }
    finally { running.current = false; if (mounted.current) { setBusy(false); onBusyChange(false); } }
  }

  return <section className="analysis-panel generation-panel" aria-label="Video generation">
    <div className="analysis-heading"><div><h2>Animate your scene</h2><p>Create a rendered clip from the saved drawing and shot plan. You can keep drawing once it is queued.</p></div><span className="outline-tag">Gemini Omni Flash</span></div>
    <p role="status">{availability?.reason ?? 'Checking video worker configuration…'}</p>
    <details className="prompt-preview"><summary>Video prompt preview ({prompt.length}/8000 characters)</summary><pre>{prompt || 'Save a complete shot plan to preview the video request.'}</pre></details>
    <fieldset className="analysis-controls" disabled={busy || editBusy || blocked}><legend className="sr-only">Paid video request</legend>
      <label className="ownership-checkbox"><input type="checkbox" checked={copyright} onChange={(event) => setCopyright(event.target.checked)} />I own or have permission to send this scene to Google for video generation.</label>
      <label className="ownership-checkbox"><input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} />I approve a paid video attempt. Failure or timeout may still incur Google API charges.</label>
      <div className="analysis-actions"><button type="button" className="button primary compact" disabled={!loaded || !!attempt || editPending || !availability?.available || !valid || prompt.length > 8000 || !paid || !copyright || activeJob} onClick={() => { void generate(false); }}>Generate animation</button>
      {attempt && <button type="button" className="button secondary compact" disabled={!paid || !copyright || !availability?.available} onClick={() => { void generate(true); }}>Retry same video request</button>}</div>
    </fieldset>
    {busy && <p role="status">Saving and queuing the scene… Editing resumes after submission.</p>}
    {attempt && <p className="muted small">Request ID: {attempt.jobId}. Retry uses the same ID and cannot start a second generation. After a reload, refresh the server job list before submitting again. <button type="button" className="text-button" disabled={busy || activeJob || !loaded} onClick={() => { if (window.confirm('Check the job list and AI Studio first. Clearing this request lets you submit a NEW paid generation and could incur another charge. Clear it?')) { sessionStorage.removeItem(attemptKey); setAttempt(null); } }}>Clear pending request</button></p>}
    {error && <p className="error-banner" role="alert">{error}</p>}
    {pollError && <p className="error-banner" role="alert">{pollError}</p>}
    <button type="button" className="text-button" onClick={() => setRefresh((value) => value + 1)}>Refresh video status</button>
    <ul className="video-jobs" aria-label="Video jobs">{jobs.map((job) => <li key={job.id}><strong>{job.status === 'running' ? 'Generating / storing' : job.status === 'succeeded' ? 'Completed' : job.status === 'failed' ? 'Failed' : 'Queued'}</strong><span> · source revision {job.sourceRevision} · {new Date(job.createdAt).toLocaleString()}</span>{job.errorMessage && <p role="alert">{job.errorMessage}</p>}{job.status === 'queued' && <p className="muted small">Waiting for the worker. Queue recovery runs every five minutes; jobs expire after 30 minutes.</p>}</li>)}</ul>
    <VideoVersionsPanel onErrorChange={setVersionError} scene={scene} api={api} saver={saver} versions={versions} availability={availability} activeJob={activeJob || !!attempt} blocked={blocked || busy} onPendingChange={setEditPending} onBusyChange={(value) => { setEditBusy(value); onBusyChange(value); }} onQueued={(job) => { setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]); setRefresh((value) => value + 1); }} />
  </section>;
}
