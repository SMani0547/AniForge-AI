import { useEffect, useRef, useState } from 'react';
import { Ellipse, Group, Image as KonvaImage, Line, Rect, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { CanvasObject } from '@aniforge/shared';
import { errorMessage, type ProjectApi } from './api';
import { clamp, resizeObject } from './editor';

function PrivateImage({ object, api, projectId, onError }: { object: Extract<CanvasObject, { type: 'image' }>; api: ProjectApi; projectId: string; onError: (message: string) => void }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let active = true; let url: string | undefined;
    setImage(null);
    api.getAssetContent(projectId, object.assetId).then((blob) => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      const next = new window.Image();
      next.onload = () => { if (active) setImage(next); };
      next.onerror = () => { if (active) onError('A saved image could not be decoded. Reload images to try again.'); };
      next.src = url;
    }).catch((error: unknown) => { if (active) onError(errorMessage(error)); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [api, projectId, object.assetId, onError]);
  return image ? <KonvaImage image={image} width={object.width} height={object.height} crop={object.crop ?? undefined} /> : <><Rect width={object.width} height={object.height} fill="#24334b" stroke="#718cba" /><Text text="Loading private image" fill="#b7c8e9" padding={12} width={object.width} fontSize={24} /></>;
}

export function CanvasObjectView({ object, selected, interactive, onSelect, onChange, api, projectId, onImageError }: { object: CanvasObject; selected: boolean; interactive: boolean; onSelect: () => void; onChange: (object: CanvasObject) => void; api: ProjectApi; projectId: string; onImageError: (message: string) => void }) {
  const group = useRef<Konva.Group>(null);
  const transformer = useRef<Konva.Transformer>(null);
  useEffect(() => { if (selected && !object.locked && !object.hidden && interactive && group.current) { transformer.current?.nodes([group.current]); transformer.current?.getLayer()?.batchDraw(); } }, [selected, object, interactive]);
  if (object.hidden) return null;
  const shapeProps = { width: object.width, height: object.height, fill: object.fill, stroke: object.stroke, strokeWidth: object.strokeWidth };
  return <><Group ref={group} x={object.x} y={object.y} width={object.width} height={object.height} rotation={object.rotation} opacity={object.opacity} draggable={interactive && !object.locked} listening={interactive && !object.locked} onClick={onSelect} onTap={onSelect} onDragStart={onSelect} onDragEnd={(event) => onChange({ ...object, x: clamp(event.target.x(), -10000, 10000), y: clamp(event.target.y(), -10000, 10000) })} onTransformEnd={() => {
    const node = group.current; if (!node) return;
    const next = resizeObject(object, object.width * node.scaleX(), object.height * node.scaleY());
    node.scaleX(1); node.scaleY(1);
    onChange({ ...next, x: clamp(node.x(), -10000, 10000), y: clamp(node.y(), -10000, 10000), rotation: ((node.rotation() % 360) + 360) % 360 });
  }}>
    {object.type === 'rect' && <Rect {...shapeProps} />}
    {object.type === 'ellipse' && <Ellipse x={object.width / 2} y={object.height / 2} radiusX={object.width / 2} radiusY={object.height / 2} fill={object.fill} stroke={object.stroke} strokeWidth={object.strokeWidth} />}
    {(object.type === 'line' || object.type === 'brushStroke') && <Line points={object.points} stroke={object.stroke} strokeWidth={object.strokeWidth} lineCap="round" lineJoin="round" tension={object.type === 'brushStroke' ? 0.2 : 0} globalCompositeOperation={object.type === 'brushStroke' && object.tool === 'eraser' ? 'destination-out' : 'source-over'} />}
    {object.type === 'text' && <Text {...shapeProps} text={object.text} fontSize={object.fontSize} fontFamily="sans-serif" />}
    {object.type === 'image' && <PrivateImage object={object} api={api} projectId={projectId} onError={onImageError} />}
  </Group>{selected && interactive && !object.locked && <Transformer ref={transformer} flipEnabled={false} rotateEnabled boundBoxFunc={(oldBox, newBox) => Math.abs(newBox.width) < 2 || Math.abs(newBox.height) < 2 || newBox.width > 10000 || newBox.height > 10000 ? oldBox : newBox} />}</>;
}
