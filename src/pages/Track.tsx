import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Badge from "../components/Badge.tsx";
import { BLINKABLE_ASTEROIDS, trackLink } from "../data/asteroids.ts";
import { fetchTrack, type TrackResponse } from "../lib/api.ts";
import { useAsync } from "../lib/useAsync.ts";
import styles from "./Track.module.css";

const Body3D = lazy(() => import("../components/Body3D.tsx"));

const DETECTORS = ["D1", "D2", "D3", "D4", "D5", "D6"];
const STEP_MS = 650;

export default function Track() {
  const [params] = useSearchParams();
  const requested = params.get("body") ?? "Vesta";
  const body = BLINKABLE_ASTEROIDS.find((n) => n.toLowerCase() === requested.toLowerCase()) ?? requested;
  const detector = DETECTORS.includes(params.get("det") ?? "") ? (params.get("det") as string) : "D2";
  const track = useAsync<TrackResponse>((signal) => fetchTrack(body, detector, signal), `${body}|${detector}`);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setTick((t) => t + 1), STEP_MS);
    return () => window.clearInterval(timer);
  }, [playing]);

  const frames = track.data?.frames ?? [];
  const index = frames.length ? (held ?? tick) % frames.length : 0;
  const frame = frames[index];
  const m = track.data?.measurement;

  return (
    <main className={`container ${styles.page}`}>
      <nav aria-label="Blink another asteroid" className={styles.another}>
        <Link to="/" className={styles.back}>
          ← Home
        </Link>
        <span className={styles.anotherLabel}>Asteroids</span>
        <div className={styles.chips}>
          {BLINKABLE_ASTEROIDS.map((name) => (
            <Link key={name} to={trackLink(name, detector)} className={styles.chip} aria-current={name === body ? "page" : undefined}>
              {name}
            </Link>
          ))}
        </div>
        <Link to="/explore?view=solar" className={styles.explore}>
          Solar System in 3D →
        </Link>
      </nav>

      <div className={styles.titleRow}>
        <div className={styles.model}>
          <Suspense fallback={null}>
            <Body3D kind="asteroid" id={body} className={styles.modelStage} caption={false} />
          </Suspense>
        </div>
        <div>
          <h1>{body}</h1>
          <p className={styles.sub}>
            Every SPHEREx exposure that caught it, each centred on where NASA/JPL's orbit puts it at that moment. The asteroid
            holds still; the stars stream past.
          </p>
        </div>
      </div>

      <div className={styles.detectors} role="group" aria-label="Detector">
        {DETECTORS.map((d) => (
          <Link key={d} to={trackLink(body, d)} className={styles.detector} aria-current={d === detector ? "true" : undefined} replace>
            {d}
          </Link>
        ))}
        <span className={styles.detectorHint}>D1 and D2 catch reflected sunlight best</span>
      </div>

      {track.loading && !track.data ? (
        <p className={`panel ${styles.state}`}>Reading {body}'s SPHEREx exposures from NASA's public archive on AWS…</p>
      ) : track.error ? (
        <p className={`panel ${styles.state}`}>{track.error}</p>
      ) : track.data && frame ? (
        <div className={styles.layout}>
          <section className={styles.player} aria-label="Asteroid blink">
            <div className={styles.frame}>
              <img src={frame.image} alt={`${body} on ${frame.date}, detector ${detector}`} className={styles.image} />
              <svg className={styles.overlay} viewBox="0 0 100 100" aria-hidden="true">
                <line x1="44" y1="50" x2="47.5" y2="50" stroke="#f2a541" strokeWidth="0.6" />
                <line x1="52.5" y1="50" x2="56" y2="50" stroke="#f2a541" strokeWidth="0.6" />
                <line x1="50" y1="44" x2="50" y2="47.5" stroke="#f2a541" strokeWidth="0.6" />
                <line x1="50" y1="52.5" x2="50" y2="56" stroke="#f2a541" strokeWidth="0.6" />
                {frame.measured_px ? (
                  <circle
                    cx={((frame.measured_px[0] + 0.5) / frame.size_px) * 100}
                    cy={(1 - (frame.measured_px[1] + 0.5) / frame.size_px) * 100}
                    r="4.5"
                    fill="none"
                    stroke="#5cc8ff"
                    strokeWidth="0.6"
                  />
                ) : null}
              </svg>
              <span className={`mono ${styles.stamp}`}>
                {frame.date} UTC · {index + 1}/{frames.length}
              </span>
              <span className={`mono ${styles.scale}`}>{(track.data.fov_deg * 60).toFixed(1)}′ across · N ↑ E ←</span>
            </div>
            <div className={styles.controls}>
              <button type="button" className="btn" onClick={() => setPlaying((p) => !p)}>
                {playing ? "Pause" : "Play"}
              </button>
              <div className={styles.strip}>
                {frames.map((f, i) => (
                  <button
                    key={f.mjd}
                    type="button"
                    className={styles.tick}
                    aria-pressed={i === index}
                    aria-label={`Hold frame ${i + 1}, ${f.date}`}
                    title={f.date}
                    data-found={f.measured_px ? "true" : "false"}
                    onClick={() => {
                      setHeld(held === i ? null : i);
                      setPlaying(held === i);
                    }}
                  />
                ))}
              </div>
            </div>
            <div className={styles.legend}>
              <span>
                <i className={styles.cross} /> JPL's predicted position
              </span>
              <span>
                <i className={styles.ring} /> Where SPHEREx saw it
              </span>
            </div>
          </section>

          <aside className={styles.side}>
            <div className={`panel ${styles.card}`}>
              <div className={styles.cardHead}>
                <span>Orbit check</span>
                {m ? <Badge confidence={m.label} /> : null}
              </div>
              {m && m.mean_offset_arcsec !== null ? (
                <strong className={`mono ${styles.big}`}>
                  {m.mean_offset_arcsec.toFixed(1)}
                  {m.sigma_arcsec !== null ? ` ± ${m.sigma_arcsec.toFixed(1)}` : ""}″
                </strong>
              ) : null}
              <p className={styles.summary}>{m?.summary}</p>
            </div>
            <dl className={`panel ${styles.facts}`}>
              <div>
                <dt>This frame</dt>
                <dd className="mono">{frame.date}</dd>
              </div>
              <div>
                <dt>Wavelength</dt>
                <dd className="mono">{frame.wavelength_um ? `${frame.wavelength_um.toFixed(2)} µm` : "—"}</dd>
              </div>
              <div>
                <dt>Predicted brightness</dt>
                <dd className={`mono ${styles.predicted}`}>{frame.vmag !== null ? `V ${frame.vmag.toFixed(1)}` : "—"}</dd>
              </div>
              <div>
                <dt>Offset from prediction</dt>
                <dd className={`mono ${styles.measured}`}>
                  {frame.offset_arcsec !== null ? `${frame.offset_arcsec.toFixed(1)}″ · S/N ${Math.round(frame.snr ?? 0)}` : "not detected"}
                  {frame.saturated ? " · saturated" : ""}
                </dd>
              </div>
              <div>
                <dt>SPHEREx exposures</dt>
                <dd className="mono">
                  {track.data.exposures_total} · {track.data.exposures_on_detector} on {detector}
                </dd>
              </div>
              <div>
                <dt>Spread over</dt>
                <dd className="mono">{Math.round(track.data.span_days)} days</dd>
              </div>
            </dl>
            <p className={styles.source}>{track.data.source}</p>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
