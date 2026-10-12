import { shotPlanSchema, type Canvas, type Scene, type ShotPlan, type Timeline } from '@aniforge/shared';
import { ApiError, errorMessage } from './api';
import { timelineIssue } from './timeline';

export type SaveState = { status: 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict'; dirty: boolean; revision: number; error: string };
export type SceneDocument = Pick<Scene, 'canvas' | 'shotPlan' | 'timeline' | 'selectedVideoVersionId'>;

/** Serializes revision-checked writes and retains changes made during an in-flight save. */
export class SceneSaver {
  private current: SceneDocument;
  private saved: string;
  private inFlight: Promise<void> | null = null;
  private videoDuration: number | null = null;
  private listeners = new Set<(state: SaveState) => void>();
  state: SaveState;
  constructor(scene: Scene, private readonly write: (revision: number, document: SceneDocument) => Promise<Scene>) {
    this.current = { canvas: scene.canvas, shotPlan: scene.shotPlan, timeline: scene.timeline, selectedVideoVersionId: scene.selectedVideoVersionId };
    this.saved = JSON.stringify(this.current);
    this.state = { status: 'saved', dirty: false, revision: scene.revision, error: '' };
  }
  subscribe(listener: (state: SaveState) => void) { this.listeners.add(listener); listener(this.state); return () => { this.listeners.delete(listener); }; }
  private update(patch: Partial<SaveState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((listener) => listener(this.state)); }
  get document(): SceneDocument { return this.current; }
  setCanvas(canvas: Canvas) { this.setDocument({ ...this.current, canvas }); }
  setShotPlan(shotPlan: ShotPlan | null) { this.setDocument({ ...this.current, shotPlan }); }
  setTimeline(timeline: Timeline) { this.setDocument({ ...this.current, timeline }); }
  setVideoDuration(duration: number | null) { this.videoDuration = duration; }
  setSelectedVideoVersion(selectedVideoVersionId: string) { this.setDocument({ ...this.current, selectedVideoVersionId }); }
  private setDocument(document: SceneDocument) {
    this.current = document;
    const dirty = JSON.stringify(document) !== this.saved;
    const status = this.state.status === 'conflict' || this.state.status === 'saving' ? this.state.status : dirty ? 'unsaved' : 'saved';
    this.update({ dirty, status, ...(status === 'unsaved' || status === 'saved' ? { error: '' } : {}) });
  }
  save(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (!this.state.dirty || this.state.status === 'conflict') return Promise.resolve();
    this.inFlight = this.flush().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
  private async flush() {
    this.update({ status: 'saving', error: '' });
    try {
      while (JSON.stringify(this.current) !== this.saved) {
        const submitted = this.current;
        if (submitted.shotPlan && !shotPlanSchema.safeParse(submitted.shotPlan).success) throw new Error('Complete the required shot plan fields before saving. Your draft is kept locally.');
        const invalidTimeline = timelineIssue(submitted.timeline, this.videoDuration);
        if (invalidTimeline) throw new Error(`${invalidTimeline} Your draft is kept locally.`);
        const result = await this.write(this.state.revision, submitted);
        this.saved = JSON.stringify(submitted);
        this.update({ revision: result.revision, dirty: JSON.stringify(this.current) !== this.saved });
      }
      this.update({ status: 'saved', dirty: false });
    } catch (error) {
      this.update({ status: error instanceof ApiError && error.status === 409 ? 'conflict' : 'error', dirty: true, error: errorMessage(error) });
    }
  }
}
