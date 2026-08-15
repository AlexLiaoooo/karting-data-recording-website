"use client";

import { Check, X } from "lucide-react";
import { FormEvent, useState } from "react";
import type { Track, TrackLayout } from "@/lib/track-map/types";

export function TrackEditor({ track, onClose, onSave }: { track?: Track; onClose: () => void; onSave: (value: { name: string; location: string; notes: string }) => void }) {
  const [form, setForm] = useState({ name: track?.name ?? "", location: track?.location ?? "", notes: track?.notes ?? "" });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim(), location: form.location.trim() });
  }
  return (
    <div className="modal-backdrop">
      <form className="modal-sheet modal-compact" onSubmit={submit}>
        <div className="modal-head"><div><p className="eyebrow">TRACK LIBRARY</p><h2>{track ? "Edit track" : "New track"}</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={onClose}><X /></button></div>
        <div className="form-grid">
          <label className="field field-full"><span>Track name</span><input className="input" required autoFocus placeholder="e.g. PF International" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="field field-full"><span>Location</span><input className="input" placeholder="Town, country" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
          <label className="field field-full"><span>General track notes</span><textarea className="textarea" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        </div>
        <button className="button button-primary button-block" type="submit"><Check /> {track ? "Save changes" : "Create track"}</button>
      </form>
    </div>
  );
}

export function LayoutEditor({ layout, onClose, onSave }: { layout?: TrackLayout; onClose: () => void; onSave: (value: { name: string; direction: TrackLayout["direction"] }) => void }) {
  const [name, setName] = useState(layout?.name ?? "Full Layout");
  const [direction, setDirection] = useState<TrackLayout["direction"]>(layout?.direction ?? "Unknown");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) onSave({ name: name.trim(), direction });
  }
  return (
    <div className="modal-backdrop">
      <form className="modal-sheet modal-compact" onSubmit={submit}>
        <div className="modal-head"><div><p className="eyebrow">TRACK LAYOUT</p><h2>{layout ? "Edit layout" : "New layout"}</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={onClose}><X /></button></div>
        <div className="form-grid">
          <label className="field field-full"><span>Layout name</span><input className="input" required autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field field-full"><span>Direction</span><select className="select" value={direction} onChange={(event) => setDirection(event.target.value as TrackLayout["direction"])}><option>Unknown</option><option>Clockwise</option><option>Anti-clockwise</option></select></label>
        </div>
        <button className="button button-primary button-block" type="submit"><Check /> {layout ? "Save changes" : "Create layout"}</button>
      </form>
    </div>
  );
}
