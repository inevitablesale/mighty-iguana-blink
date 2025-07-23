import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

// --- CONFIGURATION ---
const SUPABASE_URL = "https://dbtdplhlatnlzcvdvptn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRidGRwbGhsYXRubHpjdmR2cHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5NDk3MTIsImV4cCI6MjA2ODUyNTcxMn0.U3pnytCxcEoo_bJGLzjeNdt_qQ9eX8dzwezrxXOaOfA";
const COOGI_APP_URL = "https://dbtdplhlatnlzcvdvptn.dyad.sh/*";
const ALARM_NAME = 'poll-tasks-alarm';

// --- STATE ---
let supabase = null;
let userId = null;
let taskQueue = [];
let isTaskActive = false;
let isOnCooldown = false;
let currentTask = null;

// --- CORE FUNCTIONS ---

// Initialize the service worker on startup
async function initialize() {
  console.log("Coogi Extension: Initializing...");
  const data = await chrome.storage.local.get(['token', 'userId']);
  if (data.token && data.userId) {
    userId = data.userId;
    initSupabase(data.token);
    pollForPendingTasks();
  } else {
    broadcastStatus('disconnected', 'Please log in to the Coogi web app.');
  }
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 2 });
}

// Initialize Supabase client and subscriptions
function initSupabase(token) {
  if (!token) {
    supabase = null;
    broadcastStatus('disconnected', 'Authentication token not found.');
    return;
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  console.log("Supabase client initialized for user:", userId);
  broadcastStatus('idle', 'Connected and ready for tasks.');
}

// --- TASK QUEUE MANAGEMENT ---

function enqueueTask(task) {
  if (!taskQueue.some(t => t.id === task.id)) {
    taskQueue.push(task);
    console.log(`Task enqueued for ${task.company_name}. Queue size: ${taskQueue.length}`);
    broadcastStatus('idle', `New task for ${task.company_name} added to queue.`);
    processQueue();
  }
}

function processQueue() {
  if (isTaskActive || isOnCooldown || taskQueue.length === 0) {
    return;
  }
  isTaskActive = true;
  currentTask = taskQueue.shift();
  console.log(`Processing task for ${currentTask.company_name}.`);
  handleTask(currentTask);
}

async function handleTask(task) {
  await updateTaskStatus(task.id, "processing");
  broadcastStatus('active', `Starting search for ${task.company_name}...`);
  
  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .select('linkedin_url_slug, company_name, role, location')
    .eq('id', task.opportunity_id)
    .single();

  if (error || !opportunity) {
    return failTask(task.id, `Could not find opportunity details: ${error?.message}`);
  }

  let targetUrl, scriptToInject;
  const keywords = "human resources OR talent acquisition OR recruiter OR hiring";

  if (opportunity.linkedin_url_slug) {
    targetUrl = `https://www.linkedin.com/company/${opportunity.linkedin_url_slug}/people/?keywords=${encodeURIComponent(keywords)}`;
    scriptToInject = "content.js";
  } else {
    targetUrl = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(opportunity.company_name)}`;
    scriptToInject = "company-search-content.js";
  }
  
  openAndInject(targetUrl, scriptToInject);
}

// --- BROWSER & SCRIPTING ---

async function openAndInject(url, scriptFile) {
  try {
    const tab = await chrome.tabs.create({ url, active: false });
    const tabListener = async (tabId, info) => {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(tabListener);
        await chrome.scripting.executeScript({ target: { tabId }, files: [scriptFile] });
      }
    };
    chrome.tabs.onUpdated.addListener(tabListener);
  } catch (e) {
    failTask(currentTask.id, `Failed to open tab: ${e.message}`);
  }
}

// --- MESSAGE HANDLING ---

chrome.runtime.onMessage.addListener(async (message, sender) => {
  const tabId = sender.tab?.id;

  switch (message.action) {
    case "scrapedCompanySearchResults":
      if (!message.results || message.results.length === 0) {
        return failTask(currentTask.id, "No company results found on LinkedIn search page.", tabId);
      }
      broadcastStatus('active', `AI is selecting the correct company...`);
      const { data, error } = await supabase.functions.invoke('select-linkedin-company', {
        body: { searchResults: message.results, opportunityContext: { company_name: currentTask.company_name, role: currentTask.role, location: currentTask.location } },
      });
      if (error) {
        return failTask(currentTask.id, `AI decision failed: ${error.message}`, tabId);
      }
      const keywords = "human resources OR talent acquisition OR recruiter OR hiring";
      const destinationUrl = `${data.url.replace(/\/$/, '')}/people/?keywords=${encodeURIComponent(keywords)}`;
      await chrome.tabs.update(tabId, { url: destinationUrl });
      const listener = async (updatedTabId, info) => {
        if (updatedTabId === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      break;

    case "scrapedData":
      await saveContacts(currentTask.id, message.contacts);
      await completeTask(currentTask.id, tabId);
      break;

    case "scrapingError":
      failTask(currentTask.id, message.error, tabId);
      break;
  }
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === "SET_TOKEN") {
    userId = message.userId;
    chrome.storage.local.set({ token: message.token, userId });
    initSupabase(message.token);
    sendResponse({ status: "Token received." });
  }
  return true;
});

// --- TASK STATE & DB ---

async function pollForPendingTasks() {
  if (!supabase || !userId) return;
  const { data, error } = await supabase.from('contact_enrichment_tasks').select('*').eq('user_id', userId).eq('status', 'pending');
  if (error) console.error("Error polling for tasks:", error);
  else if (data) data.forEach(task => enqueueTask(task));
}

async function updateTaskStatus(taskId, status, errorMessage = null) {
  if (!supabase) return;
  await supabase.from("contact_enrichment_tasks").update({ status, error_message: errorMessage }).eq("id", taskId);
}

async function saveContacts(taskId, contacts) {
  if (!supabase || contacts.length === 0) return;
  broadcastStatus('active', `Found ${contacts.length} contacts. Saving...`);
  const contactsToInsert = contacts.map(c => ({ task_id: taskId, opportunity_id: currentTask.opportunity_id, user_id: userId, name: c.name, job_title: c.title, linkedin_profile_url: c.profileUrl }));
  const { error } = await supabase.from("contacts").insert(contactsToInsert);
  if (error) {
    await updateTaskStatus(taskId, "error", `Failed to save contacts: ${error.message}`);
  }
}

function failTask(taskId, reason, tabId) {
  console.error(`Task ${taskId} failed: ${reason}`);
  updateTaskStatus(taskId, "error", reason);
  broadcastStatus('error', `Task failed: ${reason}`);
  if (tabId) chrome.tabs.remove(tabId);
  startCooldown();
}

function completeTask(taskId, tabId) {
  console.log(`Task ${taskId} completed successfully.`);
  updateTaskStatus(taskId, "complete");
  broadcastStatus('idle', 'Task complete. Waiting for next task.');
  if (tabId) chrome.tabs.remove(tabId);
  startCooldown();
}

function startCooldown() {
  isTaskActive = false;
  currentTask = null;
  isOnCooldown = true;
  const cooldownTime = Math.floor(Math.random() * (30000 - 15000 + 1)) + 15000;
  broadcastStatus('cooldown', `Taking a short break...`);
  setTimeout(() => {
    isOnCooldown = false;
    processQueue();
  }, cooldownTime);
}

// --- UTILITIES ---

async function broadcastStatus(status, message) {
  try {
    const tabs = await chrome.tabs.query({ url: COOGI_APP_URL });
    for (const tab of tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (payload) => window.dispatchEvent(new CustomEvent('coogi-extension-status', { detail: payload })),
        args: [{ status, message }],
        world: 'MAIN'
      }).catch(() => {});
    }
  } catch (e) {}
}

// --- LISTENERS ---
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) pollForPendingTasks();
});