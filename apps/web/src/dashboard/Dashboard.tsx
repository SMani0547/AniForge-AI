import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Project } from '@aniforge/shared';
import { ArrowRight, FolderOpen, Layers3, LogIn, Pencil, Plus, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { anonymousEnabled, firebaseConfigured } from '../firebase';
import { ApiError, errorMessage, newestFirst, type ProjectApi } from '../api';
import { ProjectDialog } from '../ProjectDialog';
import { ActionMenu, Badge, Button, Field, IconButton, Notice, Skeleton, Tabs } from '../ui/Primitives';
import './dashboard.css';

export function DashboardHeader({ user, busy, loading, onNavigate, onSignIn, onSignOut, studio = false }: { studio?: boolean; user: User | null; busy: boolean; loading: boolean; onNavigate: (path: string) => void; onSignIn: () => void; onSignOut: () => void }) {
  return <header className="af-library-header">
    <button className="af-library-brand" aria-label="AniForge home" onClick={() => onNavigate('/')}><span>af</span>aniforge<small>AI</small></button>
    <span className="af-library-divider" aria-hidden="true" />
    {studio ? <nav className="af-studio-navigation" aria-label="Studio navigation"><Button variant="quiet" onClick={() => onNavigate('/projects')}><FolderOpen size={16} />Projects</Button><Button variant="quiet" onClick={() => onNavigate('/studio/preview')}><Pencil size={16} />Sketch playground</Button></nav> : <span className="af-library-location">Your workspace</span>}
    <div className="af-library-account">{user ? <><Badge>{user.isAnonymous ? 'Guest workspace' : 'Personal workspace'}</Badge><ActionMenu label="Account" actions={[{ label: busy ? 'Signing out…' : 'Sign out', onSelect: () => { if (!busy) onSignOut(); } }]} /><span className="af-account-name">{user.isAnonymous ? 'Guest' : user.displayName ?? user.email ?? 'Your account'}</span></> : <Button variant="secondary" disabled={busy || loading || !firebaseConfigured} onClick={onSignIn}><LogIn size={16} />Sign in</Button>}</div>
  </header>;
}

export function SignInPanel({ loading, busy, onSignIn, returning = false }: { loading: boolean; busy: boolean; onSignIn: (anonymous?: boolean) => void; returning?: boolean }) {
  if (loading) return <div className="af-library-auth"><Skeleton label="Restoring your session" /><p role="status">Restoring your session…</p></div>;
  return <section className="af-library-auth" aria-labelledby="signin-heading"><div className="af-library-symbol"><FolderOpen size={30} /></div><p className="af-eyebrow">Your personal workspace</p><h2 id="signin-heading">{returning ? 'Sign in to return to your project' : 'A home for your next idea.'}</h2><p>{returning ? 'Use the account that owns this project. Your saved source stays in that account.' : 'Save original scenes, pick up where you left off and keep your projects together.'}</p><Button disabled={busy || !firebaseConfigured} onClick={() => onSignIn()}><LogIn size={17} />{busy ? 'Signing in…' : 'Continue with Google'}</Button>{anonymousEnabled && firebaseConfigured && !returning && <><Button variant="quiet" disabled={busy} onClick={() => onSignIn(true)}>Continue as a guest</Button><p className="af-guest-note">Guest access stays in this browser. Clearing browser data or signing out can make guest projects inaccessible.</p></>}{!firebaseConfigured && <div className="af-library-setup"><strong>Saved projects are not configured yet</strong><p>You can still draw in the unsaved playground. The site operator needs to connect Firebase to enable sign-in and saving.</p>{import.meta.env.DEV && <details><summary>Developer setup</summary><p>See docs/cloud-setup.md or run the local emulators described in README.md.</p></details>}</div>}</section>;
}

function ProjectPreview({ project, api }: { project: Project; api: ProjectApi }) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState('');
  const [state, setState] = useState('Preview not yet available');
  useEffect(() => {
    const element = ref.current; if (!element) return;
    const abort = new AbortController(); let objectUrl = ''; let active = true;
    setUrl(''); setState('Preview not yet available');
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect(); setState('Loading preview…');
      void api.getThumbnail(project.id, abort.signal).then((blob) => {
        if (!active) return;
        if (blob) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } else setState('Preview not yet available');
      }).catch(() => { if (active) setState('Preview unavailable'); });
    }, { rootMargin: '100px' });
    observer.observe(element);
    return () => { active = false; abort.abort(); observer.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [api, project.id, project.updatedAt]);
  return <div ref={ref} className="af-library-preview">{url ? <img src={url} alt={`Saved source preview for ${project.title}`} /> : <><span className="af-preview-frame"><Layers3 size={27} /></span><span>{state}</span><small>Open the scene to draw or import</small></>}<span className="af-preview-ratio">16:9</span></div>;
}

function Library({ api, onOpen, onSignIn }: { api: ProjectApi; onOpen: (project: Project) => void; onSignIn: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ kind: 'create' | 'rename' | 'delete'; project?: Project } | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [revision, setRevision] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated');
  const [view, setView] = useState('grid');
  const heading = useRef<HTMLHeadingElement>(null);
  function report(reason: unknown) { setError(errorMessage(reason)); setExpired(reason instanceof ApiError && reason.status === 401); }
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setExpired(false);
    api.listProjects().then((result) => { if (active) { setProjects(result.items); setNextCursor(result.nextCursor); } }).catch((reason: unknown) => { if (active) report(reason); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, revision]);
  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true); setError('');
    try { const page = await api.listProjects(nextCursor); setProjects((previous) => [...previous, ...page.items.filter((item) => !previous.some((existing) => existing.id === item.id))]); setNextCursor(page.nextCursor); }
    catch (reason) { report(reason); } finally { setLoadingMore(false); }
  }
  function showModal(kind: 'create' | 'rename' | 'delete', project?: Project) { setModalError(''); setModal({ kind, project }); }
  async function submitModal(title: string) {
    if (!modal) return; setModalBusy(true); setModalError('');
    try {
      if (modal.kind === 'create') {
        const project = await api.createProject(title); setModal(null); onOpen(project); return;
      } else if (modal.kind === 'rename' && modal.project) {
        const project = await api.renameProject(modal.project.id, title);
        setProjects((previous) => previous.map((item) => item.id === project.id ? project : item)); setNotice(`Renamed project to ${project.title}.`);
      } else if (modal.kind === 'delete' && modal.project) {
        await api.deleteProject(modal.project.id); const id = modal.project.id;
        setProjects((previous) => previous.filter((item) => item.id !== id)); setNotice('Project deleted.');
      }
      setModal(null); heading.current?.focus();
    } catch (reason) { setModalError(errorMessage(reason)); } finally { setModalBusy(false); }
  }
  async function duplicate(project: Project) {
    if (busyId) return; setBusyId(project.id); setError('');
    try { const copy = await api.duplicateProject(project.id); setProjects((previous) => [copy, ...previous]); setNotice(`Created ${copy.title}. Source layers copied; generated clips are not copied.`); }
    catch (reason) { report(reason); } finally { setBusyId(null); }
  }
  const visible = (sort === 'title' ? [...projects].sort((a,b) => a.title.localeCompare(b.title)) : newestFirst(projects)).filter((project) => project.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const disabled = loading || loadingMore || busyId !== null || modalBusy;
  return <section aria-labelledby="projects-heading">
    <div className="af-library-heading"><div><p className="af-eyebrow">Make room for your ideas</p><h1 ref={heading} tabIndex={-1} id="projects-heading">Your projects<span>{projects.length} loaded</span></h1><p>Original scenes. Ready for your next move.</p></div><Button disabled={disabled} onClick={() => showModal('create')}><Plus size={18} />New project</Button></div>
    <div className="af-library-toolbar"><Field type="search" label="Search loaded projects" placeholder="Find a project by name" value={query} onChange={(event) => setQuery(event.target.value)} /><label className="af-library-sort">Sort loaded projects<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="updated">Last edited</option><option value="title">Name A–Z</option></select></label><Tabs label="Project presentation" items={[{ id: 'grid', label: 'Grid' }, { id: 'list', label: 'List' }]} value={view} onChange={setView} /><IconButton label="Refresh projects" disabled={disabled} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={18} /></IconButton></div>
    <p className="af-library-scope">{nextCursor ? `${projects.length} projects loaded. More projects are available below. Search and sort apply only to loaded projects.` : 'Search and sort apply to the projects loaded in this view.'}</p>
    {notice && <Notice onDismiss={() => setNotice('')}>{notice}</Notice>}
    {error && <Notice error>{error} {expired && <Button variant="secondary" onClick={onSignIn}>Sign in again</Button>}<Button variant="quiet" disabled={disabled} onClick={() => setRevision((value) => value + 1)}>Retry project list</Button></Notice>}
    {loading ? <div className="af-library-loading"><p role="status">Loading your projects…</p><div>{[0,1,2].map((id) => <Skeleton key={id} label="Loading project" />)}</div></div> : !projects.length && !error ? <div className="af-library-empty"><div className="af-library-symbol"><Pencil size={30} /></div><p className="af-eyebrow">Your first scene starts here</p><h2>A blank slate. All yours.</h2><p>Create a project, then draw or import your own artwork.<br />You can edit and save before generating a video.</p><Button variant="secondary" onClick={() => showModal('create')}><Plus size={17} />Create your first project</Button></div> : !visible.length && projects.length > 0 ? <div className="af-library-empty"><h2>No loaded projects match</h2><p>Try another name{nextCursor ? ' or load more projects below' : ''}.</p><Button variant="secondary" onClick={() => setQuery('')}>Clear search</Button></div> : <div className={`af-library-projects af-library-projects--${view}`} aria-busy={busyId !== null}>{visible.map((project) => <article className="af-library-card" key={project.id}>
      <button className="af-library-open" type="button" aria-label={`Open ${project.title}`} disabled={busyId !== null} onClick={() => onOpen(project)}><ProjectPreview project={project} api={api} /><div className="af-library-info"><h2>{project.title}</h2><p>{project.sceneOrder.length} {project.sceneOrder.length === 1 ? 'scene' : 'scenes'}<span aria-hidden="true"> · </span>Edited <time dateTime={project.updatedAt} title={new Date(project.updatedAt).toLocaleString()}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(project.updatedAt))}</time></p></div></button>
      <div className="af-library-card-footer"><span><ShieldCheck size={14} />{busyId === project.id ? 'Duplicating…' : 'Private project'}</span>{busyId === null && <ActionMenu label={`Actions for ${project.title}`} actions={[{ label: `Rename ${project.title}`, onSelect: () => showModal('rename', project) }, { label: `Duplicate ${project.title}`, onSelect: () => { void duplicate(project); } }, { label: `Delete ${project.title}`, onSelect: () => showModal('delete', project) }]} />}</div>
    </article>)}</div>}
    {nextCursor && !loading && <div className="af-library-pagination"><Button variant="secondary" disabled={disabled} onClick={() => { void loadMore(); }}>{loadingMore ? 'Loading projects…' : 'Load more projects'}</Button></div>}
    {modal && <ProjectDialog kind={modal.kind} title={modal.project?.title} busy={modalBusy} error={modalError} onClose={() => setModal(null)} onSubmit={submitModal} />}
  </section>;
}

export function Dashboard({ user, api, loading, busy, onSignIn, onNavigate }: { user: User | null; api: ProjectApi; loading: boolean; busy: boolean; onSignIn: (anonymous?: boolean) => void; onNavigate: (path: string) => void }) {
  const [guide, setGuide] = useState(true);
  return <div className="af-library-layout"><aside className="af-library-sidebar"><p className="af-eyebrow">Workspace</p><nav aria-label="Workspace navigation"><button aria-current="page" onClick={() => onNavigate('/projects')}><FolderOpen size={18} />All projects</button><button onClick={() => onNavigate('/studio/preview')}><Pencil size={18} />Drawing playground<ArrowRight size={15} /></button></nav><div className="af-sidebar-help"><Layers3 size={22} /><strong>Your source comes first.</strong><p>Draw and plan your shot before you generate a clip.</p><button onClick={() => setGuide(true)}>Getting started</button></div></aside><main id="main" tabIndex={-1} className="af-library-main">
    {user?.isAnonymous && <p className="af-library-guest"><ShieldCheck size={16} />Guest projects stay in this browser. Signing out or clearing browser data can make them inaccessible.</p>}
    {user ? <Library key={user.uid} api={api} onOpen={(project) => onNavigate(`/studio/${project.id}`)} onSignIn={() => onSignIn()} /> : <><div className="af-library-heading"><div><p className="af-eyebrow">An original starts with you</p><h1>Your workspace</h1><p>Bring an idea. Give it somewhere to grow.</p></div></div><SignInPanel loading={loading} busy={busy} onSignIn={onSignIn} /></>}
    {guide && <aside className="af-library-guide" aria-label="Getting started"><div><Pencil size={22} /><h2>From blank canvas to your first scene</h2></div><ol><li><strong>01 / Start a project</strong><span>A name opens a blank, editable scene.</span></li><li><strong>02 / Make it yours</strong><span>Draw, add text or import an original image.</span></li><li><strong>03 / Save your direction</strong><span>Reopen your source and write a manual shot plan. No AI call needed.</span></li></ol><button className="af-guide-playground" onClick={() => onNavigate('/studio/preview')}>Try the unsaved playground <ArrowRight size={16} /></button><IconButton label="Dismiss getting started" onClick={() => setGuide(false)}><X size={17} /></IconButton></aside>}
  </main></div>;
}
