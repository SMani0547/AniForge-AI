import { useEffect, useState } from 'react';
import type { Asset, CanvasObject, ImageCrop } from '@aniforge/shared';
import { clamp } from './editor';
import { errorMessage, type ProjectApi } from './api';

export function ImageCropInspector({ object, api, projectId, onChange }: { object: Extract<CanvasObject, { type: 'image' }>; api: ProjectApi; projectId: string; onChange: (crop: ImageCrop) => void }) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setAsset(null); setError('');
    api.getAsset(projectId, object.assetId).then((value) => { if (active) setAsset(value); }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)); });
    return () => { active = false; };
  }, [api, projectId, object.assetId, retry]);
  if (error) return <div className="error-banner" role="alert">{error}<button type="button" className="text-button" onClick={() => setRetry((value) => value + 1)}>Retry image metadata</button></div>;
  if (!asset) return <p className="input-hint">Loading original image dimensions…</p>;
  const crop = object.crop ?? { x: 0, y: 0, width: asset.width, height: asset.height };
  function update(field: keyof ImageCrop, value: number) {
    if (!Number.isFinite(value) || !asset) return;
    const next = { ...crop, [field]: Math.round(value) };
    next.x = clamp(next.x, 0, asset.width - 1); next.y = clamp(next.y, 0, asset.height - 1);
    next.width = clamp(next.width, 1, asset.width - next.x); next.height = clamp(next.height, 1, asset.height - next.y);
    onChange(next);
  }
  return <fieldset disabled={object.locked}><legend>Original image crop</legend><p className="input-hint">Private original: {asset.width} × {asset.height} pixels</p><div className="property-grid">{(['x', 'y', 'width', 'height'] as const).map((field) => <label key={field}>Image crop {field}<input type="number" min={field === 'width' || field === 'height' ? 1 : 0} max={field === 'x' || field === 'width' ? asset.width : asset.height} value={Math.round(crop[field])} onChange={(event) => update(field, event.target.valueAsNumber)} /></label>)}</div><button type="button" className="text-button" onClick={() => onChange({ x: 0, y: 0, width: asset.width, height: asset.height })}>Use full original</button></fieldset>;
}
