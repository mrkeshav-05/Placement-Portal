"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/** Closes a popover when the pointer goes down anywhere outside it. */
export function useDismissOnOutsideClick(onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onDismiss]);

  return ref;
}

/**
 * The dialog the admin composers open for a choice too long to sit in a
 * dropdown: companies, seasons, degrees, branches.
 */
export function PickerModal({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal picker-modal"
        role="dialog"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X />
          </button>
        </header>
        <div className="picker-body">{children}</div>
        {footer ? <footer className="picker-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
