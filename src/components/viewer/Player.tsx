import { useEffect, useRef, useState } from "react";
import { imageUrl, type CatalogResponse, type FramesResponse, type MoverCandidate } from "../../lib/api.ts";
import { DETECTORS, FOV_LIMITS, type ViewState } from "../../lib/viewState.ts";
import Timeline from "./Timeline.tsx";
import styles from "./Player.module.css";

const FRAME_MS = 900;
const FOV_OPTIONS = [0.03, 0.06, 0.1, 0.2].filter((v) => v >= FOV_LIMITS.min && v <= FOV_LIMITS.max);

interface PlayerProps {
  view: ViewState;
  onChange: (patch: Partial<ViewState>) => void;
  frames: FramesResponse | null;
  loading: boolean;
  error: string | null;
  status: number | null;
  elapsedMs: number;
  differenceImage: string | null;
  catalog: CatalogResponse | null;
  catalogError: string | null;
  movers: MoverCandidate[];
  selectedMover: string | null;
}

function waitingMessage(elapsedMs: number): string {
  if (elapsedMs < 4000) return "Asking IRSA which SPHEREx images cover this position…";
  if (elapsedMs < 20000) return "Reading just the pixels we need, straight from the SPHEREx mirror on AWS…";
  if (elapsedMs < 60000) return "Masking bad pixels, removing the zodiacal light and aligning every frame…";
  return "Still reading frames. A new position can take two to three minutes the first time; after that it loads in under a second.";
}

export default function Player({
  view,
  onChange,
  frames,
  loading,
  error,
  status,
  elapsedMs,
  differenceImage,
  catalog,
  catalogError,
  movers,
  selectedMover,
}: PlayerProps) {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const stage = useRef<HTMLDivElement>(null);

  const passes = frames?.passes ?? [];
  const visible = passes.filter((p) => !view.hidden.includes(p.index));
  const blink = view.mode === "blink";
  const isPlaying = playing && blink && visible.length > 1 && !loading;
  const index = visible.length ? Math.min(current, visible.length - 1) : 0;
  const shown = visible[index];
  const measurements = frames?.measurement?.passes ?? [];
  const pair: [number, number] = view.pair ?? [visible[0]?.index ?? 1, visible.at(-1)?.index ?? 1];

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => setCurrent((i) => (i + 1) % visible.length), FRAME_MS);
    return () => window.clearInterval(timer);
  }, [isPlaying, visible.length]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!stage.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((p) => !p);
      } else if (event.key === "ArrowRight" && visible.length) {
        setPlaying(false);
        setCurrent((i) => (i + 1) % visible.length);
      } else if (event.key === "ArrowLeft" && visible.length) {
        setPlaying(false);
        setCurrent((i) => (i - 1 + visible.length) % visible.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible.length]);

  const grid = frames?.grid;
  const image = blink ? (shown ? imageUrl(shown.image) : null) : differenceImage ? imageUrl(differenceImage) : null;
  const detector = DETECTORS.find((d) => d.id === view.detector) ?? DETECTORS[1];

  function pick(event: React.MouseEvent<HTMLDivElement>) {
    if (!grid) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * grid.width_px - 0.5;
    const y = ((event.clientY - box.top) / box.height) * grid.height_px - 0.5;
    onChange({ pick: { x, y }, panel: "spectrum" });
  }

  function togglePass(passIndex: number) {
    const hidden = view.hidden.includes(passIndex)
      ? view.hidden.filter((i) => i !== passIndex)
      : [...view.hidden, passIndex];
    if (hidden.length >= passes.length) return;
    onChange({ hidden: hidden.sort((a, b) => a - b) });
  }

  const frameLabel = blink
    ? shown
      ? `Pass ${shown.index} · ${shown.start}${shown.start === shown.end ? "" : ` to ${shown.end}`} · ${shown.frames_used} frames`
      : "No pass selected"
    : `Pass ${pair[1]} − pass ${pair[0]}`;

  return (
    <section aria-label="Image player" className={styles.player}>
      <div className={styles.toolbar}>
        <div role="group" aria-label="View mode" className={styles.segmented}>
          <button type="button" aria-pressed={blink} onClick={() => onChange({ mode: "blink" })}>
            Blink
          </button>
          <button
            type="button"
            aria-pressed={!blink}
            onClick={() => {
              setPlaying(false);
              onChange({ mode: "difference" });
            }}
          >
            Difference
          </button>
        </div>
        <div role="group" aria-label="Detector" className={styles.chips}>
          {DETECTORS.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`btn toggle mono ${styles.chip}`}
              aria-pressed={d.id === view.detector}
              title={`${d.id}: ${d.rangeMicron}`}
              onClick={() => onChange({ detector: d.id, pick: null })}
            >
              {d.id}
            </button>
          ))}
        </div>
        <label className={`mono ${styles.fov}`}>
          FOV
          <select
            value={view.fovDeg}
            onChange={(e) => onChange({ fovDeg: Number(e.target.value), pick: null })}
          >
            {FOV_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}°
              </option>
            ))}
          </select>
          <span>· {detector.rangeMicron}</span>
        </label>
      </div>

      <div className={styles.stage} ref={stage}>
        <div
          className={styles.frame}
          data-loading={loading}
          onClick={image ? pick : undefined}
          role={image ? "button" : "img"}
          tabIndex={image ? 0 : -1}
          aria-label={image ? `${frameLabel}. Click a source to read its spectrum.` : frameLabel}
        >
          {image ? (
            <>
              <img src={image} alt="" className={styles.sky} draggable={false} />
              {grid && view.overlay ? (
                <svg
                  className={styles.overlay}
                  viewBox={`0 0 ${grid.width_px} ${grid.height_px}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {view.gaia && shown ? renderCatalog(catalog, shown.index) : null}
                  {blink && shown?.predicted_px ? (
                    <g stroke="var(--predicted)" strokeWidth={0.08} opacity={0.95}>
                      <line
                        x1={shown.predicted_px[0] + 0.5 - 1.6}
                        y1={shown.predicted_px[1] + 0.5}
                        x2={shown.predicted_px[0] + 0.5 - 0.6}
                        y2={shown.predicted_px[1] + 0.5}
                      />
                      <line
                        x1={shown.predicted_px[0] + 0.5 + 0.6}
                        y1={shown.predicted_px[1] + 0.5}
                        x2={shown.predicted_px[0] + 0.5 + 1.6}
                        y2={shown.predicted_px[1] + 0.5}
                      />
                      <line
                        x1={shown.predicted_px[0] + 0.5}
                        y1={shown.predicted_px[1] + 0.5 - 1.6}
                        x2={shown.predicted_px[0] + 0.5}
                        y2={shown.predicted_px[1] + 0.5 - 0.6}
                      />
                      <line
                        x1={shown.predicted_px[0] + 0.5}
                        y1={shown.predicted_px[1] + 0.5 + 0.6}
                        x2={shown.predicted_px[0] + 0.5}
                        y2={shown.predicted_px[1] + 0.5 + 1.6}
                      />
                    </g>
                  ) : null}
                  {blink && shown ? renderMeasured(measurements, shown.index) : null}
                  {!blink ? renderTrack(measurements, pair) : null}
                  {movers.length ? renderMovers(movers, selectedMover) : null}
                  {view.pick ? (
                    <circle
                      cx={view.pick.x + 0.5}
                      cy={view.pick.y + 0.5}
                      r={1.6}
                      fill="none"
                      stroke="var(--text)"
                      strokeWidth={0.07}
                      strokeDasharray="0.4 0.3"
                    />
                  ) : null}
                </svg>
              ) : null}
              <span className={`mono ${styles.frameLabel}`}>{frameLabel}</span>
              <span className={`mono ${styles.compass}`} aria-hidden="true">
                N ↑ E ←
              </span>
              <span className={`mono ${styles.scale}`} aria-hidden="true">
                {grid ? `${(grid.fov_deg * 60).toFixed(1)}′ across · ${grid.pixel_arcsec}″ per pixel` : ""}
              </span>
              {loading ? <span className={styles.working}>Updating…</span> : null}
            </>
          ) : (
            <span className={styles.empty}>
              {error ? describeError(error, status) : loading ? waitingMessage(elapsedMs) : "Pick a target to begin."}
              {loading ? <span className={`mono ${styles.clock}`}>{Math.round(elapsedMs / 1000)}s</span> : null}
            </span>
          )}
        </div>
        <div className={styles.legend}>
          {blink ? (
            <>
              <span className={styles.legendItem}>
                <span className={styles.crossMark} aria-hidden="true" />
                Predicted from catalog motion
              </span>
              <span className={styles.legendItem}>
                <span className={styles.ringMark} aria-hidden="true" />
                Measured in this pass
              </span>
              {view.gaia ? (
                <span className={styles.legendItem}>
                  <span className={styles.gaiaMark} aria-hidden="true" />
                  {catalogError
                    ? `Gaia overlay unavailable: ${catalogError}`
                    : `${catalog?.sources.length ?? 0} Gaia DR3 sources brighter than G ${catalog?.limit_mag ?? ""}, propagated to this pass`}
                </span>
              ) : null}
              <span>
                Each frame is the median of one detector's exposures in a pass, aligned onto a common grid. Click a
                source to read its spectrum.
              </span>
            </>
          ) : (
            <>
              <span className={styles.legendItem}>
                <span className={styles.swatch} style={{ background: "var(--predicted)" }} aria-hidden="true" />
                Brighter now: where a source arrived
              </span>
              <span className={styles.legendItem}>
                <span className={styles.swatch} style={{ background: "var(--accent)" }} aria-hidden="true" />
                Fainter now: where it left
              </span>
              <span>Sources that did not move cancel out; a two-colour pair means motion.</span>
              {passes.length > 2 ? (
                <label className={`mono ${styles.pairPick}`}>
                  Compare
                  <select
                    value={pair.join("-")}
                    onChange={(e) => onChange({ pair: e.target.value.split("-").map(Number) as [number, number] })}
                  >
                    {passes.flatMap((a) =>
                      passes.filter((b) => b.index > a.index).map((b) => (
                        <option key={`${a.index}-${b.index}`} value={`${a.index}-${b.index}`}>
                          pass {b.index} − pass {a.index}
                        </option>
                      )),
                    )}
                  </select>
                </label>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.play}
          aria-label={isPlaying ? "Pause" : "Play"}
          disabled={!passes.length}
          onClick={() => {
            if (!blink) onChange({ mode: "blink" });
            setPlaying(!isPlaying);
          }}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 2V14M12 2V14" stroke="currentColor" strokeWidth="2.5" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 2L14 8L4 14Z" fill="currentColor" />
            </svg>
          )}
        </button>
        {passes.map((p) => {
          const hidden = view.hidden.includes(p.index);
          const active = blink && !hidden && shown?.index === p.index;
          return (
            <span key={p.index} className={styles.passControl}>
              <button
                type="button"
                className="btn toggle mono"
                aria-pressed={active}
                disabled={hidden}
                title={`${p.start} to ${p.end}, ${p.frames_used} frames`}
                onClick={() => {
                  setPlaying(false);
                  setCurrent(visible.findIndex((v) => v.index === p.index));
                  if (!blink) onChange({ mode: "blink" });
                }}
              >
                Pass {p.index}
              </button>
              <button
                type="button"
                className={styles.epochToggle}
                aria-label={hidden ? `Put pass ${p.index} back in the blink` : `Leave pass ${p.index} out of the blink`}
                title={hidden ? "Put this pass back in the blink" : "Leave this pass out of the blink"}
                onClick={() => togglePass(p.index)}
              >
                {hidden ? "+" : "−"}
              </button>
            </span>
          );
        })}
        <div className={styles.toggles}>
          <label className="mono">
            <input type="checkbox" checked={view.overlay} onChange={(e) => onChange({ overlay: e.target.checked })} />
            Overlays
          </label>
          <label className="mono" title="Gaia DR3 sources, propagated to each pass date">
            <input type="checkbox" checked={view.gaia} onChange={(e) => onChange({ gaia: e.target.checked })} />
            Gaia DR3
          </label>
        </div>
      </div>

      {passes.length > 1 ? (
        <p className={styles.passHint}>
          Click a pass to hold it, or <span className="mono">−</span> to leave it out of the blink.
        </p>
      ) : null}

      <Timeline passes={passes} hidden={view.hidden} current={blink ? (shown?.index ?? null) : null} />
    </section>
  );
}

function renderMovers(candidates: MoverCandidate[], selected: string | null) {
  return (
    <g>
      {candidates.map((candidate) => {
        const id = `${candidate.ra.toFixed(5)},${candidate.dec.toFixed(5)}`;
        const points = Object.values(candidate.track_px);
        if (points.length < 2) return null;
        const active = selected === id;
        const colour = candidate.label === "unexplained" ? "var(--accent)" : "var(--measured)";
        return (
          <g key={id} opacity={selected && !active ? 0.35 : 1}>
            <polyline
              points={points.map((p) => `${p[0] + 0.5},${p[1] + 0.5}`).join(" ")}
              fill="none"
              stroke={colour}
              strokeWidth={0.1}
              strokeDasharray={candidate.label === "known" ? "0.5 0.4" : undefined}
            />
            <circle
              cx={points[0][0] + 0.5}
              cy={points[0][1] + 0.5}
              r={active ? 2.6 : 1.8}
              fill="none"
              stroke={colour}
              strokeWidth={0.1}
            />
          </g>
        );
      })}
    </g>
  );
}

function renderCatalog(catalog: CatalogResponse | null, passIndex: number) {
  if (!catalog) return null;
  return (
    <g>
      {catalog.sources.map((source) => {
        const place = source.positions[String(passIndex)];
        if (!place) return null;
        const fast = source.pm_total_arcsec_per_year >= 0.5;
        return (
          <circle
            key={source.source_id}
            cx={place[0] + 0.5}
            cy={place[1] + 0.5}
            r={source.is_target ? 2.6 : 1.3}
            fill="none"
            stroke={fast ? "var(--measured)" : "var(--text-quiet)"}
            strokeWidth={0.07}
            strokeDasharray={source.is_target ? undefined : "0.35 0.3"}
          />
        );
      })}
    </g>
  );
}

function renderMeasured(measurements: { index: number; measured_px: [number, number] | null }[], passIndex: number) {
  const found = measurements.find((m) => m.index === passIndex);
  if (!found?.measured_px) return null;
  return (
    <circle
      cx={found.measured_px[0] + 0.5}
      cy={found.measured_px[1] + 0.5}
      r={1.9}
      fill="none"
      stroke="var(--accent)"
      strokeWidth={0.1}
    />
  );
}

function renderTrack(
  measurements: { index: number; measured_px: [number, number] | null }[],
  pair: [number, number],
) {
  const a = measurements.find((m) => m.index === pair[0])?.measured_px;
  const b = measurements.find((m) => m.index === pair[1])?.measured_px;
  if (!a || !b) return null;
  return (
    <g>
      <defs>
        <marker id="qh-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0,1 L8,5 L0,9 z" fill="var(--measured)" />
        </marker>
      </defs>
      <circle cx={a[0] + 0.5} cy={a[1] + 0.5} r={1.9} fill="none" stroke="var(--accent)" strokeWidth={0.1} />
      <circle cx={b[0] + 0.5} cy={b[1] + 0.5} r={1.9} fill="none" stroke="var(--predicted)" strokeWidth={0.1} />
      <line
        x1={a[0] + 0.5}
        y1={a[1] + 0.5}
        x2={b[0] + 0.5}
        y2={b[1] + 0.5}
        stroke="var(--measured)"
        strokeWidth={0.12}
        markerEnd="url(#qh-arrow)"
      />
    </g>
  );
}

function describeError(error: string, status: number | null): string {
  if (status === 404) return error;
  if (status === 503) return `${error} The archive is answering slowly or is down; cached targets still work.`;
  if (status === null)
    return "The measurement server could not be reached. It may be starting up; try again in a few seconds.";
  return `Could not load this view. ${error}`;
}
