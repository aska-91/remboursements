import { useEffect, useState } from "preact/hooks";

/** Short confirmation message, announced to screen readers. */
export function useToast(): [string | null, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2800);
    return () => clearTimeout(t);
  }, [msg, tick]);
  return [msg, (m: string) => { setMsg(m); setTick((n) => n + 1); }];
}

export function Toast({ msg }: { msg: string | null }) {
  return (
    <div class="toast" role="status" aria-live="polite" hidden={!msg}>
      {msg}
    </div>
  );
}
