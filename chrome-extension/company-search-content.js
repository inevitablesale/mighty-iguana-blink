// This script scrapes company search results from LinkedIn.

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeSearchResults() {
  console.log("Coogi Extension: Scraping company search results...");
  try {
    await wait(3000); // Wait for results to load

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
    chrome.runtime.sendMessage({ action: "scrapedCompanySearchResults", results });

  } catch (error) {
    console.error("Coogi Extension: Error scraping search results:", error);
    chrome.runtime.sendMessage({ action: "scrapingError", error: error.message });
  }
}

scrapeSearchResults();