"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { watchAppUpdates } from "@/lib/service-worker-updates";

export function RegisterServiceWorker() {
  const { t } = useTranslation();
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      return watchAppUpdates(navigator.serviceWorker, () => setWaiting(true));
    }
  }, []);
  return waiting ? <aside className="app-update-notice" role="status">
    <strong>{t("An app update is ready")}</strong>
    <p>{t("Finish saving and save or cancel open forms, then close all Kart Data tabs and reopen to update. This page will not reload automatically.")}</p>
  </aside> : null;
}
