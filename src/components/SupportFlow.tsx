"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play, RotateCcw } from "@/components/ui/FlatIcon";

// Approved family direction: a full-width support hub, not operational telemetry.
// Customer chat, tickets and field work carry issue/evidence/resolution through
// the shared desk. No requests, auth state or prototype handlers live here.
const names = ["Customer chat", "Tickets", "Field work", "Support team", "Work orders", "Knowledge"];
const anchors = [[115, 95], [90, 225], [135, 355], [500, 95], [530, 225], [485, 355]];
const tags = ["Issue", "Evidence", "Resolution"];

export function SupportFlow() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reset, setReset] = useState(0);
  const select = (index: number) => setActive(index % 3);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    setPaused(media.matches);
    const changed = () => setPaused(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let width = 620, frame = 0, previous = 0, time = 0, drag: number | null = null;
    const nodes = anchors.map(([x, y]) => ({ x, y }));
    const endpoints = [...svg.querySelectorAll<SVGGElement>(".support-endpoint")];
    const paths = [...svg.querySelectorAll<SVGPathElement>(".support-spoke")];
    const packets = [...svg.querySelectorAll<SVGGElement>(".support-packet")];
    const draw = () => {
      const center = { x: width / 2, y: 225 };
      endpoints.forEach((node, i) => node.setAttribute("transform", `translate(${nodes[i].x},${nodes[i].y})`));
      paths.forEach((path, i) => path.setAttribute("d", `M${nodes[i].x} ${nodes[i].y} Q${(nodes[i].x + center.x) / 2} ${nodes[i].y} ${center.x} ${center.y}`));
      packets.forEach((packet, i) => {
        const progress = (time / 15000 + i / 3) % 1;
        const first = progress < .5;
        const t = first ? progress * 2 : (progress - .5) * 2;
        const endpoint = nodes[first ? active : active + 3];
        const from = first ? endpoint : center, to = first ? center : endpoint;
        const control = { x: (endpoint.x + center.x) / 2, y: endpoint.y };
        const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * control.x + t * t * to.x;
        const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * control.y + t * t * to.y;
        packet.setAttribute("transform", `translate(${x},${y})`);
      });
    };
    const tick = (stamp: number) => {
      time += previous ? Math.min(stamp - previous, 50) : 0;
      previous = stamp;
      draw();
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      if (!paused && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      const next = Math.max(620, svg.clientWidth);
      nodes.forEach(node => { node.x *= next / width; });
      width = next;
      svg.setAttribute("viewBox", `0 0 ${width} 455`);
      svg.querySelector(".support-center")?.setAttribute("transform", `translate(${width / 2},225)`);
      svg.querySelector(".support-desk")?.setAttribute("transform", `translate(${width / 2},225)`);
      draw();
    };
    const abort = new AbortController();
    endpoints.forEach((endpoint, index) => {
      const move = (x: number, y: number) => {
        nodes[index] = { x: Math.max(65, Math.min(width - 65, x)), y: Math.max(65, Math.min(355, y)) };
        draw();
      };
      endpoint.addEventListener("keydown", event => {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          move(nodes[index].x + (event.key === "ArrowRight" ? 8 : event.key === "ArrowLeft" ? -8 : 0), nodes[index].y + (event.key === "ArrowDown" ? 8 : event.key === "ArrowUp" ? -8 : 0));
        }
      }, { signal: abort.signal });
      endpoint.addEventListener("pointerdown", event => { drag = index; endpoint.setPointerCapture(event.pointerId); }, { signal: abort.signal });
      endpoint.addEventListener("pointermove", event => {
        if (drag !== index) return;
        const matrix = svg.getScreenCTM();
        if (!matrix) return;
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
        move(point.x, point.y);
      }, { signal: abort.signal });
      const release = () => { drag = null; };
      endpoint.addEventListener("pointerup", release, { signal: abort.signal });
      endpoint.addEventListener("pointercancel", release, { signal: abort.signal });
    });
    const observer = new ResizeObserver(resize);
    observer.observe(svg);
    document.addEventListener("visibilitychange", sync);
    resize(); sync();
    return () => { observer.disconnect(); abort.abort(); cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", sync); };
  }, [active, paused, reset]);

  return <section className="support-flow" aria-label="Illustrative support operations flow">
    <svg ref={svgRef} viewBox="0 0 620 455" className="support-flow-map" aria-label="Three support streams through one work desk" role="group">
      <g className="support-center" transform="translate(310,225)" aria-hidden="true">
        <circle r="165" className="support-orbit" /><circle r="95" className="support-orbit" />
      </g>
      {names.map((name, i) => <path key={name} className={`support-spoke ${i % 3 === active ? "active" : ""}`} d={`M${anchors[i][0]} ${anchors[i][1]} Q310 ${anchors[i][1]} 310 225`} />)}
      {names.map((name, i) => <g key={name} className={`support-endpoint ${i % 3 === active ? "active" : ""}`} transform={`translate(${anchors[i].join(",")})`} role="button" tabIndex={0} aria-label={`Trace ${name} flow`} aria-pressed={i % 3 === active} onFocus={() => select(i)} onPointerEnter={() => select(i)} onClick={() => select(i)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(i); } }}>
        <g aria-hidden="true">{Array.from({ length: 13 }, (_, j) => { const a = j * Math.PI * 2 / 13, r = 36 + (j % 3) * 10, x = Math.cos(a) * r, y = Math.sin(a) * r; return <g key={j}><path className="support-leaf-line" d={`M0 0 ${x} ${y}`} /><circle className="support-leaf" cx={x} cy={y} r={j % 4 === 0 ? 2 : 1.2} /></g>; })}
          <circle className="support-focus" r="27" /><circle className="support-hub" r="19" /><text textAnchor="middle" y="4" className="support-node-kind">{i < 3 ? "IN" : "OUT"}</text><text textAnchor="middle" y="75">{name}</text>
        </g>
      </g>)}
      <g aria-hidden="true" className="support-desk" transform="translate(310,225)"><circle r="43" /><text textAnchor="middle" y="6">sv<tspan>8</tspan></text></g>
      {tags.map((tag, i) => <g key={tag} className="support-packet" aria-hidden="true" transform={`translate(${115 + i * 155},${95 + i * 65})`}><rect x="-39" y="-11" width="78" height="22" rx="4" /><text textAnchor="middle" y="4">{tag}</text></g>)}
    </svg>
    <div className="support-flow-controls"><span>Illustrative support operations flow</span><div><button type="button" onClick={() => setReset(value => value + 1)} aria-label="Reset flow layout" title="Reset flow layout"><RotateCcw size={16} /></button><button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "Play flow" : "Pause flow"}</button></div></div>
    <p className="support-flow-route" aria-live="polite"><strong>{names[active]}</strong><ArrowRight size={16} /><span>supportv8</span><ArrowRight size={16} /><strong>{names[active + 3]}</strong></p>
    <div className="support-flow-paths" aria-label="Choose a support flow path">{names.slice(0, 3).map((name, i) => <button type="button" key={name} aria-pressed={active === i} onClick={() => select(i)}>{name}<ArrowRight size={16} />{names[i + 3]}</button>)}</div>
    <p className="support-flow-help">Focus or tap an endpoint to trace its path. Drag a circle, or use its arrow keys to move it.</p>
  </section>;
}
