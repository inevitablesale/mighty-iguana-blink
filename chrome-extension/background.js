import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const SUPABASE_URL = "https://dbtdplhlatnlzcvdvptn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRidGRwbGhsYXRubHpjdmR2cHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5NDk3MTIsImV4cCI6MjA2ODUyNTcxMn0.U3pnytCxcEoo_bJGLzjeNdt_qQ9eX8dzwezrxXOaOfA";
const ALARM_NAME = 'poll-tasks-alarm';

let supabase = null;
let supabaseChannel = null;
let userId = null;

let isTaskActive = false;
let cooldownActive = false;
const taskQueue = [];
let currentOpportunityContext = null; // Store context for multi-step scraping

// Initialize Supabase client with a specific user's token
function initSupabase(token) {
  if (!token) {
    supabase = null;
    return;
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

// Subscribe to new tasks for the logged-in user
function subscribeToTasks() {
  if (!supabase || !userId || (supabaseChannel && supabaseChannel.state === 'joined')) return;

  if (supabaseChannel) supabase.removeChannel(supabaseChannel);

  supabaseChannel = supabase
    .channel("contact_enrichment_tasks")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "contact_enrichment_tasks" }, (payload) => {
      const task = payload.new;
      if (task.status === "pending" && task.user_id === userId) {
        enqueueTask(task);
      }
    })
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') console.log("✅ Realtime subscription active for user:", userId);
      if (err) console.error("❌ Supabase subscription error:", err);
    });
}

// This function runs when the service worker starts up
async function initializeFromStorage() {
  console.log("Coogi Extension: Service worker starting...");
  const data = await chrome.storage.local.get(['token', 'userId']);
  if (data.token && data.userId) {
    console.log("Found token in storage. Initializing session.");
    userId = data.userId;
    initSupabase(data.token);
    subscribeToTasks();
    pollForPendingTasks(); // Poll immediately on startup
  } else {
    console.log("No token found in storage. Waiting for user to log in.");
  }
}

// Listen for messages from the web app
chrome.runtime.onMessageExternal.addListener(async (message, sender, sendResponse) => {
  if (message.type === "SET_TOKEN") {
    console.log("Received new token from web app.");
    userId = message.userId;
    await chrome.storage.local.set({ token: message.token, userId: message.userId });
    initSupabase(message.token);
    subscribeToTasks();
    sendResponse({ status: "Token received and stored." });
    return true;
  }

  if (message.type === "SCRAPE_COMPANY_PAGE") {
    if (!supabase) {
      sendResponse({ error: "Not authenticated." });
      return true;
    }
    console.log("Coogi Extension: Received request to scrape company page for opportunity:", message.opportunityId);
    
    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .select('linkedin_url_slug, company_name, role, location')
      .eq('id', message.opportunityId)
      .single();

    if (error || !opportunity) {
      console.error("Could not find opportunity:", error);
      sendResponse({ error: "Could not find this opportunity in the database." });
      return true;
    }

    currentOpportunityContext = {
      id: message.opportunityId,
      company_name: opportunity.company_name,
      role: opportunity.role,
      location: opportunity.location,
    };

    let targetUrl;
    let scriptToInject;

    if (opportunity.linkedin_url_slug) {
      // Happy path: direct link exists
      console.log("Direct slug found, navigating to company page.");
      targetUrl = `https://www.linkedin.com/company/${opportunity.linkedin_url_slug}/posts`;
      scriptToInject = "company-content.js";
    } else {
      // Fallback: search for the company
      console.log("No direct slug, searching for company.");
      targetUrl = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(opportunity.company_name)}`;
      scriptToInject = "company-search-content.js";
    }

    const tab = await chrome.tabs.create({ url: targetUrl, active: false });

    const tabUpdateListener = async (tabId, info) => {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(tabUpdateListener);
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [scriptToInject],
        });

        // If it's the direct scrape, send the start message
        if (scriptToInject === "company-content.js") {
          await chrome.tabs.sendMessage(tab.id, {
            action: "startCompanyScrape",
            opportunityId: message.opportunityId,
          });
        }
      }
    };
    chrome.tabs.onUpdated.addListener(tabUpdateListener);

    sendResponse({ status: "Company scrape process initiated." });
    return true;
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "scrapedCompanySearchResults") {
    if (!supabase || !currentOpportunityContext) {
      console.error("Received search results but context is missing.");
      if (sender.tab?.id) chrome.tabs.remove(sender.tab.id);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('select-linkedin-company', {
        body: { searchResults: message.results, opportunityContext: currentOpportunityContext },
      });

      if (error) throw new Error(error.message);

      // Navigate the same tab to the AI-selected URL
      await chrome.tabs.update(sender.tab.id, { url: data.url });

      // Now we need to wait for this new page to load and then inject the *other* script
      const tabUpdateListener = async (tabId, info) => {
        if (tabId === sender.tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["company-content.js"],
          });
          await chrome.tabs.sendMessage(tabId, {
            action: "startCompanyScrape",
            opportunityId: currentOpportunityContext.id,
          });
        }
      };
      chrome.tabs.onUpdated.addListener(tabUpdateListener);

    } catch (e) {
      console.error("Error during AI company selection:", e.message);
      if (sender.tab?.id) chrome.tabs.remove(sender.tab.id);
    }
  }

  if (message.action === "scrapedData") {
    const { taskId, contacts, error, opportunityId } = message;

    if (error) {
      await updateTaskStatus(taskId, "error", error);
    } else {
      await saveContacts(taskId, opportunityId, contacts);
      await updateTaskStatus(taskId, "complete");
    }

    if (sender.tab?.id) chrome.tabs.remove(sender.tab.id);
    isTaskActive = false;
    startCooldown();
    processQueue();
  }

  if (message.action === "scrapedCompanyData") {
    const { opportunityId, data, error } = message;
    if (error) {
      console.error(`Error scraping company ${opportunityId}:`, error);
    } else {
      if (!supabase) {
        console.error("Cannot save scraped company data, Supabase client not initialized.");
        return;
      }
      console.log(`Saving scraped data for opportunity ${opportunityId}`);
      const { error: updateError } = await supabase
        .from('opportunities')
        .update({ company_data_scraped: data })
        .eq('id', opportunityId);

      if (updateError) {
        console.error("Failed to save scraped company data:", updateError);
      } else {
        console.log("Successfully saved scraped company data.");
      }
    }
    currentOpportunityContext = null; // Clear context
  }

  if (message.action === "scrapingComplete") {
    if (sender.tab?.id) {
      chrome.tabs.remove(sender.tab.id);
    }
    currentOpportunityContext = null; // Clear context
  }
});

function enqueueTask(task) {
  if (!taskQueue.some(t => t.id === task.id)) {
    taskQueue.push(task);
    console.log(`📥 Task ${task.id} enqueued. Queue size: ${taskQueue.length}`);
    processQueue();
  }
}

async function processQueue() {
  if (isTaskActive || cooldownActive || taskQueue.length === 0) return;
  const nextTask = taskQueue.shift();
  console.log(`🚀 Processing task ${nextTask.id}. Queue size: ${taskQueue.length}`);
  await handleTask(nextTask);
}

async function handleTask(task) {
  isTaskActive = true;
  chrome.action.setBadgeText({ text: "RUN" });
  await updateTaskStatus(task.id, "processing");

  try {
    if (!supabase) throw new Error("Supabase client not initialized.");

    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select('linkedin_url_slug')
      .eq('id', task.opportunity_id)
      .single();

    if (oppError) {
      console.error(`Could not fetch opportunity details for task ${task.id}:`, oppError.message);
    }

    let targetUrl;
    if (opportunity && opportunity.linkedin_url_slug) {
      console.log(`Found slug, navigating to company people page: ${opportunity.linkedin_url_slug}`);
      targetUrl = `https://www.linkedin.com/company/${opportunity.linkedin_url_slug}/people/`;
    } else {
      console.log(`No slug found for opportunity ${task.opportunity_id}, falling back to search for company: ${task.company_name}`);
      targetUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(task.company_name)}`;
    }

    const tab = await chrome.tabs.create({ url: targetUrl, active: false });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    await chrome.tabs.sendMessage(tab.id, {
      action: "scrapeEmployees",
      taskId: task.id,
      opportunityId: task.opportunity_id,
    });
  } catch (error) {
    console.error(`❌ Task ${task.id} failed during setup: ${error.message}`);
    await updateTaskStatus(task.id, "error", error.message);
    isTaskActive = false;
    startCooldown();
  }
}

async function pollForPendingTasks() {
  console.log("⏰ Polling for pending tasks...");
  if (!supabase || !userId) {
    console.log("Polling skipped: Supabase client not ready.");
    return;
  }
  const { data, error } = await supabase
    .from('contact_enrichment_tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error) {
    console.error("Error polling for tasks:", error);
    return;
  }

  if (data && data.length > 0) {
    console.log(`Found ${data.length} pending tasks during poll.`);
    data.forEach(task => enqueueTask(task));
  }
}

// --- Database Helpers ---
async function updateTaskStatus(taskId, status, errorMessage = null) {
  if (!supabase) return;
  await supabase.from("contact_enrichment_tasks").update({ status, error_message: errorMessage }).eq("id", taskId);
}

async function saveContacts(taskId, opportunityId, contacts) {
    if (!supabase || contacts.length === 0) return;
    try {
        const contactsToInsert = contacts.map((c) => ({
          task_id: taskId,
          opportunity_id: opportunityId,
          user_id: userId,
          name: c.name,
          job_title: c.title,
          linkedin_profile_url: c.profileUrl,
        }));
        const { error } = await supabase.from("contacts").insert(contactsToInsert);
        if (error) throw error;
        console.log(`✅ Saved ${contacts.length} contacts for task ${taskId}`);
    } catch (err) {
        console.error(`❌ DB error for task ${taskId}: ${err.message}`);
        await updateTaskStatus(taskId, "error", `Failed to save contacts: ${err.message}`);
    }
}

// --- Utility Helpers ---
function startCooldown() {
  cooldownActive = true;
  const cooldownTime = Math.floor(Math.random() * (60000 - 20000 + 1)) + 20000;
  console.log(`⏳ Cooldown active for ${cooldownTime / 1000}s`);
  setTimeout(() => {
    cooldownActive = false;
    processQueue();
  }, cooldownTime);
}

// --- Alarm Setup ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: 1,
  });
  console.log("Task polling alarm created.");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    pollForPendingTasks();
  }
});

// Initialize the extension when the service worker starts
initializeFromStorage();