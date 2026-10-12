import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LoaderCircle, X } from 'lucide-react';

export interface ProjectDialogProps {
  kind: 'create' | 'rename' | 'delete';
  title?: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (title: string) => Promise<void>;
}

export function ProjectDialog({ kind, title = '', busy, error, onClose, onSubmit }: ProjectDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(title);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const deleting = kind === 'delete';
  function submit(event: FormEvent) { event.preventDefault(); if (!busy && (deleting || value.trim())) void onSubmit(value.trim()); }
  return <dialog ref={dialog} className="project-dialog" aria-labelledby="dialog-heading" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={submit}>
      <div className="dialog-heading"><h2 id="dialog-heading">{deleting ? 'Delete project?' : kind === 'rename' ? 'Rename project' : 'Start a new story'}</h2><button className="icon-button" type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={20} /></button></div>
      {deleting ? <p>This permanently deletes <strong>{title}</strong> and its scenes. This cannot be undone.</p> : <><p>{kind === 'create' ? 'Give your original animation project a name.' : 'Choose a new name for your project.'}</p><label className="input-label" htmlFor="project-title">Project name</label><input id="project-title" autoFocus required minLength={1} maxLength={120} value={value} onChange={(event) => setValue(event.target.value)} placeholder="A story only you can tell" disabled={busy} /><span className="input-hint">16:9 widescreen · Editable scene structure</span></>}
      {error && <div role="alert" className="error-banner">{error}</div>}
      <div className="dialog-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className={`button ${deleting ? 'danger' : 'primary'}`} type="submit" disabled={busy || (!deleting && !value.trim())}>{busy && <LoaderCircle size={16} className="spin" />}{busy ? 'Working…' : deleting ? 'Delete project' : kind === 'rename' ? 'Save name' : 'Create project'}</button></div>
    </form>
  </dialog>;
}
