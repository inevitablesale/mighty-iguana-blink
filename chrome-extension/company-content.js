// =======================
// ✅ UTILITIES
// =======================
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function humanScroll() {
  window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });
  await wait(1500);
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  await wait(1500);
}

// =======================
// ✅ SCRAPING LOGIC
// =======================
async function scrapeCompanyPage(opportunityId) {
  console.log(`Coogi Extension: Starting company page scrape for opportunity ${opportunityId}`);
  try {
    // Wait for the page to finish loading dynamic content
    await wait(4000);
    await humanScroll(); // Scroll to trigger lazy-loading of the 'About' section

    const companyData = {};

    const getText = (selector) => {
      const el = document.querySelector(selector);
      return el ? el.innerText.trim() : null;
    };
    
    const getHref = (selector) => {
      const el = document.querySelector(selector);
      return el ? el.href : null;
    }

    // Scrape data using the new selectors
    companyData.name = getText('.top-card-layout__title');
    companyData.tagline = getText('.top-card-layout__headline');
    
    // Find the correct subline item for followers
    const sublineItems = document.querySelectorAll('.top-card__subline-item');
    sublineItems.forEach(item => {
      if (item.innerText.includes('followers')) {
        companyData.followers = item.innerText.trim();
      }
    });

    // Scrape 'About' section data
    companyData.industry = getText('[data-test-id="about-us__industry"]');
    companyData.website = getHref('[data-test-id="about-us__website"] a');
    companyData.location = getText('[data-test-id="about-us__headquarters"]');
    companyData.size = getText('[data-test-id="about-us__companySize"]');
    companyData.founded = getText('[data-test-id="about-us__founded"]');
    companyData.specialties = getText('[data-test-id="about-us__specialties"]');

    console.log("Coogi Extension: Scraped data:", companyData);
    
    // Send data back to the background script
    chrome.runtime.sendMessage({
      action: "scrapedCompanyData",
      opportunityId,
      data: companyData
    });

  } catch (error) {
    console.error("Coogi Extension: Error scraping company page:", error);
    chrome.runtime.sendMessage({
      action: "scrapingError",
      opportunityId,
      error: `Failed during company enrichment: ${error.message}`
    });
  }
}

// =======================
// ✅ MAIN HANDLER
// =======================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startCompanyScrape") {
    scrapeCompanyPage(message.opportunityId);
    sendResponse({ status: "Company scraping initiated" });
  }
  return true;
});