// Module-level singleton that owns the enrichment async operation.
// The website scrape + background LinkedIn auto-fill run HERE, not in the
// React component, so navigating away from the dialog (or the browser
// backgrounding the tab) never abandons the in-flight work. When the
// FirmEnrichmentPanel remounts, it reads the current state and picks up
// right where it left off — including a completed result that arrived
// while the user was on another page.

import { enrichFirmFromWeb, autoFillMissingLinkedInUrls } from "../ai/firmEnrichment";
import { validateEnrichment } from "../ai/enrichmentValidation";
import { logEnrichmentAttempt } from "../ai/enrichmentLogger";

let state = {
  status: "idle", // idle | loading | ready | error
  firmName: null,
  website: null,
  loading: false,
  linkedinFilling: false,
  linkedinProgress: null,
  enrichedData: null,
  error: null,
  // Monotonic key so subscribers can detect when a NEW enrichment was started
  // (vs the same one still running) — prevents a stale remount from clobbering
  // a fresh start with old derived state.
  runId: 0,
};

const listeners = new Set();

function setState(updates) {
  state = { ...state, ...updates };
  listeners.forEach((fn) => fn(state));
}

export function getEnrichmentState() {
  return state;
}

export function subscribeEnrichment(fn) {
  listeners.add(fn);
  fn(state); // immediately push current state to new subscribers
  return () => listeners.delete(fn);
}

export function resetEnrichment() {
  setState({
    status: "idle",
    firmName: null,
    website: null,
    loading: false,
    linkedinFilling: false,
    linkedinProgress: null,
    enrichedData: null,
    error: null,
    runId: state.runId + 1,
  });
}

/**
 * Returns true if any enrichment work is in flight (main scrape or
 * background LinkedIn auto-fill). Used by the dialog to block closing.
 */
export function isEnrichmentBusy() {
  return state.loading || state.linkedinFilling;
}

export async function startEnrichment(firmName, website, existingFirm, existingContacts) {
  // Don't restart if already running for the same firm.
  if (state.loading && state.firmName === firmName && state.website === website) {
    return state.runId;
  }
  // If we already have a ready result for this exact firm+website, don't re-fetch.
  if (state.status === "ready" && state.firmName === firmName && state.website === website && state.enrichedData) {
    return state.runId;
  }

  const runId = state.runId + 1;
  setState({
    status: "loading",
    firmName,
    website,
    loading: true,
    linkedinFilling: false,
    linkedinProgress: null,
    enrichedData: null,
    error: null,
    runId,
  });

  try {
    const data = await enrichFirmFromWeb(firmName, website);

    // Only apply results if this is still the active run (user may have reset).
    if (state.runId !== runId) return runId;

    let validationItems = [];
    try {
      ({ items: validationItems } = validateEnrichment(data, existingFirm || {}, existingContacts));
    } catch (e) {
      console.error("Enrichment log validation error:", e);
    }
    try {
      logEnrichmentAttempt({
        firmName,
        websiteUrl: website || data.website || "",
        status: "success",
        validationItems,
      });
    } catch { /* logging is non-fatal */ }

    setState({
      status: "ready",
      loading: false,
      enrichedData: data,
    });

    // Background LinkedIn auto-fill — also runs from the store so it
    // survives the component unmounting.
    setState({ linkedinFilling: true, linkedinProgress: null });
    try {
      await autoFillMissingLinkedInUrls(data, website || data.website || "", (p) => {
        if (state.runId !== runId) return; // stale run
        setState({ linkedinProgress: p });
      });
      if (state.runId !== runId) return runId; // stale run

      // Merge any newly-found LinkedIn URLs into the enriched data.
      const updated = { ...state.enrichedData };
      if (data.linkedin_url) updated.linkedin_url = data.linkedin_url;
      if (data.people) updated.people = data.people.map((p) => ({ ...p }));
      setState({
        enrichedData: updated,
        linkedinFilling: false,
        linkedinProgress: null,
      });
    } catch {
      if (state.runId !== runId) return runId;
      setState({ linkedinFilling: false, linkedinProgress: null });
    }

    return runId;
  } catch (err) {
    if (state.runId !== runId) return runId;
    const msg = err.message || "Failed to fetch data from the web";
    setState({
      status: "error",
      loading: false,
      linkedinFilling: false,
      error: msg,
    });
    logEnrichmentAttempt({
      firmName,
      websiteUrl: website || "",
      status: "error",
      errorMessage: msg,
    });
    return runId;
  }
}