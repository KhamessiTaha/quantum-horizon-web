import { useId, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import READY from "../data/ready.json";
import { matchSuggestions, type Suggestion } from "../data/suggestions.ts";
import { FOV_LIMITS, parseCoordinates, parseQuery, parseViewState, toSearchParams, type DetectorId } from "../lib/viewState.ts";
import styles from "./SearchBox.module.css";

function formatDeg(value: number, signed = false): string {
  return `${signed && value >= 0 ? "+" : ""}${value.toFixed(4)}°`;
}

const READY_SET = new Set(READY as string[]);

export default function SearchBox({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const current = parseViewState(params);
  const initial = current.target ?? (current.ra !== null && current.dec !== null ? `${current.ra} ${current.dec}` : "");
  const [query, setQuery] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputId = useId();
  const hintId = useId();
  const listId = useId();

  const coordinates = useMemo(() => parseCoordinates(query), [query]);
  const matches = useMemo(() => (coordinates ? [] : matchSuggestions(query, query.trim() ? 8 : 40)), [query, coordinates]);
  const showList = open && (matches.length > 0 || coordinates !== null);

  function go(text: string, detector?: DetectorId) {
    const parsed = parseQuery(text);
    if (!parsed.target && parsed.ra === null) return;
    const next = toSearchParams({
      ...current,
      ...parsed,
      fovDeg: compact ? current.fovDeg : FOV_LIMITS.defaultDeg,
      detector: detector ?? (compact ? current.detector : "D2"),
      mode: "blink",
      hidden: [],
      pair: null,
      pick: null,
    });
    setOpen(false);
    setActive(-1);
    navigate(`/view?${next.toString()}`);
  }

  function choose(suggestion: Suggestion) {
    setQuery(suggestion.name);
    go(suggestion.name, suggestion.detector);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (open && active >= 0 && matches[active]) choose(matches[active]);
    else go(query);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <form role="search" onSubmit={submit} className={compact ? styles.compact : styles.form}>
      <label htmlFor={inputId} className={compact ? "visually-hidden" : styles.label}>
        Target name or coordinates
      </label>
      <div className={styles.row}>
        <div className={styles.field}>
          <input
            id={inputId}
            className={`mono ${styles.input}`}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            placeholder={compact ? "Name or coordinates" : "Barnard's Star, or 17 57 48.5 +04 41 36"}
            aria-describedby={compact ? undefined : hintId}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          {showList ? (
            <ul id={listId} role="listbox" className={styles.list}>
              {coordinates ? (
                <li role="option" aria-selected="true" className={styles.coords} onMouseDown={(e) => e.preventDefault()} onClick={() => go(query)}>
                  <span className={styles.groupLabel}>Coordinates</span>
                  <span className="mono">
                    RA {formatDeg(coordinates.ra)} · Dec {formatDeg(coordinates.dec, true)}
                  </span>
                </li>
              ) : (
                matches.map((s, index) => {
                  const heading = index === 0 || matches[index - 1].group !== s.group ? s.group : null;
                  return (
                    <li key={s.name} role="presentation">
                      {heading ? <span className={styles.groupLabel}>{heading}</span> : null}
                      <div
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={index === active}
                        className={styles.option}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => choose(s)}
                      >
                        <span className={styles.optionName}>
                          {s.name}
                          {READY_SET.has(s.name) ? <span className={styles.ready}>ready</span> : null}
                        </span>
                        <span className={styles.optionNote}>{s.note}</span>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          ) : null}
        </div>
        <button type="submit" className="btn btn-primary">
          {compact ? "Go" : "Blink it"}
        </button>
      </div>
      {!compact && (
        <p id={hintId} className={styles.hint}>
          Any name SIMBAD knows, or coordinates in degrees or hours: copy them straight from the sky map below.
        </p>
      )}
    </form>
  );
}
