import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import FindingsPanel from "../components/viewer/FindingsPanel.tsx";
import LightCurve from "../components/viewer/LightCurve.tsx";
import Movers from "../components/viewer/Movers.tsx";
import Player from "../components/viewer/Player.tsx";
import ShareButtons from "../components/viewer/ShareButtons.tsx";
import SkyMap from "../components/SkyMap.tsx";
import Spectrum from "../components/viewer/Spectrum.tsx";
import {
  fetchCatalog,
  fetchDifference,
  fetchMovers,
  fetchFrames,
  fetchLightCurve,
  fetchSpectrum,
  type CatalogResponse,
  type FramesResponse,
  type MoversResponse,
  type LightCurveResponse,
  type SpectrumResponse,
} from "../lib/api.ts";
import { useAsync } from "../lib/useAsync.ts";
import { parseViewState, queryKey, targetQuery, toSearchParams, type Panel, type ViewState } from "../lib/viewState.ts";
import styles from "./Viewer.module.css";

const PANELS: { id: Panel; label: string }[] = [
  { id: "findings", label: "Motion" },
  { id: "spectrum", label: "Spectrum" },
  { id: "brightness", label: "Brightness" },
  { id: "movers", label: "What moved" },
];

export default function Viewer() {
  const [params, setParams] = useSearchParams();
  const view = parseViewState(params);
  const query = targetQuery(view);
  const key = queryKey(view);
  const hasTarget = Boolean(view.target || (view.ra !== null && view.dec !== null));

  const update = useCallback(
    (patch: Partial<ViewState>) => {
      setParams(toSearchParams({ ...parseViewState(params), ...patch }), { replace: true });
    },
    [params, setParams],
  );

  const frames = useAsync<FramesResponse>((signal) => fetchFrames(query, signal), key, hasTarget);
  const passCount = frames.data?.passes.length ?? 0;
  const pair = view.pair ?? [1, Math.max(passCount, 1)];
  const wantDifference = view.mode === "difference" && passCount >= 2;
  const difference = useAsync<{ image: string }>(
    (signal) => fetchDifference(query, Math.min(...pair), Math.max(...pair), signal),
    `${key}|diff|${pair.join("-")}`,
    wantDifference,
  );

  const gaia = useAsync<CatalogResponse>(
    (signal) => fetchCatalog(query, signal),
    `${key}|gaia`,
    hasTarget && view.gaia && !frames.loading,
  );

  const movers = useAsync<MoversResponse>(
    (signal) => fetchMovers(query, signal),
    `${key}|movers`,
    hasTarget && view.panel === "movers" && !frames.loading,
  );
  const [selectedMover, setSelectedMover] = useState<string | null>(null);

  const pickKey = view.pick ? `${view.pick.x.toFixed(2)},${view.pick.y.toFixed(2)}` : "target";
  const spectrum = useAsync<SpectrumResponse>(
    (signal) => fetchSpectrum(query, view.pick, signal),
    `${key}|spec|${pickKey}`,
    hasTarget && view.panel === "spectrum" && !frames.loading,
  );
  const brightness = useAsync<LightCurveResponse>(
    (signal) => fetchLightCurve(query, signal),
    `${key}|lc`,
    hasTarget && view.panel === "brightness" && !frames.loading,
  );

  const target = frames.data?.target;
  const heading = target?.name ?? view.target ?? (hasTarget ? "Custom position" : "No target selected");
  const position = target
    ? `RA ${target.ra.toFixed(4)}° · Dec ${target.dec >= 0 ? "+" : ""}${target.dec.toFixed(4)}° · ${target.epoch}`
    : view.ra !== null && view.dec !== null
      ? `RA ${view.ra.toFixed(4)}° · Dec ${view.dec >= 0 ? "+" : ""}${view.dec.toFixed(4)}°`
      : "Search for a name, or paste coordinates";

  const mapField = frames.data
    ? { ra: frames.data.grid.ra, dec: frames.data.grid.dec, sizeDeg: frames.data.grid.fov_deg }
    : view.ra !== null && view.dec !== null
      ? { ra: view.ra, dec: view.dec, sizeDeg: view.fovDeg }
      : null;

  if (view.embed) {
    return (
      <main className={`container ${styles.embed}`}>
        <Player
          view={view}
          onChange={update}
          frames={frames.data}
          loading={frames.loading}
          error={frames.error}
          status={frames.status}
          elapsedMs={frames.elapsedMs}
          differenceImage={difference.data?.image ?? frames.data?.difference_image ?? null}
          catalog={gaia.data}
          catalogError={gaia.error}
          movers={[]}
          selectedMover={null}
        />
        <footer className={styles.embedFoot}>
          <span>
            <strong>{heading}</strong>
            {frames.data?.measurement?.motion?.measured_arcsec
              ? ` · moved ${frames.data.measurement.motion.measured_arcsec.toFixed(2)} ± ${(frames.data.measurement.motion.sigma_arcsec ?? 0).toFixed(2)}″ in ${frames.data.measurement.motion.baseline_years.toFixed(2)} yr`
              : ""}
          </span>
          <a href={`/view?${toSearchParams({ ...view, embed: false }).toString()}`} target="_blank" rel="noreferrer">
            Open in Quantum Horizon →
          </a>
          <span className={styles.embedCredit}>SPHEREx: NASA/JPL-Caltech/IPAC via IRSA</span>
        </footer>
      </main>
    );
  }

  return (
    <main className={`container ${styles.page}`}>
      <div className={styles.titleRow}>
        <div className={styles.titleText}>
          <h1>{heading}</h1>
          <p className="mono">{position}</p>
        </div>
        <ShareButtons />
      </div>

      {target && target.source !== "user coordinates" ? (
        <div className={`panel ${styles.banner}`}>
          <span>
            Proper motion <span className={`mono ${styles.bannerStrong}`}>{target.pmra.toFixed(1)}</span>,{" "}
            <span className={`mono ${styles.bannerStrong}`}>{target.pmdec.toFixed(1)}</span> mas/yr
          </span>
          {target.parallax ? (
            <span>
              Distance <span className={`mono ${styles.bannerStrong}`}>{(1000 / target.parallax).toFixed(2)} pc</span>
            </span>
          ) : null}
          <span>
            Astrometry from <span className={styles.bannerStrong}>{target.source}</span>
          </span>
          {frames.data ? (
            <span>
              {frames.data.frames.filter((f) => f.status === "used").length} exposures ·{" "}
              {frames.data.releases.join(", ").toUpperCase()}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.main}>
          <Player
            view={view}
            onChange={update}
            frames={frames.data}
            loading={frames.loading}
            error={frames.error}
            status={frames.status}
            elapsedMs={frames.elapsedMs}
            differenceImage={difference.data?.image ?? frames.data?.difference_image ?? null}
            catalog={gaia.data}
            catalogError={gaia.error}
            movers={view.panel === "movers" ? (movers.data?.candidates ?? []) : []}
            selectedMover={selectedMover}
          />

          <section className={styles.analysis}>
            <div className={styles.panelTabs} role="tablist" aria-label="Analysis">
              {PANELS.map((panel) => (
                <button
                  key={panel.id}
                  type="button"
                  role="tab"
                  aria-selected={view.panel === panel.id}
                  className="btn toggle"
                  onClick={() => update({ panel: panel.id })}
                >
                  {panel.label}
                </button>
              ))}
            </div>
            {view.panel === "spectrum" ? (
              <Spectrum
                data={spectrum.data}
                loading={spectrum.loading}
                error={spectrum.error}
                picked={Boolean(view.pick)}
                onClear={() => update({ pick: null })}
              />
            ) : null}
            {view.panel === "brightness" ? (
              <LightCurve data={brightness.data} loading={brightness.loading} error={brightness.error} />
            ) : null}
            {view.panel === "movers" ? (
              <Movers
                data={movers.data}
                loading={movers.loading}
                error={movers.error}
                selected={selectedMover}
                onSelect={setSelectedMover}
              />
            ) : null}
            {view.panel === "findings" ? (
              <p className={styles.analysisHint}>
                The motion measurement is beside the image. Open <strong>Spectrum</strong> to measure flux against
                wavelength in each pass, <strong>Brightness</strong> to follow one band over time, or{" "}
                <strong>What moved</strong> to search the whole field for anything else that changed position.
              </p>
            ) : null}
          </section>
        </div>
        <FindingsPanel frames={frames.data} />
      </div>

      {mapField ? (
        <SkyMap
          key={key}
          ra={mapField.ra}
          dec={mapField.dec}
          viewDeg={Math.max(mapField.sizeDeg * 8, 0.4)}
          title="Where this is in the sky"
          subtitle={`${heading} on all-sky survey imagery. The blue square is the ${(mapField.sizeDeg * 60).toFixed(1)}′ SPHEREx field you are blinking. Click anywhere, or on a name, to blink somewhere else.`}
          field={mapField}
          detector={view.detector}
          startOpen
        />
      ) : null}

      <footer className={styles.footer}>
        <a href="/methods">How these numbers are measured, and where they stop</a>
        <br />
        Images: NASA/JPL-Caltech/IPAC, SPHEREx Quick Release via IRSA. Positions and proper motions: SIMBAD and Gaia
        DR3. Pixels read from the SPHEREx public mirror on AWS Open Data.
      </footer>
    </main>
  );
}
