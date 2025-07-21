// =======================
// ✅ UTILITIES
// =======================
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForSelector(selector, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    // Wait for the container to exist and have at least one result in it
    if (el && el.children.length > 0) return el;
    await wait(200);
  }
  return null;
}

// =======================
// ✅ SCRAPING LOGIC
// =======================
async function scrapeCompanySearchResults() {
  console.log("Coogi Extension: Scraping company search results...");
  try {
    // Wait for the main results container to appear and be populated
    const resultsContainer = await waitForSelector('ul.reusable-search__results-container');
    if (!resultsContainer) {
      throw new Error("Search results did not load in time.");
    }
    
    // Give it a brief moment for all elements to be fully rendered
    await wait(1000);

    const results = [];
    const resultElements = document.querySelectorAll('li.reusable-search__result-container');

    resultElements.forEach(el => {
      const linkElement = el.querySelector('a.app-aware-link');
      const titleElement = el.querySelector('.entity-result__title-text');
      const subtitleElement = el.querySelector('.entity-result__primary-subtitle');

      if (linkElement && titleElement && subtitleElement) {
        results.push({
          url: linkElement.href,
          title: titleElement.innerText.trim(),
          subtitle: subtitleElement.innerText.trim()
        });
      }
    });

    console.log(`Coogi Extension: Found ${results.length} company search results.`);
    chrome.runtime.sendMessage({
      action: "scrapedCompanySearchResults",
      results
    });

  } catch (error) {
    console.error("Coogi Extension: Error scraping company search results:", error);
    chrome.runtime.sendMessage({
      action: "scrapingError",
      error: error.message
    });
  }
}

// =======================
// ✅ MAIN HANDLER
// =======================
scrapeCompanySearchResults();