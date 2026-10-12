import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { MAX_UPLOAD_BYTES, MAX_IMAGE_PIXELS, type ImageCrop } from '@aniforge/shared';
import { LoaderCircle, X } from 'lucide-react';
import { clamp } from './editor';
import { errorMessage } from './api';

export function ImportDialog({ onClose, onImport }: { onClose: () => void; onImport: (file: File, crop: ImageCrop, dimensions: { width: number; height: number }) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<ImageCrop>({ x: 0, y: 0, width: 1, height: 1 });
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  useEffect(() => {
    if (!file) { setUrl(''); return; }
    const next = URL.createObjectURL(file); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  function choose(next: File | undefined) {
    setError(''); setDimensions({ width: 0, height: 0 }); setAttested(false); setFile(null);
    if (!next) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(next.type)) { setError('Choose a PNG, JPEG, or WEBP image.'); return; }
    if (next.size > MAX_UPLOAD_BYTES) { setError('Choose an image smaller than 10 MiB.'); return; }
    setFile(next);
  }
  function pointer(event: PointerEvent<HTMLDivElement>) {
    const rect = image.current?.getBoundingClientRect();
    if (!rect || !dimensions.width) return null;
    return { x: clamp(Math.round((event.clientX - rect.left) / rect.width * dimensions.width), 0, dimensions.width - 1), y: clamp(Math.round((event.clientY - rect.top) / rect.height * dimensions.height), 0, dimensions.height - 1) };
  }
  function updateCrop(field: keyof ImageCrop, value: number) {
    if (!Number.isFinite(value)) return;
    const next = { ...crop, [field]: Math.round(value) };
    next.x = clamp(next.x, 0, dimensions.width - 1); next.y = clamp(next.y, 0, dimensions.height - 1);
    next.width = clamp(next.width, 1, dimensions.width - next.x); next.height = clamp(next.height, 1, dimensions.height - next.y); setCrop(next);
  }
  async function submit() {
    if (!file || !attested || !dimensions.width || busy) return;
    setBusy(true); setError('');
    try { await onImport(file, crop, dimensions); onClose(); }
    catch (reason) { setError(errorMessage(reason)); setBusy(false); }
  }
  return <dialog ref={dialog} className="project-dialog import-dialog" aria-labelledby="import-heading" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="dialog-heading"><h2 id="import-heading">Import an original image</h2><button type="button" className="icon-button" disabled={busy} aria-label="Close import" onClick={onClose}><X size={20} /></button></div>
    <p>Choose a PNG, JPEG, or WEBP up to 10 MiB and 16 million pixels. Select a panel below. Your full original stays private; the crop remains editable scene data.</p>
    <label className="input-label" htmlFor="source-image">Original image</label><input id="source-image" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => choose(event.target.files?.[0])} />
    {url && <><div className="crop-preview" role="group" aria-label="Panel crop preview" onPointerDown={(event) => { if (busy) return; dragStart.current = pointer(event); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { const start = dragStart.current; const point = pointer(event); if (!start || !point) return; setCrop({ x: Math.min(start.x, point.x), y: Math.min(start.y, point.y), width: Math.max(1, Math.abs(point.x - start.x)), height: Math.max(1, Math.abs(point.y - start.y)) }); }} onPointerUp={() => { dragStart.current = null; }} onPointerCancel={() => { dragStart.current = null; }}>
      <img ref={image} src={url} draggable={false} alt="Original image with selected panel" onLoad={(event) => { const img = event.currentTarget; if (img.naturalWidth * img.naturalHeight > MAX_IMAGE_PIXELS) { setError('This image exceeds the 16 million pixel limit. Resize it before importing.'); setDimensions({ width: 0, height: 0 }); return; } const size = { width: img.naturalWidth, height: img.naturalHeight }; setDimensions(size); setCrop({ x: 0, y: 0, ...size }); }} onError={() => { setError('This image could not be decoded. Choose a valid image.'); setDimensions({ width: 0, height: 0 }); }} />
      {dimensions.width > 0 && <div className="crop-selection" style={{ left: `${crop.x / dimensions.width * 100}%`, top: `${crop.y / dimensions.height * 100}%`, width: `${crop.width / dimensions.width * 100}%`, height: `${crop.height / dimensions.height * 100}%` }} />}
    </div><p className="input-hint">Drag across the preview or enter source pixel coordinates. Confirming the full image is also allowed.</p>
    <fieldset className="crop-fields" disabled={!dimensions.width || busy}><legend>Panel selection</legend>{(['x', 'y', 'width', 'height'] as const).map((field) => <label key={field}>Crop {field}<input type="number" min={field === 'width' || field === 'height' ? 1 : 0} max={field === 'x' || field === 'width' ? dimensions.width : dimensions.height} value={crop[field]} onChange={(event) => updateCrop(field, event.target.valueAsNumber)} /></label>)}<button type="button" className="text-button" onClick={() => setCrop({ x: 0, y: 0, ...dimensions })}>Reset crop</button></fieldset></>}
    <label className="ownership-checkbox"><input type="checkbox" checked={attested} disabled={busy} onChange={(event) => setAttested(event.target.checked)} /><span>I created this image or have permission to use and animate it.</span></label>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="dialog-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>Cancel import</button><button type="button" className="button primary" disabled={!file || !dimensions.width || !attested || busy} onClick={() => { void submit(); }}>{busy && <LoaderCircle size={16} className="spin" />}{busy ? 'Uploading image…' : 'Confirm crop and import'}</button></div>
  </dialog>;
}
