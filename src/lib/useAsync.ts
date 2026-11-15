import { useEffect, useRef, useState } from "react";
import { ApiError } from "./api.ts";

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  status: number | null;
  loading: boolean;
  elapsedMs: number;
}

interface Loaded<T> {
  key: string;
  data: T | null;
  error: string | null;
  status: number | null;
}

const EMPTY = { key: "", data: null, error: null, status: null };

/**
 * Runs a request when its key changes. While the next one loads, the previous result stays on screen only if it is
 * for the same place (the part of the key before the first "|"), so switching detector keeps the image but switching
 * target never shows the old target under the new name.
 *
 * Loading is derived by comparing the key with the key that last landed, so no state is set while rendering.
 */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, key: string, enabled = true): AsyncState<T> {
  const [loaded, setLoaded] = useState<Loaded<T>>(EMPTY as Loaded<T>);
  const [elapsedMs, setElapsedMs] = useState(0);
  const loader = useRef(load);

  useEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const started = Date.now();
    const ticker = window.setInterval(() => setElapsedMs(Date.now() - started), 250);

    loader
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setLoaded({ key, data, error: null, status: null });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({
          key,
          data: null,
          status: reason instanceof ApiError ? reason.status : null,
          error: reason instanceof Error ? reason.message : "Something went wrong",
        });
      })
      .finally(() => window.clearInterval(ticker));

    return () => {
      controller.abort();
      window.clearInterval(ticker);
    };
  }, [key, enabled]);

  const settled = loaded.key === key;
  const samePlace = loaded.key.split("|")[0] === key.split("|")[0];
  return {
    data: settled ? loaded.data : enabled && samePlace ? loaded.data : null,
    error: settled ? loaded.error : null,
    status: settled ? loaded.status : null,
    loading: enabled && !settled,
    elapsedMs,
  };
}
