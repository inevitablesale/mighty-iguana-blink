import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const SUPABASE_URL = "https://dbtdplhlatnlzcvdvptn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRidGRwbGhsYXRubHpjdmR2cHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5NDk3MTIsImV4cCI6MjA2ODUyNTcxMn0.U3pnytCxcEoo_bJGLzjeNdt_qQ9eX8dzwezrxXOaOfA";
const COOGI_APP_URL = "https://dbtdplhlatnlzcvdvptn.dyad.sh/*";

let supabase = null;
let userId = null;
let currentOpportunityContext = null;

function initSupabase(token) {
  if (!token) {
    supabase = null;
    console.log("Supabase client reset.");
    return;
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  console.log("Supabase client initialized.");
}

async function initializeFromStorage() {
  console.log("Coogi Extension: Service worker starting...");
  const data = await chrome.storage.local.get(['token', 'userId']);
  if (data.token && data.userId) {
    console.log("Found token in storage. Initializing session.");
    userId = data.userId;
    initSupabase(data.token);
  } else {
    console.log("No token found in storage. Waiting for user to log in.");
  }
}

async function startCompanyEnrichmentFlow(opportunityId) {
  if (!supabase) {
    return { error: "Not authenticated. Please log in to the web app." };
  }

  const { data: opportunity, error } = await supabase.from('opportunities').select('linkedin_url_slug, company_name, role, location').eq('id', opportunityId).single();

  if (error || !opportunity) {
    const errorMessage = `Could not find opportunity ${opportunityId}: ${error?.message}`;
    return { error: errorMessage };
  }
  
  currentOpportunityContext = { id: opportunityId, company_name: opportunity.company_name, role: opportunity.role, location: opportunity.location };
  let targetUrl, scriptToInject;

  if (opportunity.linkedin_url_slug) {
    targetUrl = `https://www.linkedin.com/company/${opportunity.linkedin_url_slug}/posts/`;
    scriptToInject = "company-content.js";
  } else {
    targetUrl = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(opportunity.company_name)}`;
    scriptToInject = "company-search-content.js";
  }

  const tab = await chrome.tabs.create({ url: targetUrl, active: false });
  const tabUpdateListener = async (tabId, info) => {
    if (tabId === tab.id && info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(tabUpdateListener);
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [scriptToInject] });
      if (scriptToInject === "company-content.js") {
        await chrome.tabs.sendMessage(tab.id, { action: "startCompanyScrape", opportunityId });
      }
    }
  };
  chrome.tabs.onUpdated.addListener(tabUpdateListener);
  return { status: "Enrichment process initiated." };
}

chrome.runtime.onMessageExternal.addListener(async (message, sender, sendResponse) => {
  if (message.type === "SET_TOKEN") {
    userId = message.userId;
    await chrome.storage.local.set({ token: message.token, userId: message.userId });
    initSupabase(message.token);
    sendResponse({ status: "Token received and stored." });
    return true;
  }
  if (message.type === "SCRAPE_COMPANY_PAGE") {
    const response = await startCompanyEnrichmentFlow(message.opportunityId);
    sendResponse(response);
    return true;
  }
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "scrapingError") {
    console.error(`Scraping failed on page: ${message.error}`);
    if (sender.tab?.id) chrome.tabs.remove(sender.tab.id);
    currentOpportunityContext = null;
    return;
  }

  if (message.action === "scrapedCompanySearchResults") {
    if (!supabase || !currentOpportunityContext) return;

    if (!message.results || message.results.length === 0) {
        console.error("Could not find any company results on the page.");
        if (sender.tab?.id) chrome.tabs.remove(sender.tab.id);
        currentOpportunityContext = null;
        return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('select-linkedin-company', { body: { searchResults: message.results, opportunityContext } });
      if (error) throw new Error(error.message);

      const destinationUrl = `${data.url.replace(/\/$/, '')}/posts/`;
      const scriptToInject = "company-content.js";
      
      await chrome.tabs.update(sender.tab.id, { url: destinationUrl });
      const tabUpdateListener = async (tabId, info) => {
        if (tabId === sender.tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);
          await chrome.scripting.executeScript({ target: { tabId }, files: [scriptToInject] });
          await chrome.tabs.sendMessage(tabId, { action: "startCompanyScrape", opportunityId: currentOpportunityContext.id });
        }
      };
      chrome.tabs.onUpdated.addListener(tabUpdateListener);
    } catch (e) { 
      console.error("Error in company selection flow:", e.message);
      if (sender.tab?.id) chrome.tabs.remove(sender.tab.id); 
    }
  }

  if (message.action === "scrapedCompanyData") {
    const { opportunityId, data, error } = message;
    if (error) {
      console.error(`Error scraping company ${opportunityId}: ${error}`);
    } else if (supabase) {
      const { error: updateError } = await supabase.from('opportunities').update({ company_data_scraped: data }).eq('id', opportunityId);
      if (updateError) console.error(`Failed to save company data: ${updateError.message}`);
      else console.log(`Successfully enriched data for opportunity ${opportunityId}`);
    }
    currentOpportunityContext = null;
  }

  if (message.action === "scrapingComplete") {
    if (sender.tab?.id) chrome.tabs.remove(sender.tab.id);
    currentOpportunityContext = null;
  }
});

initializeFromStorage();