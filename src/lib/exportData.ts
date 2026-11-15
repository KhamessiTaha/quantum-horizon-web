import type { FramesResponse } from "./api.ts";

const CREDIT =
  "SPHEREx data: NASA/JPL-Caltech/IPAC, via the NASA/IPAC Infrared Science Archive and the SPHEREx mirror on AWS Open Data. Positions and proper motions: SIMBAD (CDS) and Gaia DR3 (ESA).";

export function citation(view: FramesResponse, url: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Quantum Horizon, ${view.target.name}, SPHEREx detector ${view.detector}, ${url} (accessed ${today}).`;
}

function slug(view: FramesResponse): string {
  return `${view.target.name}-${view.detector}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function asJson(view: FramesResponse, url: string): string {
  const { passes, difference_image: _difference, ...rest } = view;
  return JSON.stringify(
    {
      citation: citation(view, url),
      credit: CREDIT,
      ...rest,
      passes: passes.map(({ image: _image, ...pass }) => pass),
    },
    null,
    2,
  );
}

export function asCsv(view: FramesResponse, url: string): string {
  const motion = view.measurement?.motion ?? null;
  const header = [
    `# ${citation(view, url)}`,
    `# ${CREDIT}`,
    `# target ${view.target.name}; RA ${view.target.ra}; Dec ${view.target.dec}; epoch ${view.target.epoch}; source ${view.target.source}`,
    motion
      ? `# motion ${motion.measured_arcsec ?? ""} +/- ${motion.sigma_arcsec ?? ""} arcsec over ${motion.baseline_years} yr (pass ${motion.from_pass} to ${motion.to_pass}); catalog ${motion.predicted_arcsec ?? ""} arcsec; label ${motion.confidence}`
      : "# motion not measured",
  ];
  const columns = [
    "pass",
    "start",
    "end",
    "mid_mjd",
    "frames_used",
    "frames_fit",
    "frames_rejected",
    "wavelength_min_um",
    "wavelength_max_um",
    "measured_ra_deg",
    "measured_dec_deg",
    "sigma_arcsec",
    "snr",
    "offset_from_catalog_arcsec",
    "confidence",
  ];
  const rows = view.passes.map((pass) => {
    const m = view.measurement?.passes.find((p) => p.index === pass.index);
    return [
      pass.index,
      pass.start,
      pass.end,
      pass.mid_mjd,
      pass.frames_used,
      m?.frames_fit,
      m?.frames_rejected,
      pass.wavelength_min_um,
      pass.wavelength_max_um,
      m?.measured_ra,
      m?.measured_dec,
      m?.sigma_arcsec,
      m?.snr,
      m?.offset_from_predicted_arcsec,
      m?.confidence,
    ]
      .map(cell)
      .join(",");
  });
  return [...header, columns.join(","), ...rows].join("\n") + "\n";
}

export function download(view: FramesResponse, format: "csv" | "json"): void {
  const url = window.location.href;
  const text = format === "csv" ? asCsv(view, url) : asJson(view, url);
  const blob = new Blob([text], { type: format === "csv" ? "text/csv" : "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `quantum-horizon-${slug(view)}.${format}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
