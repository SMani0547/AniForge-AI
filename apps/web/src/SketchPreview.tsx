import { useEffect, useReducer, useRef, useState } from 'react';
import { Layer, Line, Rect, Stage } from 'react-konva';
import type Konva from 'konva';
import { Brush, Eraser, Pencil, Redo2, Trash2, Undo2 } from 'lucide-react';
import { emptySketch, sketchReducer, type SketchTool, type Stroke } from './sketch';

const tools = [{ id: 'pencil', name: 'Pencil', icon: Pencil }, { id: 'brush', name: 'Brush', icon: Brush }, { id: 'eraser', name: 'Eraser', icon: Eraser }] as const;
const colors = ['#e8edf7', '#75a7ff', '#bc9bff', '#ffbfa1', '#8cddc5'];

export function SketchPreview() {
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
  return <section className="sketch-area" aria-label="Local sketch preview">
    <div className="canvas-controls">
      <div className="tool-group" role="group" aria-label="Drawing tools">
        {tools.map(({ id, name, icon: Icon }) => <button key={id} className={`icon-button ${tool === id ? 'selected' : ''}`} type="button" title={name} aria-label={name} aria-pressed={tool === id} onClick={() => setTool(id)}><Icon size={18} /></button>)}
      </div>
      <span className="toolbar-divider" />
      <div className="swatches" role="group" aria-label="Stroke color">
        {colors.map((item, index) => <button type="button" key={item} className={`swatch ${color === item ? 'selected' : ''}`} style={{ backgroundColor: item }} aria-label={`Use ${['white', 'blue', 'purple', 'peach', 'mint'][index]} stroke`} aria-pressed={color === item} onClick={() => setColor(item)} />)}
      </div>
      <div className="history-tools">
        <button type="button" className="icon-button" aria-label="Undo" title="Undo (Ctrl/⌘ Z)" disabled={!history.past.length} onClick={() => dispatch({ type: 'undo' })}><Undo2 size={17} /></button>
        <button type="button" className="icon-button" aria-label="Redo" title="Redo (Ctrl/⌘ Shift Z)" disabled={!history.future.length} onClick={() => dispatch({ type: 'redo' })}><Redo2 size={17} /></button>
        <button type="button" className="icon-button" aria-label="Clear sketch" disabled={!history.present.length} title="Clear sketch (can be undone)" onClick={() => dispatch({ type: 'commit', strokes: [] })}><Trash2 size={17} /></button>
      </div>
    </div>
    <div className="canvas-workspace">
      <div className="canvas-label"><span>UNTITLED SKETCH</span><span>1920 × 1080</span></div>
      <div className="canvas-frame" ref={frame} role="img" aria-label={`Drawing canvas with ${history.present.length} strokes. Use a pointer to draw. Changes are not saved.`} data-testid="sketch-canvas">
        <Stage ref={stage} width={width} height={width * 9 / 16} scaleX={scale} scaleY={scale} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerLeave={finish}>
          <Layer listening={false}><Rect width={1920} height={1080} fill="#121c2e" /></Layer>
          <Layer listening={false}>{strokes.map((stroke, index) => <Line key={index} points={stroke.points} stroke={stroke.color} strokeWidth={stroke.width} tension={0.25} lineCap="round" lineJoin="round" globalCompositeOperation={stroke.tool === 'eraser' ? 'destination-out' : 'source-over'} />)}</Layer>
        </Stage>
        {!strokes.length && <div className="canvas-empty"><span className="canvas-cross">+</span><Pencil size={25} /><strong>A little sketch. A new beginning.</strong><span>Choose a color and draw something original.</span><span className="canvas-cross bottom">+</span></div>}
      </div>
      <div className="canvas-footer"><span>{history.present.length} {history.present.length === 1 ? 'stroke' : 'strokes'}</span><span>16:9 <span aria-hidden="true">·</span> Local preview <span aria-hidden="true">·</span> Not saved</span></div>
    </div>
    <p className="canvas-note">Try the drawing tools here. This preview is temporary and clears when you leave or refresh. Saving editable scenes is the next milestone.</p>
  </section>;
}
