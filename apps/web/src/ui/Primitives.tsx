import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import './tokens.css';
import './primitives.css';

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'danger' }) {
  return <button type={type} className={`af-button af-button--${variant} ${className}`} {...props} />;
}
export function IconButton({ label, children, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & { label: string }) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);
  return <span className="af-tooltip-wrap" onMouseEnter={() => setDismissed(false)} onFocus={() => setDismissed(false)} onKeyDown={(event) => { if (event.key === 'Escape') setDismissed(true); }}>
    <Button {...props} variant="quiet" className="af-icon-button" aria-label={label} aria-describedby={dismissed ? undefined : id}>{children}</Button>
    {!dismissed && <span className="af-tooltip" role="tooltip" id={id}>{label}</span>}
  </span>;
}
export function Field({ label, hint, error, id: givenId, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId(); const id = givenId ?? generatedId;
  return <div className="af-field"><label htmlFor={id}>{label}</label><input {...props} id={id} aria-invalid={!!error} aria-describedby={hint || error ? `${id}-help` : undefined} />{(hint || error) && <p id={`${id}-help`} className={error ? 'af-error-text' : 'af-muted'}>{error ?? hint}</p>}</div>;
}
export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning'; children: ReactNode }) {
  return <span className={`af-badge af-badge--${tone}`}>{children}</span>;
}
export function Tabs({ label, items, value, onChange }: { label: string; items: { id: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  // A view switcher uses aria-pressed rather than incomplete tab/tabpanel relationships.
  return <div className="af-tabs" role="group" aria-label={label}>{items.map((item) => <button key={item.id} type="button" aria-pressed={value === item.id} onClick={() => onChange(item.id)}>{item.label}</button>)}</div>;
}
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null); const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, [open]);
  return <dialog ref={ref} className="af-dialog" aria-labelledby={id} onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter((item) => item.getClientRects().length);
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}><header><h2 id={id}>{title}</h2><IconButton label="Close dialog" onClick={onClose}><X size={18} /></IconButton></header>{children}</dialog>;
}
export function ActionMenu({ label, actions }: { label: string; actions: { label: string; onSelect: () => void }[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return <details ref={ref} className="af-menu" onKeyDown={(event) => { if (event.key === 'Escape' && ref.current) { ref.current.open = false; ref.current.querySelector('summary')?.focus(); } }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && ref.current) ref.current.open = false; }}>
    <summary>{label}</summary><div className="af-menu-items">{actions.map((action) => <button type="button" key={action.label} onClick={() => { action.onSelect(); if (ref.current) { ref.current.open = false; ref.current.querySelector('summary')?.focus(); } }}>{action.label}</button>)}</div>
  </details>;
}
export function Notice({ children, error = false, onDismiss }: { children: ReactNode; error?: boolean; onDismiss?: () => void }) {
  return <div className={`af-notice ${error ? 'af-notice--error' : ''}`} role={error ? 'alert' : 'status'}><span>{children}</span>{onDismiss && <IconButton label="Dismiss notification" onClick={onDismiss}><X size={16} /></IconButton>}</div>;
}
export function Skeleton({ label = 'Loading preview' }: { label?: string }) {
  return <div className="af-skeleton" role="status" aria-label={label}><span /><span /><span /></div>;
}
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="af-empty"><div className="af-empty-symbol" aria-hidden="true">＋</div><h3>{title}</h3><p className="af-muted">{children}</p>{action}</div>;
}
