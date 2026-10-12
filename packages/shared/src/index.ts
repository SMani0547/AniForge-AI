import { z } from 'zod';

export const resourceIdSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const boundedText = z.string().trim().min(1).max(4000);

export const shotPlanSchema = z.strictObject({
  sceneSummary: boundedText,
  subjects: z.array(z.strictObject({ name: z.string().min(1).max(200), appearance: boundedText })).min(1).max(20),
  action: boundedText,
  camera: z.strictObject({ shotType: z.string().min(1).max(200), movement: z.string().min(1).max(1000) }),
  environment: boundedText,
  mood: z.string().min(1).max(500),
  animationPrompt: z.string().min(1).max(8000),
  preserve: z.array(z.string().min(1).max(500)).max(30),
  uncertainties: z.array(z.string().min(1).max(500)).max(30),
});
export type ShotPlan = z.infer<typeof shotPlanSchema>;

const objectBase = z.strictObject({
  id: resourceIdSchema,
  x: z.number().finite().min(-10000).max(10000),
  y: z.number().finite().min(-10000).max(10000),
  width: z.number().positive().max(10000),
  height: z.number().positive().max(10000),
  rotation: z.number().finite().min(-360).max(360),
  opacity: z.number().min(0).max(1),
  locked: z.boolean(), hidden: z.boolean(),
  zIndex: z.number().int().min(0).max(500),
  fill: color,
  stroke: color,
  strokeWidth: z.number().min(0).max(200),
});
const points = z.array(z.number().finite().min(-10000).max(10000)).min(4).max(20000).refine((value) => value.length % 2 === 0, 'Coordinates must be x/y pairs');
export const canvasObjectSchema = z.discriminatedUnion('type', [
  objectBase.extend({ type: z.literal('rect') }),
  objectBase.extend({ type: z.literal('ellipse') }),
  objectBase.extend({ type: z.literal('line'), points }),
  objectBase.extend({ type: z.literal('brushStroke'), points, tool: z.enum(['brush', 'eraser']) }),
  objectBase.extend({ type: z.literal('text'), text: z.string().max(2000), fontSize: z.number().positive().max(500) }),
  objectBase.extend({ type: z.literal('image'), assetId: resourceIdSchema, crop: z.strictObject({ x: z.number().nonnegative(), y: z.number().nonnegative(), width: z.number().positive(), height: z.number().positive() }).nullable() }),
]);
export type CanvasObject = z.infer<typeof canvasObjectSchema>;
export const canvasSchema = z.strictObject({
  width: z.literal(1920), height: z.literal(1080), background: color,
  objects: z.array(canvasObjectSchema).max(500).refine((objects) => new Set(objects.map((object) => object.id)).size === objects.length, 'Object IDs must be unique'),
});
export type Canvas = z.infer<typeof canvasSchema>;

export const timelineSchema = z.strictObject({
  trimStart: z.number().min(0).max(300), trimEnd: z.number().min(0).max(300),
  captions: z.array(z.strictObject({ id: resourceIdSchema, text: z.string().max(1000), start: z.number().nonnegative().max(300), end: z.number().nonnegative().max(300) }).refine((caption) => caption.end >= caption.start, 'Caption end must follow its start')).max(50),
}).refine((timeline) => timeline.trimEnd >= timeline.trimStart, 'Trim end must follow its start');
export const projectSchema = z.strictObject({
  id: resourceIdSchema, ownerId: z.string().min(1).max(128),
  title: z.string().trim().min(1).max(120), description: z.string().max(2000),
  aspectRatio: z.literal('16:9'), sceneOrder: z.array(resourceIdSchema).max(100),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), schemaVersion: z.literal(1),
});
export type Project = z.infer<typeof projectSchema>;
export const createProjectSchema = z.strictObject({ title: projectSchema.shape.title, description: projectSchema.shape.description.optional() });
export const updateProjectSchema = createProjectSchema.partial().refine((body) => Object.keys(body).length > 0, 'Provide at least one change');
export const sceneSchema = z.strictObject({
  id: resourceIdSchema, projectId: resourceIdSchema, title: projectSchema.shape.title,
  order: z.number().int().min(0).max(99), canvas: canvasSchema,
  sourceAssetIds: z.array(resourceIdSchema).max(100), shotPlan: shotPlanSchema.nullable(),
  selectedVideoVersionId: resourceIdSchema.nullable(), timeline: timelineSchema,
  updatedAt: z.iso.datetime(), schemaVersion: z.literal(1),
});
export type Scene = z.infer<typeof sceneSchema>;
export const updateSceneSchema = z.strictObject({ title: projectSchema.shape.title.optional(), canvas: canvasSchema.optional(), shotPlan: shotPlanSchema.nullable().optional(), timeline: timelineSchema.optional() }).refine((body) => Object.keys(body).length > 0, 'Provide at least one change');
export type ProjectUpdate = z.infer<typeof updateProjectSchema>;
export type SceneUpdate = z.infer<typeof updateSceneSchema>;
export function emptyScene(projectId: string, id: string, now: string): Scene {
  return sceneSchema.parse({ id, projectId, title: 'Scene 1', order: 0, canvas: { width: 1920, height: 1080, background: '#111827', objects: [] }, sourceAssetIds: [], shotPlan: null, selectedVideoVersionId: null, timeline: { trimStart: 0, trimEnd: 0, captions: [] }, updatedAt: now, schemaVersion: 1 });
}

export interface ApiEnvelope<T> { data: T | null; error: { code: string; message: string } | null; requestId: string }
