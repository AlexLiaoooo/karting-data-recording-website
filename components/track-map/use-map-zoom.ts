"use client";

import { RefObject, useCallback, useEffect, useLayoutEffect, useRef } from "react";

type MapZoomOptions = {
  zoom: number;
  min: number;
  max: number;
  onZoomChange: (zoom: number) => void;
};

/** The point under the fingers (or cursor), so it stays put while the zoom changes. */
type Anchor = { fractionX: number; fractionY: number; offsetX: number; offsetY: number };

const touchDistance = (touches: TouchList) =>
  Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

const touchMidpoint = (touches: TouchList) => ({
  x: (touches[0].clientX + touches[1].clientX) / 2,
  y: (touches[0].clientY + touches[1].clientY) / 2,
});

/**
 * Pinch to zoom on touch, ctrl/cmd + wheel on a pointer device — the same combination
 * browsers and map tools already use, so plain scrolling still scrolls the page.
 *
 * Listeners are attached by hand rather than through React props because both gestures must
 * call preventDefault, which needs a non-passive listener.
 */
export function useMapZoom(viewportRef: RefObject<HTMLDivElement | null>, { zoom, min, max, onZoomChange }: MapZoomOptions) {
  const zoomRef = useRef(zoom);
  const anchorRef = useRef<Anchor | null>(null);
  const stageWidthRef = useRef(0);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const clamp = useCallback((value: number) => Math.min(max, Math.max(min, value)), [min, max]);

  /** Records where the gesture is pointing, as a fraction of the content, before the resize. */
  const captureAnchor = useCallback((clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    const stage = viewport?.firstElementChild as HTMLElement | undefined;
    if (!viewport || !stage) return;
    const rect = viewport.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    stageWidthRef.current = stage.offsetWidth;
    anchorRef.current = {
      fractionX: stage.offsetWidth ? (viewport.scrollLeft + offsetX) / stage.offsetWidth : 0,
      fractionY: stage.offsetHeight ? (viewport.scrollTop + offsetY) / stage.offsetHeight : 0,
      offsetX,
      offsetY,
    };
  }, [viewportRef]);

  // Scroll back to the anchor once the stage has been laid out at its new size, so the point
  // under the fingers does not drift away during the gesture.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const viewport = viewportRef.current;
    const stage = viewport?.firstElementChild as HTMLElement | undefined;
    if (!anchor || !viewport || !stage) return;
    anchorRef.current = null;
    viewport.scrollLeft = anchor.fractionX * stage.offsetWidth - anchor.offsetX;
    viewport.scrollTop = anchor.fractionY * stage.offsetHeight - anchor.offsetY;
  }, [zoom, viewportRef]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let pinchStartDistance = 0;
    let pinchStartZoom = 1;

    function handleTouchStart(event: TouchEvent) {
      if (event.touches.length !== 2) return;
      pinchStartDistance = touchDistance(event.touches);
      pinchStartZoom = zoomRef.current;
    }

    function handleTouchMove(event: TouchEvent) {
      if (event.touches.length !== 2 || !pinchStartDistance) return;
      event.preventDefault();
      const midpoint = touchMidpoint(event.touches);
      captureAnchor(midpoint.x, midpoint.y);
      onZoomChange(clamp(pinchStartZoom * (touchDistance(event.touches) / pinchStartDistance)));
    }

    function endPinch(event: TouchEvent) {
      if (event.touches.length < 2) pinchStartDistance = 0;
    }

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      captureAnchor(event.clientX, event.clientY);
      // Trackpad pinch arrives as ctrl + wheel with small deltas; 0.01 keeps both it and a
      // mouse wheel's coarser steps to a sensible rate.
      onZoomChange(clamp(zoomRef.current - event.deltaY * 0.01));
    }

    viewport.addEventListener("touchstart", handleTouchStart, { passive: false });
    viewport.addEventListener("touchmove", handleTouchMove, { passive: false });
    viewport.addEventListener("touchend", endPinch);
    viewport.addEventListener("touchcancel", endPinch);
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("touchstart", handleTouchStart);
      viewport.removeEventListener("touchmove", handleTouchMove);
      viewport.removeEventListener("touchend", endPinch);
      viewport.removeEventListener("touchcancel", endPinch);
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, [viewportRef, captureAnchor, clamp, onZoomChange]);
}
