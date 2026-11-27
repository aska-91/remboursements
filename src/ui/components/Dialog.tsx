import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

interface Props {
  title: string;
  info?: string;
  /** Narrow dialogs for short actions, wide for the expense form. */
  size?: "small" | "wide";
  onClose: () => void;
  children: ComponentChildren;
}

/**
 * Modal built on the native <dialog> element: focus is kept inside, Escape
 * closes it and focus returns to the button that opened it.
 */
export function Dialog({ title, info, size = "small", onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    // Start on the element marked data-autofocus (e.g. Cancel in a delete confirmation).
    d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    // Escape (or the Android back gesture) closes the native dialog; keep our state in step.
    const closed = () => onCloseRef.current();
    d.addEventListener("close", closed);
    return () => {
      d.removeEventListener("close", closed);
      if (d.open) d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      class={`modal modal-${size}`}
      aria-labelledby="dialog-title"
      // A click on the backdrop (outside the box) closes the dialog.
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div class="modal-box">
        <h2 id="dialog-title">{title}</h2>
        {info && <p class="meta">{info}</p>}
        {children}
      </div>
    </dialog>
  );
}
