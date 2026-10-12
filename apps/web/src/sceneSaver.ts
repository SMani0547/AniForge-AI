import type { Canvas, Scene } from '@aniforge/shared';
import { ApiError, errorMessage } from './api';

export type SaveState = { status: 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict'; dirty: boolean; revision: number; error: string };

/** Serializes revision-checked writes and retains changes made during an in-flight save. */
export class SceneSaver {
  private canvas: Canvas;
  private saved: string;
  private inFlight: Promise<void> | null = null;
  private listeners = new Set<(state: SaveState) => void>();
  state: SaveState;
  constructor(scene: Scene, private readonly write: (revision: number, canvas: Canvas) => Promise<Scene>) {
    this.canvas = scene.canvas;
    this.saved = JSON.stringify(scene.canvas);
    this.state = { status: 'saved', dirty: false, revision: scene.revision, error: '' };
  }
  subscribe(listener: (state: SaveState) => void) { this.listeners.add(listener); listener(this.state); return () => { this.listeners.delete(listener); }; }
  private update(patch: Partial<SaveState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((listener) => listener(this.state)); }
  setCanvas(canvas: Canvas) {
    this.canvas = canvas;
    const dirty = JSON.stringify(canvas) !== this.saved;
    const status = this.state.status === 'conflict' || this.state.status === 'saving' || this.state.status === 'error' ? this.state.status : dirty ? 'unsaved' : 'saved';
    this.update({ dirty, status });
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
      while (JSON.stringify(this.canvas) !== this.saved) {
        const submitted = this.canvas;
        const result = await this.write(this.state.revision, submitted);
        this.saved = JSON.stringify(submitted);
        this.update({ revision: result.revision, dirty: JSON.stringify(this.canvas) !== this.saved });
      }
      this.update({ status: 'saved', dirty: false });
    } catch (error) {
      this.update({ status: error instanceof ApiError && error.status === 409 ? 'conflict' : 'error', dirty: true, error: errorMessage(error) });
    }
  }
}
