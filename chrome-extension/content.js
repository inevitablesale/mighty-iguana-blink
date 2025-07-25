if (typeof window.coogiContentScriptLoaded === 'undefined') {
  window.coogiContentScriptLoaded = true;

  const log = (level, ...args) => {
    chrome.runtime.sendMessage({ type: 'log', level, args });
  };

  function waitRandom(min, max) {
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));
  }

  chrome.runtime.onMessage.addListener(async (message) => {
    if (message.action === "scrapeCompanySearchResults") {
      const { taskId, opportunityId } = message;
      log('info', `Content Script: Extracting HTML from company search results page for task ${taskId}`);
      await waitRandom(2000, 4000); // Wait for page to be stable
      
      chrome.runtime.sendMessage({ 
        action: "companySearchResults", 
        taskId, 
        opportunityId, 
        html: document.documentElement.outerHTML 
      });
    }

    if (message.action === "scrapeEmployees") {
       const { taskId, opportunityId } = message;
       log('info', `Content Script: Starting scrape for task ${taskId}`);
       // This part remains complex as it handles infinite scroll on people pages
       // The logic for this seems okay for now, so we'll leave it.
       // ... existing scrapeEmployees logic ...
    }
  });
}