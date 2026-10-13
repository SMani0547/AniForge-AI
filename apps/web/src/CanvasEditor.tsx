import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Line, Rect, Stage } from 'react-konva';
import type Konva from 'konva';
import type { Canvas, CanvasObject, ImageCrop, Scene, ShotPlan } from '@aniforge/shared';
import { ArrowDown, ArrowLeft, ArrowUp, Film, Brush, Circle, Download, Eraser, Eye, EyeOff, Hand, ImagePlus, Lock, Minus, MousePointer2, Pencil, Redo2, Save, Square, Trash2, Type, Undo2, Unlock } from 'lucide-react';
import { errorMessage, type ProjectApi } from './api';
import { baseObject, clamp, createShape, editorHistory, editorReducer, layerName, patchObject, strokeObject, type EditorAction, type EditorTool } from './editor';
import { SceneSaver } from './sceneSaver';
import { CanvasObjectView } from './CanvasObjectView';
import { ImportDialog } from './ImportDialog';
import { ImageCropInspector } from './ImageCropInspector';
import { setNavigationGuard } from './navigationGuard';
import { AnalysisPanel } from './AnalysisPanel';
import { GenerationPanel } from './GenerationPanel';
import { renderCanonicalSnapshot } from './snapshot';
import './ui/tokens.css';
import './editor/workspace.css';

const drawingTools = [{ id: 'select', name: 'Select', icon: MousePointer2 }, { id: 'pencil', name: 'Pencil', icon: Pencil }, { id: 'brush', name: 'Brush', icon: Brush }, { id: 'eraser', name: 'Eraser', icon: Eraser }, { id: 'pan', name: 'Pan canvas', icon: Hand }] as const;
const shapeTools = [{ id: 'rect', name: 'Add rectangle', icon: Square }, { id: 'ellipse', name: 'Add ellipse', icon: Circle }, { id: 'line', name: 'Add line', icon: Minus }, { id: 'text', name: 'Add text', icon: Type }] as const;
type Draft = { id: string; points: number[]; color: string; width: number; eraser: boolean };
const numberFields = [{ field: 'x', label: 'X position', min: -10000, max: 10000 }, { field: 'y', label: 'Y position', min: -10000, max: 10000 }, { field: 'width', label: 'Width', min: 0.1, max: 10000 }, { field: 'height', label: 'Height', min: 0.1, max: 10000 }, { field: 'rotation', label: 'Rotation', min: -360, max: 360 }, { field: 'opacity', label: 'Opacity', min: 0, max: 1 }, { field: 'strokeWidth', label: 'Stroke width', min: 0, max: 200 }] as const;

export function CanvasEditor({ scene, api, onReload, projectTitle, onBack }: { scene: Scene; api: ProjectApi; onReload: () => Promise<void>; projectTitle: string; onBack: () => void }) {
  const [history, setHistory] = useState(() => editorHistory(scene.canvas));
  const historyRef = useRef(history);
  const saver = useMemo(() => new SceneSaver(scene, (revision, document) => api.saveScene(scene.projectId, scene.id, revision, document.canvas, document.shotPlan, document.timeline, document.selectedVideoVersionId)), [scene, api]);
  const [shotPlan, setShotPlan] = useState(scene.shotPlan);
  const [analysisNotice, setAnalysisNotice] = useState('');
  const [videoNotice, setVideoNotice] = useState('');
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [generationBusy, setGenerationBusy] = useState(false);
  const analysisBusyRef = useRef(false);
  const changeAnalysisBusy = useCallback((busy: boolean) => { analysisBusyRef.current = busy; setAnalysisBusy(busy); }, []);
  const changeGenerationBusy = useCallback((busy: boolean) => { setGenerationBusy(busy); changeAnalysisBusy(busy); }, [changeAnalysisBusy]);
  const changeShotPlan = useCallback((plan: ShotPlan | null) => { setShotPlan(plan); saver.setShotPlan(plan); }, [saver]);
  const [saveState, setSaveState] = useState(saver.state);
  // View changes hide panels, never remount the scene, saver or request owners.
  const [activeView, setActiveView] = useState<'source' | 'video'>('source');
  const [inspector, setInspector] = useState<'properties' | 'plan'>('properties');
  const [mobilePanel, setMobilePanel] = useState<'canvas' | 'tools' | 'inspector'>('canvas');
  const [videoExpanded, setVideoExpanded] = useState(false);
  const videoPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeView === 'source' && !videoExpanded) videoPanel.current?.querySelectorAll('video').forEach((video) => video.pause());
  }, [activeView, videoExpanded]);
  const [tool, setTool] = useState<EditorTool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [color, setColor] = useState('#75a7ff');
  const [strokeWidth, setStrokeWidth] = useState(8);
  const [draft, setDraft] = useState<Draft | null>(null);
  const drawing = useRef<Draft | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const importBusyRef = useRef(false);
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState('');
  const [imageRetry, setImageRetry] = useState(0);
  const [width, setWidth] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const frame = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const canvas = history.present;
  const selected = canvas.objects.find((object) => object.id === selectedId);
  const scale = width / 1920 * zoom;

  useEffect(() => saver.subscribe(setSaveState), [saver]);
  useEffect(() => {
    if (saveState.status !== 'saved' || saveState.dirty || !saver.document.canvas.objects.length) return;
    let active = true;
    const savedCanvas = saver.document.canvas;
    const timer = setTimeout(() => {
      void renderCanonicalSnapshot(savedCanvas, (id) => api.getAssetContent(scene.projectId, id), 0.25)
        .then(async (image) => { if (active) await api.saveThumbnail(scene.projectId, scene.id, saveState.revision, image); })
        .catch(() => { /* Optional preview failure never changes saved source or blocks editing. Gallery shows an explicit unavailable preview. */ });
    }, 700);
    return () => { active = false; clearTimeout(timer); };
  }, [api, saver, scene.id, scene.projectId, saveState.status, saveState.dirty, saveState.revision]);
  useEffect(() => {
    if (saveState.status !== 'unsaved') return;
    const timeout = setTimeout(() => { void saver.save(); }, 900);
    return () => clearTimeout(timeout);
  }, [canvas, shotPlan, saver, saveState.status]);
  useEffect(() => {
    const leave = () => (!saver.state.dirty && saver.state.status !== 'saving' && !importBusyRef.current && !analysisBusyRef.current) || window.confirm('Your scene has unsaved changes, an upload, or analysis in progress. Unsaved changes may be lost, and requests already sent may still finish or incur charges. Leave this scene?');
    setNavigationGuard(leave);
    function beforeUnload(event: BeforeUnloadEvent) { if (saver.state.dirty || saver.state.status === 'saving' || importBusyRef.current || analysisBusyRef.current) { event.preventDefault(); event.returnValue = ''; } }
    window.addEventListener('beforeunload', beforeUnload);
    return () => { setNavigationGuard(null); window.removeEventListener('beforeunload', beforeUnload); };
  }, [saver]);
  useEffect(() => {
    const element = frame.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry && entry.contentRect.width > 0) setWidth(entry.contentRect.width); });
    observer.observe(element); return () => observer.disconnect();
  }, []);

  const apply = useCallback((action: EditorAction) => {
    if (analysisBusyRef.current) return;
    try { const next = editorReducer(historyRef.current, action); historyRef.current = next; setHistory(next); saver.setCanvas(next.present); setError(''); }
    catch { setError('This change exceeds the scene limits (500 objects, 10,000 points per stroke). Undo or remove a layer before continuing.'); }
  }, [saver]);
  const commit = useCallback((next: Canvas) => apply({ type: 'commit', canvas: next }), [apply]);
  const changeObject = useCallback((object: CanvasObject) => commit(patchObject(historyRef.current.present, object.id, object)), [commit]);
  const deleteSelected = useCallback(() => {
    const current = historyRef.current.present;
    if (!selectedId || current.objects.find((object) => object.id === selectedId)?.locked) return;
    commit({ ...current, objects: current.objects.filter((object) => object.id !== selectedId) }); setSelectedId(null);
  }, [commit, selectedId]);

  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (analysisBusyRef.current || activeView !== 'source') return;
      if (document.querySelector('dialog[open]') || (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)))) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); apply({ type: event.shiftKey ? 'redo' : 'undo' }); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saver.save(); }
      else if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && ['v', 'p', 'b', 'e', 'h', 'f', 'Escape'].includes(event.key)) {
        event.preventDefault();
        const shortcuts: Record<string, EditorTool> = { v: 'select', p: 'pencil', b: 'brush', e: 'eraser', h: 'pan' };
        const nextTool = shortcuts[event.key];
        if (nextTool) setTool(nextTool);
        else if (event.key === 'f') { setZoom(1); setPan({ x: 0, y: 0 }); }
        else setSelectedId(null);
      }
      else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelected(); }
    }
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, [activeView, apply, deleteSelected, saver]);

  function addShape(type: 'rect' | 'ellipse' | 'line' | 'text') {
    const object = createShape(type, crypto.randomUUID(), canvas.objects.length, color);
    commit({ ...canvas, objects: [...canvas.objects, object] }); setSelectedId(object.id); setTool('select'); setInspector('properties');
  }
  function point() {
    const current = stage.current; const pointer = current?.getPointerPosition(); if (!current || !pointer) return null;
    const location = current.getAbsoluteTransform().copy().invert().point(pointer);
    return { x: clamp(location.x, 0, 1920), y: clamp(location.y, 0, 1080) };
  }
  function start(event: Konva.KonvaEventObject<PointerEvent>) {
    if (event.evt.button !== 0) return;
    if (tool === 'select') { if (event.target === stage.current) setSelectedId(null); return; }
    if (!['pencil', 'brush', 'eraser'].includes(tool)) return;
    const position = point(); if (!position || canvas.objects.length >= 500) return;
    const stroke = { id: crypto.randomUUID(), color, width: tool === 'eraser' ? Math.max(30, strokeWidth) : tool === 'brush' ? Math.max(16, strokeWidth) : strokeWidth, eraser: tool === 'eraser', points: [position.x, position.y, position.x + 0.01, position.y + 0.01] };
    drawing.current = stroke; setDraft(stroke); setSelectedId(null);
  }
  function move() {
    const position = point(); const current = drawing.current;
    if (!position || !current || current.points.length >= 20000) return;
    const next = { ...current, points: [...current.points, position.x, position.y] }; drawing.current = next; setDraft(next);
  }
  function finish() {
    const current = drawing.current; if (!current) return;
    const document = historyRef.current.present;
    commit({ ...document, objects: [...document.objects, strokeObject(current.id, document.objects.length, current.points, current.color, current.width, current.eraser)] });
    drawing.current = null; setDraft(null);
  }
  function patch(patch: Partial<CanvasObject>, allowLocked = false) { if (selected) commit(patchObject(canvas, selected.id, patch, allowLocked)); }
  function reorder(index: number, delta: number) {
    const objects = [...canvas.objects]; const target = index + delta;
    if (target < 0 || target >= objects.length || objects[index]?.locked) return;
    [objects[index], objects[target]] = [objects[target], objects[index]]; commit({ ...canvas, objects });
  }
  async function importImage(file: File, crop: ImageCrop, size: { width: number; height: number }) {
    importBusyRef.current = true; setImportBusy(true);
    try {
      const asset = await api.uploadAsset(scene.projectId, scene.id, file);
      const normalizedCrop = { x: crop.x / size.width * asset.width, y: crop.y / size.height * asset.height, width: crop.width / size.width * asset.width, height: crop.height / size.height * asset.height };
      const factor = Math.min(1, 1500 / normalizedCrop.width, 800 / normalizedCrop.height);
      const object: CanvasObject = { ...baseObject(crypto.randomUUID(), historyRef.current.present.objects.length, color), type: 'image', assetId: asset.id, crop: normalizedCrop, x: 100, y: 100, width: normalizedCrop.width * factor, height: normalizedCrop.height * factor, strokeWidth: 0 };
      const current = historyRef.current.present;
      commit({ ...current, objects: [...current.objects, object] }); setSelectedId(object.id); setTool('select');
    } finally { importBusyRef.current = false; setImportBusy(false); }
  }
  async function reload() {
    if (saver.state.dirty && !window.confirm('Discard your local drawing, shot plan, timeline and version selection changes and load the latest saved scene? Download your local scene first if you want to keep a copy.')) return;
    try { await onReload(); } catch (reason) { setError(errorMessage(reason)); }
  }
  function downloadCanvas() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ sceneId: scene.id, ...saver.document }, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${scene.id}-editable-canvas.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section data-view={activeView} className="saved-editor af-theme af-editor" aria-label="Saved scene editor">
    <div className="editor-savebar"><div className="workspace-project"><button type="button" className="icon-button" aria-label="Back to projects" title="Back to projects" onClick={onBack}><ArrowLeft size={18} /></button><div><h1>{projectTitle}</h1><span className="workspace-scenename">{scene.title} / Private scene</span></div></div><div><span role="status" className={`save-status ${saveState.status}`}>{saveState.status === 'saved' ? `Saved · revision ${saveState.revision}` : saveState.status === 'saving' ? 'Saving changes…' : saveState.status === 'conflict' ? 'Save conflict · local changes kept' : saveState.status === 'error' ? 'Save failed · changes unsaved' : 'Unsaved changes'}</span></div><button type="button" className="button primary compact" disabled={!saveState.dirty || saveState.status === 'saving' || saveState.status === 'conflict'} onClick={() => { void saver.save(); }}><Save size={16} />Save scene</button></div>
    {saveState.error && <div className="error-banner" role="alert"><p>{saveState.status === 'conflict' ? 'This scene changed in another tab or session. Your local canvas and shot plan are still here. Download them before reloading the saved scene.' : saveState.error}</p><div className="error-actions"><button type="button" className="button secondary compact" onClick={downloadCanvas}><Download size={15} />Download local scene</button><button type="button" className="button secondary compact" onClick={() => { void reload(); }}>Reload saved scene</button>{saveState.status === 'error' && <button type="button" className="button secondary compact" onClick={() => { void saver.save(); }}>Retry save</button>}</div></div>}
    {error && <div className="error-banner" role="alert">{error}</div>}
    {imageError && <div className="error-banner" role="alert">{imageError}<button type="button" className="text-button" onClick={() => { setImageError(''); setImageRetry((value) => value + 1); }}>Reload images</button></div>}
    <div className="workspace-viewbar">
      <div className="workspace-switch" role="group" aria-label="Editor view">{(['source', 'video'] as const).map((view) => <button type="button" key={view} aria-pressed={activeView === view} onClick={() => setActiveView(view)}>{view === 'source' ? <Pencil size={16} /> : <Film size={16} />}{view === 'source' ? 'Source' : 'Video'}</button>)}</div>
      <span className="workspace-hint">{activeView === 'source' ? 'Draw first. Bring it to life when ready.' : 'Separate video versions. Your source stays editable.'}</span>
      <details className="workspace-help" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary>Shortcuts & help</summary><div><p>V Select / P Pencil / B Brush / E Eraser / H Pan / F Fit / Esc Deselect</p><p>Ctrl or Cmd + Z Undo / Shift + Z Redo / S Save. Delete removes an unlocked selection.</p><p>Shortcuts pause in fields, dialogs and Video. Drag selection handles to resize or rotate. Eraser masks earlier layers; originals stay editable.</p></div></details>
    </div>
    {analysisBusy && <p className="workspace-activity" role="status">{generationBusy ? 'Preparing video request. Source editing is paused.' : 'Analysis in progress. Source editing is paused.'}<button type="button" className="text-button" onClick={() => { if (generationBusy) setActiveView('video'); else { setActiveView('source'); setInspector('plan'); setMobilePanel('inspector'); } }}>View request</button></p>}
    {analysisNotice && <p className="workspace-activity" role="status">{analysisNotice}<button type="button" className="text-button" onClick={() => { setActiveView('source'); setInspector('plan'); setMobilePanel('inspector'); }}>Review shot plan</button></p>}
    {videoNotice && <p className="workspace-activity" role="status">{videoNotice}<button type="button" className="text-button" onClick={() => setActiveView('video')}>View video status</button></p>}
    <div className="workspace-mobile-nav" hidden={activeView !== 'source'} role="group" aria-label="Source panels">{([{ id: 'canvas', label: 'Canvas' }, { id: 'tools', label: 'Tools & layers' }, { id: 'inspector', label: 'Inspector' }] as const).map(({ id, label }) => <button type="button" key={id} aria-pressed={mobilePanel === id} onClick={() => setMobilePanel(id)}>{label}</button>)}</div>
    <div className="workspace-source" hidden={activeView !== 'source'} data-panel={mobilePanel}>
      <aside className="workspace-tools" aria-label="Tools and layers" inert={analysisBusy}>
        <div className="workspace-toolbox"><h2>Tools</h2><div className="tool-group" role="group" aria-label="Drawing tools">{drawingTools.map(({ id, name, icon: Icon }) => <button type="button" key={id} className={`icon-button ${tool === id ? 'selected' : ''}`} aria-label={name} title={`${name} (${({ select: 'V', pencil: 'P', brush: 'B', eraser: 'E', pan: 'H' })[id]})`} aria-pressed={tool === id} onClick={() => setTool(id)}><Icon size={18} /><span>{name.replace('Add ', '').replace('Pan canvas', 'Pan')}</span></button>)}</div><h3>Add to scene</h3><div className="tool-group" role="group" aria-label="Insert objects">{shapeTools.map(({ id, name, icon: Icon }) => <button type="button" key={id} className="icon-button" aria-label={name} title={name} disabled={canvas.objects.length >= 500} onClick={() => addShape(id)}><Icon size={18} /><span>{name.replace('Add ', '').replace('Pan canvas', 'Pan')}</span></button>)}</div><button type="button" className="button secondary compact import-button" disabled={importBusy || canvas.objects.length >= 500} onClick={() => setImportOpen(true)}><ImagePlus size={16} />Import image</button></div>
        <section className="editor-layers"><h2>Layers <span className="count">{canvas.objects.length}</span></h2><p className="muted small">Top row draws in front.</p>{!canvas.objects.length && <p className="empty-layers">Draw, add a shape, or import your original artwork.</p>}<ol>{[...canvas.objects].reverse().map((object) => { const index = canvas.objects.findIndex((item) => item.id === object.id); const number = index + 1; return <li key={object.id} className={selectedId === object.id ? 'selected' : ''}><button type="button" className="layer-select" aria-label={`Select layer ${number}: ${layerName(object)}`} aria-pressed={selectedId === object.id} onClick={() => { setSelectedId(object.id); setTool('select'); }}><span className="layer-type">{object.type === 'image' ? 'IMG' : object.type === 'text' ? 'TXT' : String(number).padStart(2, '0')}</span><span>{layerName(object)}</span></button><span className="layer-state">{object.hidden ? 'Hidden' : 'Visible'}{object.locked ? ' / Locked' : ''}</span><div className="layer-actions"><button type="button" className="icon-button" aria-label={`${object.hidden ? 'Show' : 'Hide'} layer ${number}`} aria-pressed={object.hidden} onClick={() => commit(patchObject(canvas, object.id, { hidden: !object.hidden }, true))}>{object.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button><button type="button" className="icon-button" aria-label={`${object.locked ? 'Unlock' : 'Lock'} layer ${number}`} aria-pressed={object.locked} onClick={() => commit(patchObject(canvas, object.id, { locked: !object.locked }, true))}>{object.locked ? <Lock size={14} /> : <Unlock size={14} />}</button><button type="button" className="icon-button" aria-label={`Raise layer ${number}`} disabled={object.locked || index === canvas.objects.length - 1} onClick={() => reorder(index, 1)}><ArrowUp size={14} /></button><button type="button" className="icon-button" aria-label={`Lower layer ${number}`} disabled={object.locked || index === 0} onClick={() => reorder(index, -1)}><ArrowDown size={14} /></button></div></li>; })}</ol></section>
      </aside>
      <div className="workspace-canvas" inert={analysisBusy}>
        <div className="workspace-canvasbar"><div className="history-tools"><button type="button" className="icon-button" aria-label="Undo" title="Undo (Ctrl/Cmd Z)" disabled={!history.past.length} onClick={() => apply({ type: 'undo' })}><Undo2 size={18} /></button><button type="button" className="icon-button" aria-label="Redo" title="Redo (Ctrl/Cmd Shift Z)" disabled={!history.future.length} onClick={() => apply({ type: 'redo' })}><Redo2 size={18} /></button><button type="button" className="icon-button" aria-label="Delete selected layer" title="Delete selected layer" disabled={!selected || selected.locked} onClick={deleteSelected}><Trash2 size={18} /></button></div><div className="editor-options"><label>Zoom<select value={zoom} onChange={(event) => setZoom(Number(event.target.value))}><option value={0.5}>50%</option><option value={1}>100%</option><option value={1.5}>150%</option><option value={2}>200%</option></select></label><button type="button" className="text-button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Fit canvas</button></div></div>
        <div className="canvas-workspace"><div className="canvas-label"><span>EDITABLE SOURCE</span><span>1920 × 1080</span></div><div ref={frame} className={`canvas-frame saved-canvas tool-${tool}`} role="img" aria-label={`Editable scene canvas with ${canvas.objects.length} objects`} data-testid="scene-canvas"><Stage ref={stage} width={width} height={width * 9 / 16} scaleX={scale} scaleY={scale} x={pan.x} y={pan.y} draggable={tool === 'pan'} onDragEnd={(event) => { if (event.target === stage.current) setPan({ x: event.target.x(), y: event.target.y() }); }} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerLeave={finish} onPointerCancel={finish}>
      <Layer listening={false}><Rect width={1920} height={1080} fill={canvas.background} /></Layer>
      <Layer>{canvas.objects.map((object) => <CanvasObjectView key={`${object.id}-${imageRetry}`} object={object} selected={selectedId === object.id} interactive={tool === 'select'} onSelect={() => setSelectedId(object.id)} onChange={changeObject} api={api} projectId={scene.projectId} onImageError={setImageError} />)}{draft && <Line listening={false} points={draft.points} stroke={draft.color} strokeWidth={draft.width} lineCap="round" lineJoin="round" tension={0.2} globalCompositeOperation={draft.eraser ? 'destination-out' : 'source-over'} />}</Layer>
    </Stage></div><div className="canvas-footer"><span>{canvas.objects.length} editable {canvas.objects.length === 1 ? 'object' : 'objects'}</span><span>16:9 · Private scene</span></div></div>
        <div className="workspace-canvasnote"><span>{tool === 'pan' ? 'Drag to pan the view. Fit to reset.' : ['pencil', 'brush', 'eraser'].includes(tool) ? 'Drag on the canvas to draw. Adjust your mark in Properties.' : 'Select a layer to move, resize or rotate.'}</span><span>Autosave on</span></div>
      </div>
      <aside className="workspace-inspector" aria-label="Scene assistant">
        <div className="workspace-switch" role="group" aria-label="Inspector view"><button type="button" aria-pressed={inspector === 'properties'} onClick={() => setInspector('properties')}>Properties</button><button type="button" aria-pressed={inspector === 'plan'} onClick={() => setInspector('plan')}>Shot plan</button></div>
        <div className="workspace-inspectorbody">
          <div hidden={inspector !== 'properties'} inert={analysisBusy}>
            <section className="workspace-drawing" hidden={!['pencil', 'brush', 'eraser'].includes(tool)}><h2>{tool === 'eraser' ? 'Eraser' : 'Drawing'} properties</h2><div className="editor-options"><label>Drawing color<input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label><label>Drawing size<input type="number" min={1} max={200} value={strokeWidth} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) setStrokeWidth(clamp(event.target.valueAsNumber, 1, 200)); }} /></label></div></section>
            <section className="editor-inspector"><h2>Scene & selection</h2><label className="editor-background">Scene background<input type="color" value={canvas.background} onChange={(event) => commit({ ...canvas, background: event.target.value })} /></label>{selected ? <><p className="muted small">{layerName(selected)}{selected.locked ? ' · Locked' : ''}</p><fieldset disabled={selected.locked}><legend className="sr-only">Selected object properties</legend><div className="property-grid">{numberFields.filter(({ field }) => selected.type !== 'image' || field !== 'strokeWidth').map(({ field, label, min, max }) => <label key={field}>{label}<input type="number" min={min} max={max} step={field === 'opacity' ? 0.05 : 1} value={Math.round(selected[field] * 100) / 100} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) patch({ [field]: clamp(event.target.valueAsNumber, min, max) }); }} /></label>)}{['rect', 'ellipse', 'text'].includes(selected.type) && <label>Fill color<input type="color" value={selected.fill} onChange={(event) => patch({ fill: event.target.value })} /></label>}{selected.type !== 'image' && <label>Stroke color<input type="color" value={selected.stroke} onChange={(event) => patch({ stroke: event.target.value })} /></label>}{selected.type === 'text' && <><label className="property-wide">Text content<textarea maxLength={2000} value={selected.text} onChange={(event) => patch({ text: event.target.value })} /></label><label>Font size<input type="number" min={1} max={500} value={selected.fontSize} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) patch({ fontSize: clamp(event.target.valueAsNumber, 1, 500) }); }} /></label></>}</div></fieldset>{selected.type === 'image' && <ImageCropInspector object={selected} api={api} projectId={scene.projectId} onChange={(crop) => patch({ crop })} />}</> : <p className="muted small">Select a layer to edit its position, size, and appearance.</p>}</section>
          </div>
          <div hidden={inspector !== 'plan'} inert={generationBusy}><AnalysisPanel onNotice={setAnalysisNotice} scene={scene} api={api} saver={saver} plan={shotPlan} onPlanChange={changeShotPlan} onBusyChange={changeAnalysisBusy} importBusy={importBusy} /></div>
        </div>
      </aside>
    </div>
    <div className="workspace-videoheading"><div><h2>Video & timeline</h2><p>Generate from a saved source and reviewed shot plan. Drawing is always available.</p></div><button type="button" className="button secondary compact" aria-expanded={activeView === 'video' || videoExpanded} aria-controls="scene-video-panel" onClick={() => { if (activeView === 'video') { setActiveView('source'); setVideoExpanded(false); } else setVideoExpanded(!videoExpanded); }}>{activeView === 'video' || videoExpanded ? 'Hide video panel' : 'Show video panel'}</button></div>
    <div id="scene-video-panel" ref={videoPanel} hidden={activeView !== 'video' && !videoExpanded}><GenerationPanel visible={activeView === 'video' || videoExpanded} onOpenSource={() => { setActiveView('source'); setVideoExpanded(false); setMobilePanel('canvas'); }} onOpenPlan={() => { setActiveView('source'); setVideoExpanded(false); setInspector('plan'); setMobilePanel('inspector'); }} onNotice={setVideoNotice} scene={scene} api={api} saver={saver} plan={shotPlan} onBusyChange={changeGenerationBusy} blocked={importBusy || analysisBusy} /></div>
    {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onImport={importImage} />}
  </section>;
}
