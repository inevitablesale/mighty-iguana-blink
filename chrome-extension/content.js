// This script scrapes employee data from a LinkedIn company's "people" page.

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrollToBottom() {
  let totalHeight = 0;
  const distance = 500;
  while (totalHeight < document.body.scrollHeight) {
    window.scrollBy(0, distance);
    totalHeight += distance;
    await wait(1000);
  }
}

async function scrapePeople() {
  console.log("Coogi Extension: Scraping people page...");
  try {
    await wait(3000); // Wait for initial content to load
    await scrollToBottom(); // Scroll to load all employees
    await wait(2000); // Wait for final content to render

    const contacts = [];
    const results = document.querySelectorAll('li.org-people-profile-card');
    
    results.forEach(item => {
      const linkElement = item.querySelector('a');
      const nameElement = item.querySelector('.org-people-profile-card__profile-title');
      const titleElement = item.querySelector('.artdeco-entity-lockup__subtitle');

      if (linkElement && nameElement && titleElement) {
        const name = nameElement.innerText.trim();
        if (name.toLowerCase() !== 'linkedin member') {
          contacts.push({
            name: name,
            title: titleElement.innerText.trim().split('\n')[0],
            profileUrl: linkElement.href,
          });
        }
      }
    });

    console.log(`Coogi Extension: Found ${contacts.length} contacts.`);
    chrome.runtime.sendMessage({ action: "scrapedData", contacts });

  } catch (error) {
    console.error("Coogi Extension: Error scraping people page:", error);
    chrome.runtime.sendMessage({ action: "scrapingError", error: error.message });
  }
}

scrapePeople();