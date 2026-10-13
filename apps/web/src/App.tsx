import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import './styles.css';
import type { User } from 'firebase/auth';
import type { Project, Scene } from '@aniforge/shared';
import { ArrowLeft, LoaderCircle, ShieldCheck } from 'lucide-react';
import { authenticate, logOut, useAuth } from './firebase';
import { createApiClient, errorMessage, type ProjectApi } from './api';
import { Dashboard, DashboardHeader, SignInPanel } from './dashboard/Dashboard';
import { mayLeaveStudio } from './navigationGuard';
import { useNavigation } from './useNavigation';

const SavedCanvas = lazy(() => import('./CanvasEditor').then((module) => ({ default: module.CanvasEditor })));

const CanvasPreview = lazy(() => import('./SketchPreview').then((module) => ({ default: module.SketchPreview })));
function SketchPreview({ onBack }: { onBack: () => void }) {
  return <Suspense fallback={<div className="loading-state" role="status"><LoaderCircle className="spin" size={20} />Loading drawing tools…</div>}><CanvasPreview onBack={onBack} /></Suspense>;
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

  return <main id="main" tabIndex={-1} className="af-playground-route"><SketchPreview onBack={onBack} /></main>;
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
  if (studioId === 'preview') return <div className="af-theme af-playground-app"><a className="skip-link" href="#main">Skip to main content</a><DashboardHeader user={user} busy={authBusy} loading={authLoading} onNavigate={navigate} onSignIn={() => { void signIn(); }} onSignOut={() => { void signOut(); }} />{import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL && <div className="af-library-emulator" role="note">Local Firebase emulators</div>}{(actionError || authError) && <div className="af-library-alert" role="alert">{actionError || authError}</div>}<Studio projectId="preview" api={api} user={user} onBack={() => navigate('/projects')} /></div>;
  return <div className="af-theme af-editor-app"><a className="skip-link" href="#main">Skip to main content</a>
    <DashboardHeader studio user={user} busy={authBusy} loading={authLoading} onNavigate={navigate} onSignIn={() => { void signIn(); }} onSignOut={() => { void signOut(); }} />
    {import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL && <div className="af-library-emulator" role="note">Local Firebase emulators</div>}
    {(actionError || authError) && <div className="af-library-alert" role="alert">{actionError || authError}</div>}
    {authLoading || !user ? <main id="main" tabIndex={-1} className="af-library-return"><SignInPanel returning loading={authLoading} busy={authBusy} onSignIn={() => { void signIn(); }} /><button type="button" className="af-button af-button--secondary" onClick={() => navigate('/projects')}>Back to projects</button></main> : <Studio key={studioId + '-' + user.uid} projectId={studioId} api={api} user={user} onBack={() => navigate('/projects')} />}
  </div>;
}
