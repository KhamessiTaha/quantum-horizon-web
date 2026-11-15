# Submission pack

Draft copy for the Space Apps project page. Check every field against the 2026 Project Submission Guide published on
13 November before pasting: the fields below follow the published structure, but wording and limits can change.

**Before submitting**

- [ ] Make `KhamessiTaha/quantum-horizon` **public**. The final project link must be reachable with no password,
      permission or registration.
- [ ] Deploy the frontend and backend, and confirm the deployed link works from a browser that has never opened it.
- [ ] Record the 30-second demo video, or build the seven-slide deck, and host it somewhere public.
- [ ] Fill in the "Use of Artificial Intelligence" field honestly (draft below).
- [ ] Click **Submit for Judging**. Submission is final and there are no exceptions after the deadline.

---

## Project name

Quantum Horizon

## High-level project summary

Quantum Horizon turns SPHEREx into a blink comparator anyone can use. Enter a star's name or a pair of coordinates,
and it finds every SPHEREx exposure covering that position, aligns them onto a single grid, and plays them in time
order so motion and brightness changes stand out — the method that found Pluto in 1930, applied to an all-sky infrared
survey that images the whole sky every six months in 102 bands.

It does not stop at the picture. For every target it measures how far the source moved, with an uncertainty, and
compares that with the catalog prediction. Barnard's Star measures 9.71 ± 1.57 arcseconds of motion over 0.99 years
against a predicted 10.28 — a shift of 1.6 pixels, recovered from data where one pixel is 6.15 arcseconds across.
Every result carries a label saying how far it can be trusted, and when the data cannot answer, the tool says so
rather than producing a number anyway.

## Link to project demo

*(30-second video or seven-slide deck, hosted publicly — scripts below.)*

## Link to final project

- Live tool: https://quantum-horizon-web.vercel.app
- Source: https://github.com/KhamessiTaha/quantum-horizon

## Detailed project description

**What it does.** You give it a target. It queries the NASA/IPAC Infrared Science Archive for every SPHEREx spectral
image whose footprint contains that position, reads only the pixels it needs straight from the SPHEREx mirror on AWS
Open Data, masks unusable pixels, subtracts the modelled zodiacal light, reprojects every frame onto one common grid,
and stacks the exposures of each detector within each survey pass. The result is one clean frame per pass, which the
browser plays as a blink, or differences to show what changed.

**What makes it a measurement rather than an animation.** Positions are fitted on every frame and then on the pass
stack, with the uncertainty coming from leaving each frame out in turn. Frames that disagree with the rest of their
pass, or that fall below signal-to-noise 3, are rejected and counted. The measured motion is reported against the
catalog prediction with a significance, and graded: measured, marginal, below the noise, or not measurable yet.

**Three decisions the science depends on.**

1. *Flags.* A bright star's own pixels carry TRANSIENT, OVERFLOW, SUR_ERROR, SOURCE and BLOOM. Treating those as bad
   data deletes the star — in our own first run, every QR3 frame of Barnard's Star lost it and the fit landed on noise,
   27 arcseconds against a predicted 10.3. Flags are now split four ways: unusable pixels are masked, the saturation
   family is kept and reported as a brightness caveat, contamination is kept and reported, and TRANSIENT only masks a
   pixel where SOURCE is not also set. QR2 files carry no flag names at all, so the standard table is applied.
2. *Epochs.* SIMBAD coordinates are J2000 and Barnard's Star has moved about 270 arcseconds since; Gaia DR3 is J2016.0
   and it has moved about 100 since. Every catalog position is propagated to the date of the frame it is compared with.
3. *Wavelength.* SPHEREx changes wavelength between exposures of the same pass, so brightness is only compared inside
   narrow wavelength bands. Otherwise the filter's own change would masquerade as variability.

**It agrees with itself.** Barnard's Star measured on detector 1 gives 10.31 ± 1.08 arcseconds and on detector 2
gives 9.71 ± 1.57, against catalog predictions of 10.08 and 10.28 for those baselines — two independent measurements
of the same star through different filters. Epsilon Indi B comes out at 6.57 ± 0.62 against a predicted 6.69, agreeing
to a tenth of an arcsecond from 84 exposures across five passes. And the stars that are not moving return no motion:
RW Aurigae measures 0.36 ± 0.62 arcseconds against a predicted 0.02.

**Honesty as a feature.** Barnard's Star saturates the detector: its core carries no usable values. The tool refuses
to report a light curve for it and explains why, while still measuring its position from the unsaturated wings. WISE
0855 is at the edge of detectability and is labelled accordingly. A blank mover search is reported as a result, not
hidden.

**The mover search.** Every source in the field is detected in each pass, linked into tracks and fitted with a
weighted straight line in time. Tracks survive only at five sigma, and are then checked against Gaia DR3 along their
whole path, including speed — so a track is labelled a known moving star with its Gaia identifier, or an unexplained
candidate. If Gaia cannot be reached, nothing is called unexplained. The detector was validated over 150 synthetic
fields in the research phase, where the rules used here brought false alarms down from 0.21 to 0.01 per field. The
panel states the search's own limit for the baseline covered, and says plainly that a distant Solar System body would
not be found this way, because the Earth's own orbit swings it far outside the field between passes.

**Who it is for.** An astronomer who wants a defensible number with an error bar, and anyone else who wants to watch a
star move across a year of real infrared data. Every setting lives in the URL, so a view can be shared, cited or
embedded, and new SPHEREx releases appear as soon as the archive lists them.

**How it is built.** A thin FastAPI service does the astronomy with astropy and reproject; a React and TypeScript
frontend does the viewing. The aligned frame cube is cached on disk, so a position is slow once and instant
afterwards, and a cached target keeps working even when the archive is down — which it was, for hours, during our
research phase.

## NASA data

- **SPHEREx Quick Release Level 2 spectral images (QR2, QR3)** — NASA/JPL-Caltech/IPAC, via the NASA/IPAC Infrared
  Science Archive. Discovery through IRSA's TAP service (`spherex.plane`, `spherex.artifact`) and SIA2; pixels read
  from the `nasa-irsa-spherex` bucket on AWS Open Data, with IRSA's cutout service as fallback. The IMAGE, FLAGS,
  VARIANCE, ZODI and WCS-WAVE extensions are all used.
- **SPHEREx Explanatory Supplement** and the IRSA Spectrophotometry Tool documentation — flag bit definitions.
- **IRSA SPHEREx tutorial notebooks** — reference for cutouts and the spectral WCS.

## Space agency partner and other data

- **Gaia DR3** (ESA) — positions and proper motions for the overlay and the mover cross-match, through the ESA Gaia TAP
  service.
- **SIMBAD** (CDS, Strasbourg) — name resolution and astrometry, with the Harvard mirror as an automatic fallback.
- **Aladin Lite and HiPS surveys** (CDS) — WISE, 2MASS and DSS2 context imagery.
- Open-source libraries: astropy, reproject, pyvo, fsspec and s3fs, FastAPI, React, Vite.

## Use of artificial intelligence

*(Adjust to match what you actually did before submitting.)*

AI was used as a coding and writing assistant throughout. Claude (Anthropic) helped design the architecture, write and
review the Python backend, the React frontend and the test suite, and draft documentation including parts of this
project page. Every scientific decision was checked against primary sources — the SPHEREx Explanatory Supplement, the
IRSA documentation and the archives themselves — and every number quoted in this submission was produced by running
this code on real SPHEREx data, not generated by a model. The voice-over in the demo video is AI-generated
text-to-speech, reading a script we wrote, and the slide deck was laid out with Claude from screenshots of the tool. All
images in the video and the deck are screenshots of the tool showing real SPHEREx data; none are AI-generated. The code
is in the public repository linked above, with its full commit history.

---

## 30-second demo video script

Screen recording of the live tool, with an AI text-to-speech voice-over. About 70 words, read at a calm pace.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:05 | Home page: the hero strip of three real Barnard's Star passes | "In 1930, Pluto was found by blinking two photographs of the same patch of sky." |
| 0:05–0:10 | Click the search box, type "Barn", pick Barnard's Star from the suggestions | "Quantum Horizon does that with NASA's SPHEREx. Pick any star, and every exposure is found, aligned and blinked." |
| 0:10–0:16 | The blink playing, amber cross and cyan ring visible | "Amber is where the catalog says the star should be. Cyan is where we measured it." |
| 0:16–0:22 | Zoom on the Motion panel: 9.71 ± 1.57″, catalog 10.28″, Measured | "Nine point seven one arcseconds in a year, plus or minus one point six, against a catalog ten point three." |
| 0:22–0:27 | Sky map tab, zoomed: amber SIMBAD label, bright WISE star, blue SPHEREx square | "And on the sky map, one star at three epochs: the year 2000, 2010, and today." |
| 0:27–0:30 | End card: quantum-horizon-web.vercel.app | "Real measurements, with honest limits. Quantum Horizon." |

Voice-over text, to paste into the text-to-speech tool as one block:

> In 1930, Pluto was found by blinking two photographs of the same patch of sky. Quantum Horizon does that with
> NASA's SPHEREx. Pick any star, and every exposure is found, aligned and blinked. Amber is where the catalog says the
> star should be. Cyan is where we measured it. Nine point seven one arcseconds in a year, plus or minus one point six,
> against a catalog ten point three. And on the sky map, one star at three epochs: the year 2000, 2010, and today.
> Real measurements, with honest limits. Quantum Horizon.

## Seven-slide deck outline

1. **Blink the infrared sky. Measure what moved.** — the hero strip, and the one-line pitch.
2. **The problem.** SPHEREx images everything every six months in 102 bands, but nothing lets a person look at one spot
   across time and get a number out.
3. **What we built.** The viewer, annotated: blink, difference, epochs, detectors, field of view, spectrum.
4. **The measurement.** Barnard's Star: 9.71 ± 1.57″ measured against 10.28″ predicted, 6.2σ, 1.6 pixels.
5. **Getting it right.** The flag mistake that deleted bright stars, epoch propagation, and wavelength banding.
6. **Knowing when to stop.** Saturated cores, marginal detections, and a mover search that states its own limit.
7. **Try it.** The live link, the repository, and the data credits.
