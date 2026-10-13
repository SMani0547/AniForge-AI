import { useEffect, useRef, useState } from 'react';
import { shotPlanSchema, type AnalysisAvailability, type AnalysisResult, type AnalyzeScene, type Scene, type ShotPlan } from '@aniforge/shared';
import { ApiError, errorMessage, type ProjectApi } from './api';
import type { SceneSaver } from './sceneSaver';
import { renderCanonicalSnapshot } from './snapshot';

export function emptyShotPlan(): ShotPlan {
  return { sceneSummary: '', subjects: [{ name: '', appearance: '' }], action: '', camera: { shotType: '', movement: '' }, environment: '', mood: '', animationPrompt: '', preserve: [], uncertainties: [] };
}
const fields = [{ key: 'sceneSummary', label: 'Scene summary', max: 4000 }, { key: 'action', label: 'Action', max: 4000 }, { key: 'environment', label: 'Environment', max: 4000 }, { key: 'mood', label: 'Mood', max: 500 }, { key: 'animationPrompt', label: 'Animation prompt', max: 8000 }] as const;

function ShotPlanFields({ plan, onChange }: { plan: ShotPlan; onChange: (plan: ShotPlan) => void }) {
  return <div className="shot-plan-fields">
    {fields.map(({ key, label, max }) => <label key={key} className={key === 'animationPrompt' || key === 'sceneSummary' ? 'plan-wide' : ''}>{label}<textarea required maxLength={max} value={plan[key]} onChange={(event) => onChange({ ...plan, [key]: event.target.value })} /></label>)}
    <label>Shot type<input required maxLength={200} value={plan.camera.shotType} onChange={(event) => onChange({ ...plan, camera: { ...plan.camera, shotType: event.target.value } })} /></label>
    <label>Camera movement<input required maxLength={1000} value={plan.camera.movement} onChange={(event) => onChange({ ...plan, camera: { ...plan.camera, movement: event.target.value } })} /></label>
    <fieldset className="plan-wide subject-fields"><legend>Subjects</legend>{plan.subjects.map((subject, index) => <div className="subject-row" key={index}><label>Subject {index + 1} name<input required maxLength={200} value={subject.name} onChange={(event) => onChange({ ...plan, subjects: plan.subjects.map((item, position) => position === index ? { ...item, name: event.target.value } : item) })} /></label><label>Subject {index + 1} appearance<textarea required maxLength={4000} value={subject.appearance} onChange={(event) => onChange({ ...plan, subjects: plan.subjects.map((item, position) => position === index ? { ...item, appearance: event.target.value } : item) })} /></label><button type="button" className="text-button" disabled={plan.subjects.length <= 1} onClick={() => onChange({ ...plan, subjects: plan.subjects.filter((_, position) => position !== index) })}>Remove subject {index + 1}</button></div>)}<button type="button" className="button secondary compact" disabled={plan.subjects.length >= 20} onClick={() => onChange({ ...plan, subjects: [...plan.subjects, { name: '', appearance: '' }] })}>Add subject</button></fieldset>
    <label>Preserve constraints<span className="muted small">One per line; up to 30, 500 characters each.</span><textarea maxLength={15030} value={plan.preserve.join('\n')} onChange={(event) => onChange({ ...plan, preserve: event.target.value === '' ? [] : event.target.value.split('\n') })} /></label>
    <label>Uncertainties<span className="muted small">One per line; up to 30, 500 characters each.</span><textarea maxLength={15030} value={plan.uncertainties.join('\n')} onChange={(event) => onChange({ ...plan, uncertainties: event.target.value === '' ? [] : event.target.value.split('\n') })} /></label>
  </div>;
}

type Attempt = { input: AnalyzeScene; document: string };
export function AnalysisPanel({ scene, api, saver, plan, onPlanChange, onBusyChange, importBusy, onNotice }: { scene: Scene; api: ProjectApi; saver: SceneSaver; plan: ShotPlan | null; onPlanChange: (plan: ShotPlan | null) => void; onBusyChange: (busy: boolean) => void; importBusy: boolean; onNotice: (message: string) => void }) {
  const [availability, setAvailability] = useState<AnalysisAvailability | null>(null);
  const [setupError, setSetupError] = useState('');
  const [notes, setNotes] = useState('');
  const [copyright, setCopyright] = useState(false);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState<{ result: AnalysisResult; document: string } | null>(null);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const attempt = useRef<Attempt | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    api.analysisStatus().then((status) => { if (active) setAvailability(status); }).catch((reason: unknown) => { if (active) setSetupError(errorMessage(reason)); });
    return () => { active = false; };
  }, [api]);
  const validation = plan ? shotPlanSchema.safeParse(plan) : null;
  const stale = suggestion !== null && (suggestion.document !== JSON.stringify(saver.document) || suggestion.result.sourceRevision !== saver.state.revision);

  useEffect(() => { onNotice(error ? 'Analysis needs attention. Your drawing and plan are kept.' : suggestion ? 'A shot plan suggestion is ready to review.' : ''); }, [error, suggestion, onNotice]);

  async function analyze(retry: boolean) {
    if (running.current || !availability?.available || !copyright || !paid || importBusy) return;
    running.current = true; onBusyChange(true); setBusy(true); setError(''); setRetryAvailable(false);
    try {
      let current = retry ? attempt.current : null;
      if (!current) {
        attempt.current = null;
        setProgress('Saving the current canvas and shot plan…');
        await saver.save();
        if (saver.state.status !== 'saved' || saver.state.dirty) throw new Error('Save this scene successfully before analyzing it. Complete any required shot plan fields or resolve the save conflict first.');
        const saved = saver.document;
        const revision = saver.state.revision;
        setProgress('Rendering the full scene and loading its private images…');
        const png = await renderCanonicalSnapshot(saved.canvas, (assetId) => api.getAssetContent(scene.projectId, assetId));
        setProgress('Uploading the private scene snapshot…');
        const asset = await api.uploadAsset(scene.projectId, scene.id, new File([png], 'scene-analysis.png', { type: 'image/png' }));
        current = { input: { analysisId: crypto.randomUUID(), expectedRevision: revision, snapshotAssetId: asset.id, notes, copyrightAttested: true, confirmPaid: true }, document: JSON.stringify(saved) };
        attempt.current = current;
      }
      setProgress(retry ? 'Checking the same analysis request…' : 'Gemini is analyzing the saved scene…');
      const result = await api.analyzeScene(scene.projectId, scene.id, current.input);
      if (result.analysisId !== current.input.analysisId || result.sourceRevision !== current.input.expectedRevision || result.snapshotAssetId !== current.input.snapshotAssetId) throw new Error('The analysis did not match this scene request. Your current plan has been kept.');
      if (mounted.current) setSuggestion({ result, document: current.document });
    } catch (reason) {
      if (mounted.current) {
        setError(errorMessage(reason));
        // Reuse the request ID after uncertain delivery; the server controls whether it can be retried.
        setRetryAvailable(attempt.current !== null && (!(reason instanceof ApiError) || reason.status === 0 || reason.status === 408 || reason.status === 429 || reason.status >= 500 || reason.code === 'ANALYSIS_PENDING'));
      }
    } finally {
      running.current = false;
      if (mounted.current) { setBusy(false); setProgress(''); onBusyChange(false); }
    }
  }

  return <section className="analysis-panel" aria-label="Scene analysis and shot plan">
    <div className="analysis-heading"><div><h2>Shot plan</h2><p>Write your own direction, or ask Gemini to suggest a plan from the saved drawing. You decide what to apply.</p></div><span className="outline-tag">Editable storyboard</span></div>
    <fieldset className="editable-shot-plan" disabled={busy}><legend>Your editable shot plan</legend>{plan ? <><p className="muted small">Edit all fields below. Valid changes save with your canvas. An incomplete draft stays local until the required fields are filled.</p><ShotPlanFields plan={plan} onChange={onPlanChange} />{validation?.success === false && <div className="plan-validation" role="status">Draft not yet valid: {[...new Set(validation.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`))].slice(0, 5).join('; ')}</div>}<details className="prompt-preview" open><summary>Prompt preview</summary><pre>{plan.animationPrompt || 'Write an animation prompt to preview it here.'}</pre>{plan.preserve.length > 0 && <p>Preserve: {plan.preserve.join('; ')}</p>}</details><button type="button" className="text-button" onClick={() => { if (window.confirm('Remove this shot plan? Your canvas will remain unchanged.')) onPlanChange(null); }}>Remove shot plan</button></> : <><p>No shot plan is saved. Manual plans are written by you and do not call an AI model.</p><button type="button" className="button secondary compact" onClick={() => onPlanChange(emptyShotPlan())}>Create manual shot plan</button></>}</fieldset>
    <div className="analysis-request">
      <h3>Analyze with Gemini</h3>
      <p className="analysis-availability" role="status">{setupError || (availability ? availability.reason : 'Checking server analysis configuration…')}{availability?.available && availability.model ? ` Model: ${availability.model}.` : ''}</p>
      <fieldset disabled={busy} className="analysis-controls"><legend className="sr-only">Analysis request</legend>
        <label className="plan-label">Notes for Gemini<textarea maxLength={8000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Describe the movement, mood, and details you want to keep." /></label>
        <label className="ownership-checkbox"><input type="checkbox" checked={copyright} onChange={(event) => setCopyright(event.target.checked)} />I own this scene or have permission to send all its content to Google AI.</label>
        <label className="ownership-checkbox"><input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} />I understand this analysis sends the scene and notes to Google AI and may incur API charges.</label>
        <div className="analysis-actions"><button type="button" className="button primary compact" disabled={!availability?.available || !copyright || !paid || importBusy || saver.state.status === 'conflict' || validation?.success === false} onClick={() => { void analyze(false); }}>Analyze scene</button>{retryAvailable && <button type="button" className="button secondary compact" disabled={!availability?.available || !copyright || !paid} onClick={() => { void analyze(true); }}>Retry same analysis</button>}</div>
      </fieldset>
      {busy && <p className="analysis-progress" role="status">{progress} Editing is paused until this request finishes.</p>}
      {retryAvailable && <p className="muted small">Retry uses the original snapshot and notes; it does not start a new request.</p>}
      {error && <div className="error-banner" role="alert">{error}<p>Your current shot plan and drawing have been kept.</p></div>}
      <p className="muted small">Review and save your shot plan, then open Video to request a clip.</p>
    </div>
    {suggestion && <section className="analysis-suggestion" aria-label="Gemini suggestion"><h3>Gemini suggestion</h3><p className="muted small">{suggestion.result.model} · saved revision {suggestion.result.sourceRevision} · {new Date(suggestion.result.analyzedAt).toLocaleString()}</p><dl><dt>Summary</dt><dd>{suggestion.result.shotPlan.sceneSummary}</dd><dt>Subjects</dt><dd>{suggestion.result.shotPlan.subjects.map((subject, index) => <p key={index}>{subject.name}: {subject.appearance}</p>)}</dd><dt>Action</dt><dd>{suggestion.result.shotPlan.action}</dd><dt>Camera</dt><dd>{suggestion.result.shotPlan.camera.shotType} · {suggestion.result.shotPlan.camera.movement}</dd><dt>Environment</dt><dd>{suggestion.result.shotPlan.environment}</dd><dt>Mood</dt><dd>{suggestion.result.shotPlan.mood}</dd><dt>Preserve</dt><dd>{suggestion.result.shotPlan.preserve.join('\n') || 'No constraints suggested.'}</dd><dt>Uncertainties</dt><dd>{suggestion.result.shotPlan.uncertainties.join('\n') || 'No uncertainties reported. Review the suggestion yourself.'}</dd><dt>Animation prompt</dt><dd>{suggestion.result.shotPlan.animationPrompt}</dd></dl>{stale && <p className="error-banner" role="alert">The scene or plan has changed since this analysis. Analyze the current scene before applying a suggestion.</p>}<button type="button" className="button primary compact" disabled={busy || stale} onClick={() => { onPlanChange(structuredClone(suggestion.result.shotPlan)); setSuggestion(null); }}>Apply suggestion to shot plan</button><button type="button" className="text-button" disabled={busy} onClick={() => setSuggestion(null)}>Dismiss suggestion</button></section>}

  </section>;
}
