/* Tawasol hub · site configuration. The ONLY file to edit when deploying. */
window.TAWASOL_CONFIG = {
  api: "",                         // e.g. "https://tawasol-hub-api.<your-account>.workers.dev"  (empty = preview mode, no payments or sign-in)
  supportEmail: "hello@tawasol.clinic",
  defaultLang: "en",               // first visit; afterwards the visitor's choice is remembered
  // PREVIEW ONLY — sample audio for the player while there is no backend. Key = chapter number, value = file in samples/.
  // Delete a line to hide that chapter's sample. Ignored once "api" is set (the backend serves samples privately).
  previewSamples: {
    1: "samples/01-opening-credits.mp3",
    3: "samples/03-introduction.mp3",
  },
};
