"use client";

import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Closes an inline dropdown when the pointer goes down anywhere outside it. */
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
 *
 * Built on the shadcn dialog, so Escape, the focus trap, the scroll lock, and
 * the outside click come from Radix rather than from the mousedown handler
 * this used to carry — which closed on an outside click but trapped nothing.
 * The props are unchanged, so callers did not have to move.
 */
export function PickerModal({
  title,
  description,
  onClose,
  footer,
  children,
}: {
  title: string;
  /** Read out to assistive tech; the visible dialogs are titled only. */
  description?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {description ?? title}
          </DialogDescription>
        </DialogHeader>
        <div className="picker-body">{children}</div>
        {footer ? <footer className="picker-footer">{footer}</footer> : null}
      </DialogContent>
    </Dialog>
  );
}
