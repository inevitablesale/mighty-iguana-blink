// This file's purpose is to set up an event listener as early as possible
// to avoid a race condition with the Chrome extension's announcement.

let ready = false;

const handleExtensionReady = () => {
  console.log("Coogi App: Early listener caught 'coogi-extension-ready'.");
  ready = true;
  // Clean up the listener once it has fired.
  window.removeEventListener('coogi-extension-ready', handleExtensionReady);
};

// This listener is attached as soon as this module is imported.
window.addEventListener('coogi-extension-ready', handleExtensionReady);

/**
 * Checks if the extension was ready during the initial page load.
 * @returns {boolean} True if the extension's ready event was caught.
 */
export const isExtensionReady = () => ready;