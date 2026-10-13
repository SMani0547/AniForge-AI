import { useEffect, useReducer, useRef, useState } from 'react';
import { Layer, Line, Rect, Stage } from 'react-konva';
import type Konva from 'konva';
import { ArrowLeft, ArrowUpRight, Brush, Eraser, Layers3, Pencil, Redo2, Sparkles, Trash2, Undo2, WandSparkles } from 'lucide-react';
import { emptySketch, sketchReducer, type SketchTool, type Stroke } from './sketch';
import { setNavigationGuard } from './navigationGuard';
import { Badge, Button, IconButton } from './ui/Primitives';
import './playground.css';

const tools = [{ id: 'pencil', name: 'Pencil', icon: Pencil }, { id: 'brush', name: 'Brush', icon: Brush }, { id: 'eraser', name: 'Eraser', icon: Eraser }] as const;
const colors = ['#e8edf7', '#75a7ff', '#bc9bff', '#ffbfa1', '#8cddc5'];

export function SketchPreview({ onBack }: { onBack: () => void }) {
  const [history, dispatch] = useReducer(sketchReducer, emptySketch);
  const [tool, setTool] = useState<SketchTool>('pencil');
  const [color, setColor] = useState(colors[0]);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [width, setWidth] = useState(800);
  const frame = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const drawing = useRef<Stroke | null>(null);
  const scale = width / 1920;

  useEffect(() => {
    const dirty = history.present.length > 0 || draft !== null;
    setNavigationGuard(() => !dirty || window.confirm('This playground drawing is not saved. Leave and discard it?'));
    function beforeUnload(event: BeforeUnloadEvent) { if (dirty) { event.preventDefault(); event.returnValue = ''; } }
    window.addEventListener('beforeunload', beforeUnload);
    return () => { setNavigationGuard(null); window.removeEventListener('beforeunload', beforeUnload); };
  }, [history.present, draft]);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(Math.max(1, entry.contentRect.width)); });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function start() {
    const point = stage.current?.getPointerPosition();
    if (!point) return;
    const stroke: Stroke = { tool, color, width: tool === 'pencil' ? 5 : tool === 'brush' ? 22 : 48, points: [point.x / scale, point.y / scale, point.x / scale + 0.1, point.y / scale + 0.1] };
    drawing.current = stroke;
    setDraft(stroke);
  }
  function move() {
    const point = stage.current?.getPointerPosition();
    if (!drawing.current || !point) return;
    const next = { ...drawing.current, points: [...drawing.current.points, point.x / scale, point.y / scale] };
    drawing.current = next;
    setDraft(next);
  }
  function finish() {
    if (!drawing.current) return;
    dispatch({ type: 'commit', strokes: [...history.present, drawing.current] });
    drawing.current = null;
    setDraft(null);
  }

  const strokes = draft ? [...history.present, draft] : history.present;
  return <section className="af-playground" aria-label="Local sketch preview">
    <header className="pg-heading">
      <div className="pg-title"><IconButton label="Back to projects" onClick={onBack}><ArrowLeft size={19} /></IconButton><div><p className="af-eyebrow">A space to experiment</p><h1>Sketch playground</h1></div></div>
      <div className="pg-heading-actions"><Badge tone="warning">Preview · not saved</Badge><Button variant="secondary" onClick={onBack}>Open projects<ArrowUpRight size={16} /></Button></div>
    </header>
    <div className="pg-workspace">
      <aside className="pg-tools" aria-label="Sketch tools">
        <div className="pg-panel-heading"><Pencil size={16} /><h2>Drawing tools</h2></div>
        <div className="pg-tool-list" role="group" aria-label="Drawing tools">
          {tools.map(({ id, name, icon: Icon }) => <button key={id} type="button" aria-pressed={tool === id} onClick={() => setTool(id)}><Icon size={18} /><span>{name}</span></button>)}
        </div>
        <div className="pg-palette"><h3>Stroke color</h3><div className="pg-swatches" role="group" aria-label="Stroke color">
          {colors.map((item, index) => <button type="button" key={item} aria-label={`Use ${['white', 'blue', 'purple', 'peach', 'mint'][index]} stroke`} aria-pressed={color === item} onClick={() => setColor(item)}><span style={{ backgroundColor: item }} /></button>)}
        </div><p>{tool === 'eraser' ? 'Erase strokes to reveal the canvas.' : 'Draw with a mouse, pen or touch.'}</p></div>
        <div className="pg-shortcuts"><h3>Quick shortcuts</h3><p><span>Undo</span><kbd>Ctrl / ⌘ Z</kbd></p><p><span>Redo</span><kbd>+ Shift</kbd></p></div>
      </aside>
      <div className="pg-canvas-panel">
        <div className="pg-canvas-toolbar"><span><Layers3 size={16} />Source canvas</span><div className="pg-history" role="group" aria-label="Drawing history">
          <IconButton label="Undo" disabled={!history.past.length} onClick={() => dispatch({ type: 'undo' })}><Undo2 size={17} /></IconButton>
          <IconButton label="Redo" disabled={!history.future.length} onClick={() => dispatch({ type: 'redo' })}><Redo2 size={17} /></IconButton>
          <IconButton label="Clear sketch" disabled={!history.present.length} onClick={() => dispatch({ type: 'commit', strokes: [] })}><Trash2 size={17} /></IconButton>
        </div></div>
        <div className="pg-canvas-workspace"><div className="pg-canvas-label"><span>Untitled sketch</span><span>1920 × 1080</span></div>
          <div className="pg-canvas-frame" ref={frame} role="img" aria-label={`Drawing canvas with ${history.present.length} strokes. Use a pointer to draw. Changes are not saved.`} data-testid="sketch-canvas">
            <Stage ref={stage} width={width} height={width * 9 / 16} scaleX={scale} scaleY={scale} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerLeave={finish} onPointerCancel={finish}>
              <Layer listening={false}><Rect width={1920} height={1080} fill="#191b20" /></Layer>
              <Layer listening={false}>{strokes.map((stroke, index) => <Line key={index} points={stroke.points} stroke={stroke.color} strokeWidth={stroke.width} tension={0.25} lineCap="round" lineJoin="round" globalCompositeOperation={stroke.tool === 'eraser' ? 'destination-out' : 'source-over'} />)}</Layer>
            </Stage>
            {!strokes.length && <div className="pg-canvas-empty"><Pencil size={26} /><strong>Every story starts with a line.</strong><span>Choose a color. Draw something original.</span></div>}
          </div>
          <div className="pg-canvas-footer"><span role="status">{history.present.length} {history.present.length === 1 ? 'stroke' : 'strokes'}</span><span>16:9 · Local preview</span></div>
        </div>
        <div className="pg-unsaved-note"><span className="pg-status-dot" aria-hidden="true" /><p>This sketch is temporary. Leaving or refreshing clears it. Open a project to start a separate, saveable scene.</p></div>
      </div>
      <aside className="pg-assistant" aria-label="Scene assistant">
        <div className="pg-panel-heading"><Sparkles size={16} /><h2>Scene assistant</h2></div>
        <div className="pg-assistant-body"><p className="af-eyebrow">Your next chapter</p><h3>From a first line<br />to a moving story.</h3><p>Explore the tools here. In a saved project, build your source and plan what happens next.</p>
          <ol className="pg-steps"><li><span>01</span><div><strong>Find your idea</strong><p>Sketch freely in this playground.</p></div></li><li><span>02</span><div><strong>Make it a project</strong><p>Start a saved scene with editable layers.</p></div></li><li><span>03</span><div><strong>Plan the movement</strong><p>Review an AI shot plan before generation.</p></div></li></ol>
          <div className="pg-ai-actions"><Button variant="secondary" disabled aria-describedby="ai-unavailable"><WandSparkles size={16} />Analyze scene</Button><Button disabled aria-describedby="ai-unavailable"><Sparkles size={16} />Generate animation</Button></div>
          <p id="ai-unavailable" className="pg-ai-note">AI generation is unavailable in this unsaved playground. No AI requests are sent from this canvas.</p>
        </div>
      </aside>
    </div>
  </section>;
}
