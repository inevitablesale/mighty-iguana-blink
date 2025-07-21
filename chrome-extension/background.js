import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const SUPABASE_URL = "https://dbtdplhlatnlzcvdvptn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRidGRwbGhsYXRubHpjdmR2cHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5NDk3MTIsImV4cCI6MjA2ODUyNTcxMn0.U3pnytCxcEoo_bJGLzjeNdt_qQ9eX8dzwezrxXOaOfA";

let supabase = null;
let supabaseChannel = null;
let userId = null;

let isTaskActive = false;
let cooldownActive = false;
const taskQueue = [];

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
  if (!supabase || !userId) return;

  // Unsubscribe from any existing channel to prevent duplicates
  if (supabaseChannel) {
    supabase.removeChannel(supabaseChannel);
    supabaseChannel = null;
  }

  supabaseChannel = supabase
    .channel("contact_enrichment_tasks")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "contact_enrichment_tasks" }, (payload) => {
      const task = payload.new;
      if (task.status === "pending" && task.user_id === userId) {
        enqueueTask(task);
      }
    })
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log("✅ Successfully subscribed to Supabase task changes for user:", userId);
      }
      if (err) {
        console.error("❌ Supabase subscription error:", err);
      }
    });
}

// This function runs when the service worker starts up
async function initializeFromStorage() {
  console.log("Coogi Extension: Service worker starting, attempting to initialize from storage.");
  const data = await chrome.storage.local.get(['token', 'userId']);
  if (data.token && data.userId) {
    console.log("Coogi Extension: Found token in storage. Initializing session.");
    userId = data.userId;
    initSupabase(data.token);
    subscribeToTasks();
  } else {
    console.log("Coogi Extension: No token found in storage. Waiting for user to log in.");
  }
}

// Listen for messages from the web app
chrome.runtime.onMessageExternal.addListener(async (message, sender, sendResponse) => {
  if (message.type === "SET_TOKEN") {
    console.log("Coogi Extension: Received new token from web app.");
    userId = message.userId;
    await chrome.storage.local.set({ token: message.token, userId: message.userId });
    initSupabase(message.token);
    subscribeToTasks();
    sendResponse({ status: "Token received and stored." });
    return true;
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
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
});

function enqueueTask(task) {
  taskQueue.push(task);
  processQueue();
}

async function processQueue() {
  if (isTaskActive || cooldownActive || taskQueue.length === 0) return;
  const nextTask = taskQueue.shift();
  await handleTask(nextTask);
}

async function handleTask(task) {
  isTaskActive = true;
  chrome.action.setBadgeText({ text: "RUN" });
  await updateTaskStatus(task.id, "processing");

  try {
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(task.company_name)}`;
    const tab = await chrome.tabs.create({ url: searchUrl, active: false });

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

// Initialize the extension when the service worker starts
initializeFromStorage();