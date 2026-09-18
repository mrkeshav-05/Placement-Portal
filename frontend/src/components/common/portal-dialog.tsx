"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The shell every dialog in the portal sits in, on both sides.
 *
 * The admin managers and the student views each hand-rolled a
 * `.modal-backdrop` wrapper with its own close button and its own outside-click
 * handler, and none of them trapped focus or closed on Escape. Radix does all
 * of that, so the call sites now pass only what differs: the eyebrow, the
 * title, and the body.
 */
export function PortalDialog({
  onClose,
  eyebrow,
  title,
  description,
  className,
  children,
}: {
  onClose: () => void;
  /** The small uppercase kicker above the title, e.g. "Danger Zone". */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Shown under the title; falls back to the title for assistive tech. */
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className={className}>
        <DialogHeader>
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
