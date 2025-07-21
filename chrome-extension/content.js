// =======================
// ✅ CONFIG
// =======================
const MAX_PAGES = 3;
const COOLDOWN_RANGE = [15000, 30000];
const RETRY_LIMIT = 3;
const SELECTOR_TIMEOUT = 8000;

// =======================
// ✅ UTILITIES
// =======================
function waitRandom(min, max) {
  return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));
}

async function waitForSelector(selector, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await waitRandom(100, 300);
  }
  return null;
}

async function waitForSpinnerToDisappear(selector = ".artdeco-spinner", timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (!document.querySelector(selector)) return true;
    await waitRandom(200, 400);
  }
  return false;
}

async function humanScrollToBottom() {
  let totalHeight = 0;
  const distance = () => Math.floor(Math.random() * (600 - 300) + 300);
  while (totalHeight < document.body.scrollHeight) {
    const scrollAmount = distance();
    window.scrollBy(0, scrollAmount);
    totalHeight += scrollAmount;
    await waitRandom(800, 1500);
  }
}

async function addBehaviorNoise() {
  window.scrollBy(0, Math.floor(Math.random() * 200));
  await waitRandom(500, 1000);
  window.scrollBy(0, -Math.floor(Math.random() * 150));
}

function detectCaptchaOrRestriction() {
  return document.querySelector("input[name='captcha'], #captcha-internal, .sign-in-form");
}

// =======================
// ✅ SCRAPING LOGIC
// =======================
function scrapeLinkedInSearchResults(opportunityId) {
  const results = document.querySelectorAll('li.reusable-search__result-container');
  const contacts = [];

  results.forEach(item => {
    const entityResult = item.querySelector('.entity-result');
    if (!entityResult) return;

    const titleElement = entityResult.querySelector('.entity-result__title-text a.app-aware-link');
    const name = titleElement ? titleElement.innerText.trim().split('\n')[0] : null;
    const profileUrl = titleElement ? titleElement.getAttribute('href') : null;

    const subtitleElement = entityResult.querySelector('.entity-result__primary-subtitle');
    const title = subtitleElement ? subtitleElement.innerText.trim() : null;

    // Skip entries that are anonymized ("LinkedIn Member")
    if (name && name.toLowerCase() !== 'linkedin member' && profileUrl) {
      contacts.push({
        opportunityId,
        name,
        title,
        profileUrl,
        email: null // Email is not available on this page
      });
    }
  });
  console.log(`Content Script: Scraped ${contacts.length} contacts from the page.`);
  return contacts;
}


// =======================
// ✅ MAIN HANDLER
// =======================
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.action === "scrapeEmployees") {
    const { taskId, opportunityId } = message;
    console.log(`🚀 Starting scrape for task ${taskId}`);

    let allContacts = [];
    let retries = 0;
    let currentPage = 1;

    try {
      await waitRandom(3000, 6000);
      await addBehaviorNoise();

      while (currentPage <= MAX_PAGES) {
        console.log(`📄 Scraping page ${currentPage}`);
        if (detectCaptchaOrRestriction()) throw new Error("CAPTCHA or login wall detected.");

        await humanScrollToBottom();
        await addBehaviorNoise();

        const searchResultsList = await waitForSelector("ul.reusable-search__results-list", SELECTOR_TIMEOUT);
        let contactsOnPage = [];

        if (searchResultsList) {
            contactsOnPage = scrapeLinkedInSearchResults(opportunityId);
        } else {
            if (retries < RETRY_LIMIT) {
                retries++;
                console.log(`Content Script: Search results list not found. Retrying... (${retries}/${RETRY_LIMIT})`);
                await waitRandom(Math.pow(2, retries) * 1000, Math.pow(2, retries) * 1500);
                continue; // Restart the while loop for the current page
            } else {
                throw new Error("LinkedIn search results page structure not found after multiple retries.");
            }
        }
        
        allContacts.push(...contactsOnPage);

        const nextButton = document.querySelector(".artdeco-pagination__button--next");
        if (!nextButton || nextButton.disabled) {
          console.log("Content Script: No 'next' button found or it is disabled. Ending scrape.");
          break;
        }

        await waitRandom(...COOLDOWN_RANGE);
        nextButton.click();
        await waitForSpinnerToDisappear();
        currentPage++;
        retries = 0; // Reset retries for the new page
      }

      chrome.runtime.sendMessage({ action: "scrapedData", taskId, opportunityId, contacts: allContacts });
    } catch (error) {
      chrome.runtime.sendMessage({ action: "scrapedData", taskId, opportunityId, contacts: [], error: error.message });
    }
  }
});