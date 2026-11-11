import * as React from "react";
import { useStore } from "./store";
import type { User } from "./types";

/** The signed-in user. Only call under the signed-in shell. */
export function useMe(): User {
  const userId = useStore((s) => s.userId);
  const users = useStore((s) => s.db.users);
  return users.find((u) => u.id === userId) ?? users[0];
}

export function useUserName() {
  const users = useStore((s) => s.db.users);
  return React.useCallback((id: string | undefined) => users.find((u) => u.id === id)?.name ?? "Unknown", [users]);
}

export type LoadStatus = "loading" | "error" | "ready";

/** Simulated screen load: skeletons for 300–800 ms, or a forced API error with retry. */
export function useLoad(key: string = "") {
  const load = useStore((s) => s.load);
  const nonce = useStore((s) => s.screenNonce);
  const [status, setStatus] = React.useState<LoadStatus>("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let live = true;
    setStatus("loading");
    load().then(
      () => live && setStatus("ready"),
      (e: unknown) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      },
    );
    return () => {
      live = false;
    };
  }, [load, nonce, attempt, key]);

  return { status, error, retry: () => setAttempt((a) => a + 1) };
}

/** Wraps an async write with busy and error state. */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = React.useCallback(
    async (...args: A): Promise<{ ok: true; value: R } | { ok: false; value?: undefined }> => {
      setBusy(true);
      setError(null);
      try {
        return { ok: true, value: await fn(...args) };
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    [fn],
  );
  return { run, busy, error, setError };
}
