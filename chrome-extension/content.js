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
  const clickable = document.querySelector("a, button");
  if (clickable) clickable.focus();
}

function detectCaptchaOrRestriction() {
  return document.querySelector("input[name='captcha'], #captcha-internal, .sign-in-form");
}

// =======================
// ✅ SCRAPING LOGIC
// =======================
function scrapePeopleResults(opportunityId) {
  const listItems = document.querySelectorAll(".reusable-search__result-container");
  return Array.from(listItems).map(item => {
    const nameElement = item.querySelector(".entity-result__title-text a");
    const name = nameElement ? nameElement.innerText.split('\\n')[0].trim() : null;
    const profileUrl = nameElement ? nameElement.href : null;
    const title = item.querySelector(".entity-result__primary-subtitle")?.innerText.trim() || null;

    return {
      opportunityId,
      name,
      title,
      profileUrl,
      email: null
    };
  });
}

// =======================
// ✅ MAIN HANDLER
// =======================
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
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

        const resultsContainer = await waitForSelector(".reusable-search__results-container", SELECTOR_TIMEOUT);
        if (!resultsContainer) {
            if (retries < RETRY_LIMIT) {
              retries++;
              console.log(`Results container not found. Retrying... (${retries}/${RETRY_LIMIT})`);
              await waitRandom(Math.pow(2, retries) * 1000, Math.pow(2, retries) * 1500);
              continue;
            } else throw new Error("Could not find search results container on page.");
        }
        
        const contacts = scrapePeopleResults(opportunityId);
        allContacts.push(...contacts);
        console.log(`Found ${contacts.length} contacts on page ${currentPage}. Total: ${allContacts.length}`);

        const nextButton = document.querySelector(".artdeco-pagination__button--next");
        if (!nextButton || nextButton.disabled) {
            console.log("No more pages to scrape.");
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
      console.error("Scraping failed:", error);
      chrome.runtime.sendMessage({ action: "scrapedData", taskId, opportunityId, contacts: [], error: error.message });
    }
  }
});