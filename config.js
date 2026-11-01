/* Tawasol hub · site configuration. The ONLY file to edit when deploying. */
window.TAWASOL_CONFIG = {
  api: "",                         // e.g. "https://tawasol-hub-api.<your-account>.workers.dev"  (empty = preview mode, no payments or sign-in)
  assistantApi: "https://aged-mud-dbb7.boodai88.workers.dev",                // Tawasol assistant only — URL of the stand-alone worker (api/assistant-worker.js) so the chat uses Claude before the full backend exists. Leave empty to use the scripted demo.
  supportEmail: "hello@tawasol.clinic",
  // The book is referred to Amazon, not sold here. Paste the exact product links; any left empty is hidden. If all are empty the site shows a neutral Amazon search link.
  amazon: { print: "", kindle: "", audible: "" },
  defaultLang: "en",               // first visit; afterwards the visitor's choice is remembered
  // PREVIEW ONLY — sample audio for the player while there is no backend. Key = chapter number, value = file in samples/.
  // Delete a line to hide that chapter's sample. Ignored once "api" is set (the backend serves samples privately).
  previewSamples: {
    1: "samples/01-opening-credits.mp3",
    3: "samples/03-introduction.mp3",
  },
};
