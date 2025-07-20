// This script's only job is to perform the handshake with the web app.
// It injects a script into the page to bypass the isolated world of the content script.
// This allows the page's own JavaScript to receive the event.
try {
  const script = document.createElement('script');
  const extensionId = chrome.runtime.id; // Get the ID in the content script context

  // Inject the ID as a string into the script that will run in the page's context
  script.textContent = `
    const event = new CustomEvent('coogi-extension-ready', {
      detail: { extensionId: "${extensionId}" }
    });
    window.dispatchEvent(event);
  `;

  (document.head || document.documentElement).appendChild(script);
  // Clean up the script tag from the DOM after it has run.
  script.remove(); 
  console.log(`Coogi Extension Handshake: Injected messenger to send ID ${extensionId}.`);

} catch (e) {
  console.error("Coogi Extension: Error injecting handshake script.", e);
}