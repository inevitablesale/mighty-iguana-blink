// =======================
// ✅ UTILITIES
// =======================
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =======================
// ✅ SCRAPING LOGIC
// =======================
async function scrapeCompanyPage(opportunityId) {
  console.log(`Coogi Extension: Scraping company page for opportunity ${opportunityId}`);
  try {
    // Wait for the page to finish loading dynamic content
    await wait(4000);

    const companyData = {};

    // Scrape Company Name
    const nameEl = document.querySelector('h1.org-top-card-summary__title');
    if (nameEl) {
        companyData.name = nameEl.innerText.trim();
    }

    // Scrape Tagline
    const taglineEl = document.querySelector('p.org-top-card-summary__tagline');
    if (taglineEl) {
      companyData.tagline = taglineEl.innerText.trim().replace(/\s+/g, ' ');
    }

    // Scrape Employee Count
    const employeeLinkEl = document.querySelector('a[href*="COMPANY_PAGE_CANNED_SEARCH"] span');
    if (employeeLinkEl) {
      companyData.employeeCount = employeeLinkEl.innerText.trim();
    }

    // Scrape Industry, Location, and Follower Count
    const infoItems = document.querySelectorAll('.org-top-card-summary-info-list__info-item');
    if (infoItems.length > 0) {
        companyData.industry = infoItems[0]?.innerText.trim();
        for (let i = 1; i < infoItems.length; i++) {
            const text = infoItems[i].innerText.trim();
            if (text.toLowerCase().includes('followers')) {
                 companyData.followers = text;
            } else if (!companyData.location && !text.includes('employees')) {
                 companyData.location = text;
            }
        }
    }

    // Scrape recent posts (top 2)
    const posts = [];
    const postElements = document.querySelectorAll('div.feed-shared-update-v2');
    postElements.forEach((post, index) => {
      if (index < 2) {
        const postTextEl = post.querySelector('.update-components-text');
        if (postTextEl) {
          posts.push(postTextEl.innerText.trim().replace(/\s+/g, ' '));
        }
      }
    });
    companyData.recentPosts = posts;

    console.log("Coogi Extension: Scraped data:", companyData);
    chrome.runtime.sendMessage({
      action: "scrapedCompanyData",
      opportunityId,
      data: companyData
    });
    // Send completion message ONLY after successful scraping
    chrome.runtime.sendMessage({ action: "scrapingComplete" });

  } catch (error) {
    console.error("Coogi Extension: Error scraping company page:", error);
    chrome.runtime.sendMessage({
      action: "scrapedCompanyData",
      opportunityId,
      error: error.message
    });
    // Also send completion message on error so the tab closes
    chrome.runtime.sendMessage({ action: "scrapingComplete" });
  }
}

// =======================
// ✅ MAIN HANDLER
// =======================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startCompanyScrape") {
    scrapeCompanyPage(message.opportunityId);
    sendResponse({ status: "Company scraping started" });
  }
  return true;
});