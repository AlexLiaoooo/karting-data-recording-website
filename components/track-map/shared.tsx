"use client";

import { ArrowLeft, MapPinned, Moon, Sun, Trash2 } from "lucide-react";
import { ReactNode, useCallback, useEffect } from "react";
import type { MapAsset, TrackMapData, TrackMarkerType } from "@/lib/track-map/types";

export type SessionContext = {
  eventId: string;
  sessionId: string;
  eventName: string;
  sessionName: string;
  layoutId?: string;
  condition: "Dry" | "Damp" | "Wet" | "Mixed";
};

export type TrackMapChange = (updater: (current: TrackMapData) => TrackMapData) => void;

export const markerShortNames: Record<TrackMarkerType, string> = {
  Corner: "C",
  Braking: "B",
  "Turn-in": "T",
  Apex: "A",
  Exit: "E",
  Hazard: "!",
  Overtaking: "O",
  Focus: "F",
};

export function now() {
  return new Date().toISOString();
}

export function markerClass(type: TrackMarkerType) {
  return `marker-${type.toLowerCase().replace("-", "")}`;
}


export function ThemeButton() {
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("kart-data-theme", next);
  }
  return (
    <button className="icon-button theme-toggle" type="button" aria-label="Switch light or dark mode" onClick={toggleTheme}>
      <span className="theme-icon theme-icon-dark"><Moon /></span>
      <span className="theme-icon theme-icon-light"><Sun /></span>
    </button>
  );
}

export function FeatureHeader({ title, subtitle, onBack, actions }: { title: string; subtitle?: string; onBack: () => void; actions?: ReactNode }) {
  return (
    <header className="topbar">
      <button className="icon-button" type="button" aria-label="Back" onClick={onBack}><ArrowLeft /></button>
      <div className="topbar-copy"><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}</div>
      <div className="topbar-action">{actions}<ThemeButton /></div>
    </header>
  );
}

export function EmptyMapState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <section className="empty-state">
      <span className="empty-icon"><MapPinned /></span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </section>
  );
}

export function MissingRecord({ onBack, text = "This track or layout may have been deleted." }: { onBack: () => void; text?: string }) {
  return (
    <>
      <FeatureHeader title="Track maps" onBack={onBack} />
      <div className="page-content"><EmptyMapState title="Map unavailable" text={text} /></div>
    </>
  );
}

/**
 * Matches the confirm dialog used for Events, Sessions and Runs. Track Map deletions used
 * window.confirm, which neither states what else is removed nor styles like the rest of the
 * app, and native dialogs are the least reliable part of an installed PWA.
 */
export function ConfirmDeleteDialog({ title, detail, onCancel, onConfirm }: { title: string; detail?: string; onCancel: () => void; onConfirm: () => void }) {
  useModalViewport(true);
  return (
    <div className="modal-backdrop modal-centered">
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="track-map-delete-title">
        <span className="danger-icon"><Trash2 /></span>
        <h2 id="track-map-delete-title">{title}</h2>
        <p>{detail ? `${detail} ` : ""}This action cannot be undone.</p>
        <div className="action-stack">
          <button className="button button-danger button-block" onClick={onConfirm}>Delete permanently</button>
          <button className="button button-secondary button-block" onClick={onCancel}>Cancel</button>
        </div>
      </section>
    </div>
  );
}

export function useModalViewport(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const update = () => {
      root.style.setProperty("--visual-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      root.style.setProperty("--visual-viewport-offset-top", `${viewport?.offsetTop ?? 0}px`);
    };
    update();
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      root.style.removeProperty("--visual-viewport-height");
      root.style.removeProperty("--visual-viewport-offset-top");
    };
  }, [active]);
}

/**
 * Map images live in IndexedDB as Blobs, so displaying one needs an object URL. Object URLs
 * stay registered with the document until revoked, so a long-lived trackside session that
 * replaces map images would otherwise leak one URL per image.
 *
 * The URL is created and revoked inside the element's ref callback, which ties its lifetime
 * exactly to the mounted <img>: React runs the returned cleanup when the blob changes or the
 * element unmounts, then re-runs the callback, so every attach gets a fresh URL. Setting src
 * during the ref callback also means the map never renders a frame without an image.
 *
 * next/image cannot own the src this way, and adds nothing here — the blob has already been
 * resized by optimiseMapImage and was passed `unoptimized`.
 */
export function MapImage({ asset, alt, className }: { asset: MapAsset; alt: string; className?: string }) {
  const { blob, width, height } = asset;

  const attachImage = useCallback((node: HTMLImageElement | null) => {
    if (!node) return;
    const url = URL.createObjectURL(blob);
    node.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- src is owned by the ref callback above
    <img ref={attachImage} className={className} alt={alt} width={width} height={height} draggable={false} />
  );
}
