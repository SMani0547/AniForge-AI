import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Project, Scene } from '@aniforge/shared';
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Clapperboard, Copy, Film, FolderOpen, Layers3, LoaderCircle, LogIn, LogOut, Pencil, Plus, RefreshCw, Settings2, ShieldCheck, Sparkles, Trash2, WandSparkles } from 'lucide-react';
import { anonymousEnabled, authenticate, firebaseConfigured, logOut, useAuth } from './firebase';
import { createApiClient, errorMessage, newestFirst, type ProjectApi } from './api';
import { ProjectDialog } from './ProjectDialog';
import { mayLeaveStudio } from './navigationGuard';

const SavedCanvas = lazy(() => import('./CanvasEditor').then((module) => ({ default: module.CanvasEditor })));

const CanvasPreview = lazy(() => import('./SketchPreview').then((module) => ({ default: module.SketchPreview })));
function SketchPreview() {
  return <Suspense fallback={<div className="loading-state" role="status"><LoaderCircle className="spin" size={20} />Loading drawing tools…</div>}><CanvasPreview /></Suspense>;
}

function useNavigation() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => { if (mayLeaveStudio()) setPath(window.location.pathname); else window.history.pushState({}, '', path); };
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, [path]);
  function navigate(next: string, authorized = false) {
    if (next === path || (!authorized && !mayLeaveStudio())) return;
    window.history.pushState({}, '', next);
    setPath(next);
    window.scrollTo(0, 0);
  }
  return { path, navigate };
}

function SetupNotice() {
  return <details className="setup-notice"><summary><Settings2 size={17} /><span>Connect Firebase to save your projects</span><ChevronRight size={17} className="details-chevron" /></summary><div className="setup-content"><p>Local sketching is available now. Sign-in and cloud projects need a connected Firebase project.</p><ol><li>Register a Firebase web app and enable Google sign-in in Authentication.</li><li>Copy <code>apps/web/.env.example</code> to <code>apps/web/.env</code> and add the public Firebase web configuration.</li><li>Configure the API credentials and Firestore using <code>README.md</code>, then restart development servers.</li></ol><p>Google AI credentials belong on the server. Video generation stays unavailable until real model access is verified.</p></div></details>;
}

function SignedOut({ loading, onSignIn, busy }: { loading: boolean; onSignIn: (anonymous?: boolean) => void; busy: boolean }) {
  return <div className="empty-projects"><div className="empty-icon"><FolderOpen size={30} /></div><h2>{loading ? 'Restoring your session…' : 'Make room for your next idea'}</h2><p>Sign in to create your own project library.<br />Your stories stay connected to your account.</p><button type="button" className="button primary" disabled={loading || busy || !firebaseConfigured} onClick={() => onSignIn()}><LogIn size={17} />{busy ? 'Signing in…' : 'Continue with Google'}</button>{anonymousEnabled && firebaseConfigured && <><button type="button" className="text-button" disabled={loading || busy} onClick={() => onSignIn(true)}>Continue as a guest</button><p className="guest-note">Guest projects belong to this browser session. Clearing browser data can make them inaccessible.</p></>}{!firebaseConfigured && <span className="muted small">Sign-in requires Firebase setup.</span>}</div>;
}

function ProjectGallery({ api, onOpen }: { api: ProjectApi; onOpen: (project: Project) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ kind: 'create' | 'rename' | 'delete'; project?: Project } | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [revision, setRevision] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.listProjects().then((result) => { if (active) { setProjects(result.items); setNextCursor(result.nextCursor); } }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, revision]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true); setError('');
    try { const page = await api.listProjects(nextCursor); setProjects((previous) => [...previous, ...page.items.filter((item) => !previous.some((existing) => existing.id === item.id))]); setNextCursor(page.nextCursor); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setLoadingMore(false); }
  }

  function showModal(kind: 'create' | 'rename' | 'delete', project?: Project) { setModalError(''); setModal({ kind, project }); }
  async function submitModal(title: string) {
    if (!modal) return;
    setModalBusy(true);
    setModalError('');
    try {
      if (modal.kind === 'create') {
        const project = await api.createProject(title);
        setProjects((previous) => newestFirst([project, ...previous]));
        setNotice(`Created ${project.title}.`);
      } else if (modal.kind === 'rename' && modal.project) {
        const project = await api.renameProject(modal.project.id, title);
        setProjects((previous) => newestFirst(previous.map((item) => item.id === project.id ? project : item)));
        setNotice(`Renamed project to ${project.title}.`);
      } else if (modal.kind === 'delete' && modal.project) {
        await api.deleteProject(modal.project.id);
        const deletedId = modal.project.id;
        setProjects((previous) => previous.filter((item) => item.id !== deletedId));
        setNotice('Project deleted.');
      }
      setModal(null);
    } catch (reason) { setModalError(errorMessage(reason)); }
    finally { setModalBusy(false); }
  }

  async function duplicate(project: Project) {
    setBusyId(project.id);
    setError('');
    try {
      const copy = await api.duplicateProject(project.id);
      setProjects((previous) => newestFirst([copy, ...previous]));
      setNotice(`Created ${copy.title}.`);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusyId(null); }
  }

  return <section aria-labelledby="projects-heading">
    <div className="section-heading"><div><h2 id="projects-heading">Your projects <span className="count">{projects.length}</span></h2><p>Your ideas, ready for their next chapter.</p></div><div className="section-actions"><button type="button" className="icon-button" aria-label="Refresh projects" disabled={loading || busyId !== null} onClick={() => setRevision((previous) => previous + 1)}><RefreshCw size={18} className={loading ? 'spin' : ''} /></button><button type="button" className="button primary" disabled={loading || busyId !== null} onClick={() => showModal('create')}><Plus size={17} />New project</button></div></div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="sr-only" role="status">{notice}</div>
    {loading ? <div className="loading-state" role="status"><LoaderCircle className="spin" size={24} />Loading your projects…</div> : !projects.length ? <div className="empty-projects"><div className="empty-icon"><Clapperboard size={30} /></div><h3>A blank slate. All yours.</h3><p>Create a project to start organizing your original scenes.</p><button type="button" className="button secondary" onClick={() => showModal('create')}><Plus size={17} />Create your first project</button></div> : <div className="project-grid">{projects.map((project) => <article key={project.id} className="project-card"><button type="button" className="project-open" onClick={() => onOpen(project)} aria-label={`Open ${project.title}`}><div className="project-thumbnail"><span className="thumbnail-frame"><Clapperboard size={27} /></span><span>No scene preview</span><span className="aspect-badge">16:9</span></div><div className="project-info"><h3>{project.title}</h3><span>{project.sceneOrder.length} {project.sceneOrder.length === 1 ? 'scene' : 'scenes'}<span aria-hidden="true"> · </span>Edited {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(project.updatedAt))}</span></div></button><div className="project-card-actions"><span className="private-label"><ShieldCheck size={13} />Private project</span><button type="button" className="icon-button" aria-label={`Rename ${project.title}`} disabled={busyId !== null} onClick={() => showModal('rename', project)}><Pencil size={15} /></button><button type="button" className="icon-button" aria-label={`Duplicate ${project.title}`} disabled={busyId !== null} onClick={() => { void duplicate(project); }}>{busyId === project.id ? <LoaderCircle className="spin" size={15} /> : <Copy size={15} />}</button><button type="button" className="icon-button" aria-label={`Delete ${project.title}`} disabled={busyId !== null} onClick={() => showModal('delete', project)}><Trash2 size={15} /></button></div></article>)}</div>}
    {nextCursor && !loading && <div className="load-more"><button type="button" className="button secondary" disabled={loadingMore} onClick={() => { void loadMore(); }}>{loadingMore ? 'Loading projects…' : 'Load more projects'}</button></div>}
    {modal && <ProjectDialog kind={modal.kind} title={modal.project?.title} busy={modalBusy} error={modalError} onClose={() => setModal(null)} onSubmit={submitModal} />}
  </section>;
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

  if (!preview) return <main id="main" className="studio-page"><div className="studio-heading"><div className="studio-title"><button type="button" className="icon-button" aria-label="Back to projects" onClick={onBack}><ArrowLeft size={19} /></button><div><h1>{project?.title ?? 'Your project'}</h1><p>Private project · Editable source canvas</p></div></div><span className="status-chip"><ShieldCheck size={13} />Source editor</span></div>{loading ? <div className="loading-state" role="status"><LoaderCircle className="spin" />Opening your project…</div> : error ? <div className="error-banner" role="alert">{error}</div> : scene && <Suspense fallback={<div className="loading-state" role="status">Loading editor…</div>}><SavedCanvas key={`${scene.id}-${sceneKey}`} scene={scene} api={api} onReload={async () => { const latest = await api.getScene(projectId, scene.id); setScene(latest); setSceneKey((value) => value + 1); }} /></Suspense>}</main>;

  return <main id="main" className="studio-page">
    <div className="studio-heading"><div className="studio-title"><button type="button" className="icon-button" aria-label="Back to projects" onClick={onBack}><ArrowLeft size={19} /></button><div><h1>{preview ? 'Sketch playground' : project?.title ?? 'Your project'}</h1><p>{preview ? 'Explore your first idea' : 'Cloud project · Canvas editing preview'}</p></div></div><span className="status-chip"><span className="status-dot amber" />Preview · not saved</span></div>
    {loading ? <div className="loading-state" role="status"><LoaderCircle className="spin" />Opening your project…</div> : error ? <div className="error-banner" role="alert">{error}</div> : <div className="studio-grid"><div className="canvas-column"><div className="panel-title"><span><Layers3 size={17} />Source canvas</span><span className="muted small">Editable drawing preview</span></div><SketchPreview /><div className="timeline-empty"><Film size={21} /><div><strong>Your story will take shape here</strong><p>Generated clips and their versions will appear in the timeline in a later milestone.</p></div><span className="outline-tag">No clips</span></div></div><aside className="inspector" aria-label="Scene assistant"><div className="panel-title"><span><Sparkles size={17} />Scene assistant</span><span className="tiny-pill">GOOGLE AI</span></div><div className="inspector-content"><span className="eyebrow">FROM IDEA TO MOTION</span><h2>Keep your vision.<br />Explore the movement.</h2><p>Plan the action, camera and mood of your original scene with Gemini.</p><div className="workflow-step"><span className="step-number active">1</span><div><strong>Draw your source</strong><p>Try the local sketch tools. Open a project to save an editable scene.</p></div></div><div className="workflow-step"><span className="step-number">2</span><div><strong>Build your shot plan</strong><p>Scene analysis is not connected to this preview.</p></div></div><div className="workflow-step"><span className="step-number">3</span><div><strong>Bring it into motion</strong><p>Video requires verified model access and a configured backend.</p></div></div><button type="button" className="button secondary full-width" disabled aria-describedby="ai-unavailable"><WandSparkles size={17} />Analyze scene</button><button type="button" className="button primary full-width" disabled aria-describedby="ai-unavailable"><Sparkles size={17} />Generate animation</button><div className="availability-note" id="ai-unavailable"><CircleHelp size={17} /><span>AI generation is unavailable in this foundation preview. No AI requests are sent from this canvas.</span></div><div className="source-note"><ShieldCheck size={18} /><p>Your editable source and rendered video are separate. AI video edits will create new versions.</p></div></div></aside></div>}
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
    setAuthBusy(true);
    try { await logOut(); navigate('/projects', true); }
    catch { setActionError('Could not sign out. Please try again.'); }
    finally { setAuthBusy(false); }
  }
  return <div className="app-shell"><a className="skip-link" href="#main">Skip to main content</a><header className="app-header"><button type="button" className="brand" aria-label="AniForge home" onClick={() => navigate('/projects')}><span className="brand-symbol"><Clapperboard size={22} /></span><span>AniForge<span className="brand-ai">AI</span></span></button><nav aria-label="Main navigation"><button type="button" className={`nav-button ${studioId !== 'preview' ? 'active' : ''}`} aria-current={!studioId ? 'page' : undefined} onClick={() => navigate('/projects')}><FolderOpen size={16} />Projects</button><button type="button" className={`nav-button ${studioId === 'preview' ? 'active' : ''}`} aria-current={studioId === 'preview' ? 'page' : undefined} onClick={() => navigate('/studio/preview')}><Pencil size={16} />Sketch playground</button></nav><div className="header-account"><span className="foundation-badge">{import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ? 'Local Firebase emulators' : 'Source editor'}</span>{user ? <><span className="account-name">{user.isAnonymous ? 'Guest' : user.displayName ?? user.email ?? 'Your account'}</span><button type="button" className="icon-button" disabled={authBusy} aria-label="Sign out" title="Sign out" onClick={() => { void signOut(); }}><LogOut size={17} /></button></> : <button type="button" className="button secondary compact" disabled={!firebaseConfigured || authLoading || authBusy} onClick={() => { void signIn(); }}><LogIn size={16} />Sign in</button>}</div></header>
    {import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL && <div className="emulator-notice" role="note">Local Firebase emulators · Data is stored on this computer. AI calls are disabled.</div>}{(actionError || authError) && <div className="global-error error-banner" role="alert">{actionError || authError}</div>}
    {studioId ? <Studio key={`${studioId}-${user?.uid ?? 'local'}`} projectId={studioId} api={api} user={user} onBack={() => navigate('/projects')} /> : <main id="main" className="gallery-page"><section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="small-line" />THE ORIGINAL STARTS WITH YOU</div><h1>Your story.<br /><span>Next frame.</span></h1><p>A space for your sketches, your characters and the stories only you can tell. Start with an idea. Make it your own.</p><button type="button" className="button primary" onClick={() => navigate('/studio/preview')}>Try the sketch playground<ArrowRight size={17} /></button><span className="hero-footnote">No sign-in needed · Unsaved local preview</span></div><div className="hero-art" aria-hidden="true"><div className="art-grid" /><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-frame"><div className="art-topbar"><span /><span /><span /><small>YOUR NEXT SCENE</small></div><svg viewBox="0 0 420 220" fill="none"><path d="M22 172L92 125L155 159L227 71L297 132L342 99L402 161" stroke="#8EA7F1" strokeWidth="2" /><path d="M22 184L92 137L155 171L227 83L297 144L342 111L402 173" stroke="#8EA7F1" strokeWidth="1" opacity=".2" /><circle cx="300" cy="56" r="24" stroke="#BDA3FF" strokeWidth="1.5" /><path d="M65 192H358" stroke="#8EA7F1" opacity=".2" /><path d="M207 71H247M227 51V91" stroke="#BDA3FF" strokeWidth="1" /><path d="M18 35V18H35M385 18H402V35M18 185V202H35M385 202H402V185" stroke="#BDA3FF" opacity=".4" /></svg><div className="art-bottom"><span>01 / A NEW BEGINNING</span><span>16:9</span></div></div><div className="floating-label"><Pencil size={15} />Your vision, first.</div><span className="art-spark">✧</span></div></section>
      <div className="workflow-strip"><div><span className="workflow-icon"><Pencil size={17} /></span><strong>Sketch an idea</strong><span>Original from the first line</span></div><div><span className="workflow-icon"><Layers3 size={17} /></span><strong>Build your scene</strong><span>Keep your source editable</span></div><div><span className="workflow-icon"><Film size={17} /></span><strong>Find your motion</strong><span>AI workflow coming next</span></div></div>
      {!firebaseConfigured && <SetupNotice />}
      {user ? <ProjectGallery key={user.uid} api={api} onOpen={(project) => navigate(`/studio/${project.id}`)} /> : <section aria-labelledby="library-heading"><div className="section-heading"><div><h2 id="library-heading">Your creative space</h2><p>Every story begins with a first project.</p></div><span className="private-label"><ShieldCheck size={15} />Private by design</span></div><SignedOut loading={authLoading} onSignIn={(anonymous) => { void signIn(anonymous); }} busy={authBusy} /></section>}
      <footer className="page-footer"><span>AniForge AI <span aria-hidden="true">/</span> Draw it. Shape it. Make it yours.</span><span><Check size={14} />Original work belongs here.</span></footer>
    </main>}
  </div>;
}
