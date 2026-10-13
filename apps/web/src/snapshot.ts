import Konva from 'konva';
import { canvasSchema, type Canvas } from '@aniforge/shared';

export async function decodeSnapshotImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      const timeout = setTimeout(() => { image.src = ''; reject(new Error('An image took too long to decode. Reload images and try again.')); }, 15_000);
      image.onload = () => { clearTimeout(timeout); resolve(image); };
      image.onerror = () => { clearTimeout(timeout); reject(new Error('A source image could not be decoded. Analysis was not sent.')); };
      image.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

/** Fetch every visible source with authorization; missing artwork must never become a placeholder. */
export async function loadSnapshotImages(canvas: Canvas, fetchAsset: (assetId: string) => Promise<Blob>, decode = decodeSnapshotImage): Promise<Map<string, HTMLImageElement>> {
  const ids = [...new Set(canvas.objects.filter((object) => object.type === 'image' && !object.hidden).map((object) => object.type === 'image' ? object.assetId : ''))];
  return new Map(await Promise.all(ids.map(async (id) => [id, await decode(await fetchAsset(id))] as const)));
}

/** Uses fresh nodes at canonical resolution; editor pan, zoom, selection and loading UI are never copied. */
export async function renderCanonicalSnapshot(canvasInput: Canvas, fetchAsset: (assetId: string) => Promise<Blob>, pixelRatio = 1): Promise<Blob> {
  const canvas = canvasSchema.parse(canvasInput);
  const images = await loadSnapshotImages(canvas, fetchAsset);
  const stage = new Konva.Stage({ container: document.createElement('div'), width: 1920, height: 1080 });
  try {
    const background = new Konva.Layer({ listening: false });
    background.add(new Konva.Rect({ width: 1920, height: 1080, fill: canvas.background }));
    const artwork = new Konva.Layer({ listening: false });
    stage.add(background, artwork);
    for (const object of canvas.objects) {
      if (object.hidden) continue;
      const group = new Konva.Group({ x: object.x, y: object.y, width: object.width, height: object.height, rotation: object.rotation, opacity: object.opacity, listening: false });
      const shape = { width: object.width, height: object.height, fill: object.fill, stroke: object.stroke, strokeWidth: object.strokeWidth };
      if (object.type === 'rect') group.add(new Konva.Rect(shape));
      if (object.type === 'ellipse') group.add(new Konva.Ellipse({ x: object.width / 2, y: object.height / 2, radiusX: object.width / 2, radiusY: object.height / 2, fill: object.fill, stroke: object.stroke, strokeWidth: object.strokeWidth }));
      if (object.type === 'text') group.add(new Konva.Text({ ...shape, text: object.text, fontSize: object.fontSize, fontFamily: 'sans-serif' }));
      if (object.type === 'line' || object.type === 'brushStroke') group.add(new Konva.Line({ points: object.points, stroke: object.stroke, strokeWidth: object.strokeWidth, lineCap: 'round', lineJoin: 'round', tension: object.type === 'brushStroke' ? 0.2 : 0, globalCompositeOperation: object.type === 'brushStroke' && object.tool === 'eraser' ? 'destination-out' : 'source-over' }));
      if (object.type === 'image') {
        const image = images.get(object.assetId);
        if (!image) throw new Error('A source image is missing. Analysis was not sent.');
        group.add(new Konva.Image({ image, width: object.width, height: object.height, ...(object.crop ? { crop: object.crop } : {}) }));
      }
      artwork.add(group);
    }
    stage.draw();
    const image = stage.toCanvas({ x: 0, y: 0, width: 1920, height: 1080, pixelRatio });
    return await new Promise<Blob>((resolve, reject) => image.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The scene snapshot could not be created. Analysis was not sent.')), 'image/png'));
  } finally { stage.destroy(); }
}
