"use client";

import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

type ModalProps = {
  children?: ReactNode;
  labelledBy: string;
  describedBy?: string;
  onDismiss: () => void;
  centered?: boolean;
  busy?: boolean;
  role?: "dialog" | "alertdialog";
};

function tabbableControls(dialog: HTMLDialogElement) {
  return [...dialog.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]")].filter(element => {
    if (element.tabIndex < 0 || element.matches(":disabled, input[type=hidden]")) return false;
    for (let node: HTMLElement | null = element; node && node !== dialog; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (node.hidden || node.inert || style.display === "none" || style.visibility === "hidden") return false;
    }
    return true;
  });
}

/** Native modality supplies background inertness; boundary handling also keeps Tab inside. */
export function Modal({ children, labelledBy, describedBy, onDismiss, centered = false, busy = false, role = "dialog" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const owner = dialog.closest(".app-shell") ?? dialog.parentElement;
    opener.current ??= document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]:not(:disabled)")?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      // Wait for the new screen's DOM. Strict Mode reopening must not steal its focus.
      queueMicrotask(() => {
        const target = opener.current;
        const activeModal = [...document.querySelectorAll("dialog.modal-backdrop[open]")].at(-1);
        if (activeModal && (!target || !activeModal.contains(target))) return;
        if (target?.isConnected && target !== document.body && target !== document.documentElement && !target.matches(":disabled") && !target.closest("[inert]")) {
          target.focus({ preventScroll: true });
          if (document.activeElement === target) return;
        }
        if (owner?.isConnected) owner.querySelector<HTMLElement>(".topbar button:not(:disabled)")?.focus({ preventScroll: true });
      });
    };
  }, []);

  useLayoutEffect(() => {
    const dialog = ref.current!;
    if (busy && (!dialog.contains(document.activeElement) || document.activeElement?.matches(":disabled"))) {
      (dialog.querySelector<HTMLElement>("[data-dialog-busy-focus]") ?? dialog).focus({ preventScroll: true });
    }
  }, [busy]);

  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab" || event.defaultPrevented) return;
    const dialog = event.currentTarget;
    const controls = tabbableControls(dialog);
    const first = controls[0]; const last = controls.at(-1);
    if (!first) { event.preventDefault(); (dialog.querySelector<HTMLElement>("[data-dialog-busy-focus]") ?? dialog).focus({ preventScroll: true }); }
    else if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) {
      event.preventDefault(); last!.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) {
      event.preventDefault(); first.focus();
    }
  }

  return <dialog ref={ref} className={`modal-backdrop${centered ? " modal-centered" : ""}`} role={role} aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy} aria-busy={busy || undefined}
    onKeyDown={containTab} onCancel={event => { event.preventDefault(); if (!busy) onDismiss(); }}>
    {children}
  </dialog>;
}
