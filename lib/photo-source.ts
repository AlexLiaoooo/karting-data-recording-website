"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { LoggerPhoto } from "./types";

/** Allocate a preview URL only at subscription/commit, and release it when the view closes. */
class PhotoSource {
  private listeners = new Set<() => void>();
  private url = "";
  constructor(private photo: LoggerPhoto) {}
  getSnapshot = () => this.photo.dataUrl ?? this.url;
  getServerSnapshot = () => this.photo.dataUrl ?? "";
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (!this.url && this.photo.blob) this.url = URL.createObjectURL(this.photo.blob);
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size && this.url) { URL.revokeObjectURL(this.url); this.url = ""; }
    };
  };
}

export function usePhotoSource(photo: LoggerPhoto) {
  const source = useMemo(() => new PhotoSource(photo), [photo]);
  return useSyncExternalStore(source.subscribe, source.getSnapshot, source.getServerSnapshot);
}
