import { ArrowDown, ArrowRight, Pause, Pencil } from 'lucide-react';
import type { CSSProperties } from 'react';

function OrbitLight({ className }: { className: string }) {
  const curve = 'M 98 50 A 48 46 0 1 1 2 50 A 48 46 0 1 1 98 50';
  return <svg className={`af-orbit ${className}`} style={{ '--orbit-path': `path('${curve}')` } as CSSProperties} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path className="af-orbit-track" d={curve} vectorEffect="non-scaling-stroke" />
    {Array.from({ length: 12 }, (_, index) => <path key={index} className="af-orbit-light af-orbit-tail" d={curve} pathLength="100" style={{
      '--trail-length': `${22 - index * 1.8}px`,
      strokeWidth: .08 + index * .045,
      opacity: .06 + index * .014,
    } as CSSProperties} />)}
    <g className="af-orbit-embers">
      {Array.from({ length: 7 }, (_, index) => <path key={index} className="af-meteor-spark" d="M 0 0 L -.6 -.06 L -1.1 0 L -.5 .06 Z" fill="#ff343e" style={{
        '--spark-x': `${-1.8 - index * .75}px`, '--spark-y': `${(index % 2 ? -1 : 1) * (.3 + index * .16)}px`,
        '--spark-drift': `${index % 2 ? -.6 : .6}px`, '--spark-delay': `${index * -.23}s`, '--spark-duration': `${1.1 + index * .13}s`,
      } as CSSProperties} />)}
    </g>
  </svg>;
}

export function AnimeHero({ paused, onPause }: { paused: boolean; onPause: () => void }) {
  return <section className="af-anime-hero" aria-labelledby="home-title">
    <div className="af-hero-wordmark" aria-hidden="true"><img src="/brand/wordmark.webp" alt="" width="1118" height="150" fetchPriority="high" /></div>
    <div className="af-anime-copy">
      <p className="af-eyebrow">A studio for the worlds in your head</p>
      <h1 id="home-title">Your sketch.<br />Your story.<br /><span className="af-type-line">{Array.from('In motion.').map((letter, index) => <span className="af-type-letter" style={{ '--letter-delay': `${450 + index * 65}ms` } as CSSProperties} key={index}>{letter}</span>)}</span></h1>
      <p className="af-home-intro">From the first pencil line to the next scene.<br />Make something only you could imagine.</p>
      <div className="af-row"><a href="/projects" className="af-button af-button--primary">Open studio <ArrowRight size={18} /></a><a href="/studio/preview" className="af-home-text-link">Try drawing <Pencil size={17} /></a></div>
      <p className="af-home-small">No account needed for the unsaved playground.</p>
    </div>
    <div className="af-anime-stage">
      <OrbitLight className="af-orbit-one" /><OrbitLight className="af-orbit-two" /><OrbitLight className="af-orbit-three" />
      <img className="af-hero-character" src="/artwork/sky-artist.webp" width="850" height="1275" fetchPriority="high" alt="Original anime artist in vermilion jacket" />
      <div className="af-floating-frame af-frame-city" aria-hidden="true"><img src="/artwork/last-tram.webp" width="1200" height="675" alt="" /><span>01 / THE LAST TRAM</span></div>
      <div className="af-floating-frame af-frame-sketch" aria-hidden="true"><img src="/artwork/sky-artist.webp" width="850" height="1275" alt="" /><span>02 / CHARACTER STUDY</span></div>
      <span className="af-hero-coordinate" aria-hidden="true">CHARACTER 001<br />THE SKY ARTIST</span>
    </div>
    <div className="af-hero-bottom"><a href="#product">Explore the studio <ArrowDown size={14} /></a><span>Original promotional art · not an AniForge video</span><button type="button" aria-pressed={paused} onClick={onPause}><Pause size={13} />Pause motion</button></div>
  </section>;
}
