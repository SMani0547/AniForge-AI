import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import './styles.css';
import type { User } from 'firebase/auth';
import type { Project, Scene } from '@aniforge/shared';
import { ArrowLeft, CircleHelp, Clapperboard, Film, FolderOpen, Layers3, LoaderCircle, LogIn, LogOut, Pencil, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import { authenticate, firebaseConfigured, logOut, useAuth } from './firebase';
import { createApiClient, errorMessage, type ProjectApi } from './api';
import { Dashboard, DashboardHeader, SignInPanel } from './dashboard/Dashboard';
import { mayLeaveStudio } from './navigationGuard';
import { useNavigation } from './useNavigation';

const SavedCanvas = lazy(() => import('./CanvasEditor').then((module) => ({ default: module.CanvasEditor })));

const CanvasPreview = lazy(() => import('./SketchPreview').then((module) => ({ default: module.SketchPreview })));
function SketchPreview() {
  return <Suspense fallback={<div className="loading-state" role="status"><LoaderCircle className="spin" size={20} />Loading drawing tools…</div>}><CanvasPreview /></Suspense>;
}

function Studio({ projectId, api, user, onBack }: { projectId: string; api: ProjectApi; user: User | null; onBack: () => void }) {
  const preview = projectId === 'preview';
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!preview);
  const [scene, setScene] = useState<Scene | null>(null);
  const [sceneKey, setSceneKey] = useState(0);
  useEffect(() => {
    let active = true;
    setProject(null);
    setError('');
    if (preview) { setLoading(false); return; }
    if (!user) { setLoading(false); setError('Sign in to open this project.'); return; }
    setLoading(true);
    Promise.all([api.getProject(projectId), api.listScenes(projectId)]).then(([result, scenes]) => { if (active) { setProject(result); setScene(scenes.find((item) => item.id === result.sceneOrder[0]) ?? scenes[0] ?? null); if (!scenes.length) setError('This project has no editable scene. Return to projects and create a new project.'); } }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, projectId, preview, user]);

  if (!preview) return <main id="main" tabIndex={-1} className="studio-page af-editor-route">{(loading || error || !scene) && <div className="studio-heading"><div className="studio-title"><button type="button" className="icon-button" aria-label="Back to projects" onClick={onBack}><ArrowLeft size={19} /></button><div><h1>{project?.title ?? 'Your project'}</h1><p>Private project · Editable source canvas</p></div></div><span className="status-chip"><ShieldCheck size={13} />Source editor</span></div>}{loading ? <div className="loading-state" role="status"><LoaderCircle className="spin" />Opening your project…</div> : error ? <div className="error-banner" role="alert">{error}</div> : scene && <Suspense fallback={<div className="loading-state" role="status">Loading editor…</div>}><SavedCanvas key={`${scene.id}-${sceneKey}`} scene={scene} api={api} projectTitle={project?.title ?? 'Your project'} onBack={onBack} onReload={async () => { const latest = await api.getScene(projectId, scene.id); setScene(latest); setSceneKey((value) => value + 1); }} /></Suspense>}</main>;

  return <main id="main" tabIndex={-1} className="studio-page">
    <div className="studio-heading"><div className="studio-title"><button type="button" className="icon-button" aria-label="Back to projects" onClick={onBack}><ArrowLeft size={19} /></button><div><h1>{preview ? 'Sketch playground' : project?.title ?? 'Your project'}</h1><p>{preview ? 'Explore your first idea' : 'Cloud project · Canvas editing preview'}</p></div></div><span className="status-chip"><span className="status-dot amber" />Preview · not saved</span></div>
    {loading ? <div className="loading-state" role="status"><LoaderCircle className="spin" />Opening your project…</div> : error ? <div className="error-banner" role="alert">{error}</div> : <div className="studio-grid"><div className="canvas-column"><div className="panel-title"><span><Layers3 size={17} />Source canvas</span><span className="muted small">Editable drawing preview</span></div><SketchPreview /><div className="timeline-empty"><Film size={21} /><div><strong>Your story will take shape here</strong><p>Open a saved project to plan an animation and review its video versions.</p></div><span className="outline-tag">No clips</span></div></div><aside className="inspector" aria-label="Scene assistant"><div className="panel-title"><span><Sparkles size={17} />Scene assistant</span><span className="tiny-pill">GOOGLE AI</span></div><div className="inspector-content"><span className="eyebrow">FROM IDEA TO MOTION</span><h2>Keep your vision.<br />Explore the movement.</h2><p>Plan the action, camera and mood of your original scene with Gemini.</p><div className="workflow-step"><span className="step-number active">1</span><div><strong>Draw your source</strong><p>Try the local sketch tools. Open a project to save an editable scene.</p></div></div><div className="workflow-step"><span className="step-number">2</span><div><strong>Build your shot plan</strong><p>Scene analysis is not connected to this preview.</p></div></div><div className="workflow-step"><span className="step-number">3</span><div><strong>Bring it into motion</strong><p>Video requires verified model access and a configured backend.</p></div></div><button type="button" className="button secondary full-width" disabled aria-describedby="ai-unavailable"><WandSparkles size={17} />Analyze scene</button><button type="button" className="button primary full-width" disabled aria-describedby="ai-unavailable"><Sparkles size={17} />Generate animation</button><div className="availability-note" id="ai-unavailable"><CircleHelp size={17} /><span>AI generation is unavailable in this unsaved playground. No AI requests are sent from this canvas.</span></div><div className="source-note"><ShieldCheck size={18} /><p>Your editable source and rendered video are separate. AI video edits will create new versions.</p></div></div></aside></div>}
  </main>;
}

export default function App() {
  const { user, loading: authLoading, error: authError } = useAuth();
  const [authBusy, setAuthBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const { path, navigate } = useNavigation();
  const api = useMemo(() => createApiClient(async () => user ? user.getIdToken() : null, String(import.meta.env.VITE_API_BASE_URL || '/api/v1')), [user]);
  const studioId = path.startsWith('/studio/') ? path.slice('/studio/'.length) : null;
  async function signIn(anonymous = false) {
    setAuthBusy(true);
    setActionError('');
    try { await authenticate(anonymous); }
    catch (reason) { setActionError(errorMessage(reason)); }
    finally { setAuthBusy(false); }
  }
  async function signOut() {
    if (!mayLeaveStudio()) return;
    if (user?.isAnonymous && !window.confirm('Signing out can make your guest projects inaccessible. Keep this browser signed in to return to them. Sign out anyway?')) return;
    setAuthBusy(true);
    try { await logOut(); }
    catch { setActionError('Could not sign out. Please try again.'); }
    finally { setAuthBusy(false); }
  }
  if (!studioId) return <div className="af-theme af-library"><a className="skip-link" href="#main">Skip to main content</a><DashboardHeader user={user} busy={authBusy} loading={authLoading} onNavigate={navigate} onSignIn={() => { void signIn(); }} onSignOut={() => { void signOut(); }} />{import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL && <div className="af-library-emulator" role="note">Local Firebase emulators</div>}{(actionError || authError) && <div className="af-library-alert" role="alert">{actionError || authError}</div>}<Dashboard user={user} api={api} loading={authLoading} busy={authBusy} onSignIn={(anonymous) => { void signIn(anonymous); }} onNavigate={navigate} /></div>;
  return <div className={`app-shell ${studioId && studioId !== 'preview' ? 'af-editor-app' : ''}`}><a className="skip-link" href="#main">Skip to main content</a><header className="app-header"><button type="button" className="brand" aria-label="AniForge home" onClick={() => navigate('/')}><span className="brand-symbol"><Clapperboard size={22} /></span><span>AniForge<span className="brand-ai">AI</span></span></button><nav aria-label="Main navigation"><button type="button" className={`nav-button ${studioId !== 'preview' ? 'active' : ''}`} aria-current={!studioId ? 'page' : undefined} onClick={() => navigate('/projects')}><FolderOpen size={16} />Projects</button><button type="button" className={`nav-button ${studioId === 'preview' ? 'active' : ''}`} aria-current={studioId === 'preview' ? 'page' : undefined} onClick={() => navigate('/studio/preview')}><Pencil size={16} />Sketch playground</button></nav><div className="header-account"><span className="foundation-badge">{import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ? 'Local Firebase emulators' : 'Source editor'}</span>{user ? <><span className="account-name">{user.isAnonymous ? 'Guest' : user.displayName ?? user.email ?? 'Your account'}</span><button type="button" className="icon-button" disabled={authBusy} aria-label="Sign out" title="Sign out" onClick={() => { void signOut(); }}><LogOut size={17} /></button></> : <button type="button" className="button secondary compact" disabled={!firebaseConfigured || authLoading || authBusy} onClick={() => { void signIn(); }}><LogIn size={16} />Sign in</button>}</div></header>
    {import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL && <div className="emulator-notice" role="note">Local Firebase emulators · Data is stored on this computer. AI calls are disabled.</div>}{(actionError || authError) && <div className="global-error error-banner" role="alert">{actionError || authError}</div>}
    {studioId && studioId !== 'preview' && (authLoading || !user) ? <main id="main" tabIndex={-1} className="af-theme af-library-return"><SignInPanel returning loading={authLoading} busy={authBusy} onSignIn={() => { void signIn(); }} /><button type="button" className="af-button af-button--secondary" onClick={() => navigate('/projects')}>Back to projects</button></main> : studioId ? <Studio key={`${studioId}-${user?.uid ?? 'local'}`} projectId={studioId} api={api} user={user} onBack={() => navigate('/projects')} /> : <Dashboard user={user} api={api} loading={authLoading} busy={authBusy} onSignIn={(anonymous) => { void signIn(anonymous); }} onNavigate={navigate} />}
  </div>;
}
