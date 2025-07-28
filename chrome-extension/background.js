console.log("Coogi Background Script Loaded at:", new Date().toLocaleTimeString());

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const nativeConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
};

async function broadcastToTabs(eventName, payload) {
  const prodTabs = await chrome.tabs.query({ url: "https://dbtdplhlatnlzcvdvptn.dyad.sh/*" });
  const localTabs = await chrome.tabs.query({ url: "http://localhost:*/*" });
  const allTabs = [...prodTabs, ...localTabs];
  const uniqueTabs = Array.from(new Map(allTabs.map(tab => [tab.id, tab])).values());

  for (const tab of uniqueTabs) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (details) => {
          window.dispatchEvent(new CustomEvent(details.eventName, { detail: details.payload }));
        },
        args: [{ eventName, payload }],
        world: 'MAIN'
      });
    } catch (e) { /* Tab might not be ready, ignore */ }
  }
}

const logger = {
  log: (...args) => { nativeConsole.log(...args); broadcastToTabs('coogi-extension-log', { type: 'log', args }); },
  error: (...args) => { nativeConsole.error(...args); broadcastToTabs('coogi-extension-log', { type: 'error', args }); },
  warn: (...args) => { nativeConsole.warn(...args); broadcastToTabs('coogi-extension-log', { type: 'warn', args }); },
  info: (...args) => { nativeConsole.info(...args); broadcastToTabs('coogi-extension-log', { type: 'info', args }); },
};

const SUPABASE_URL = "https://dbtdplhlatnlzcvdvptn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRidGRwbGhsYXRubHpjdmR2cHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5NDk3MTIsImV4cCI6MjA2ODUyNTcxMn0.U3pnytCxcEoo_bJGLzjeNdt_qQ9eX8dzwezrxXOaOfA";
const ALARM_NAME = 'poll-tasks-alarm';

let supabase = null;
let supabaseChannel = null;
let userId = null;
let isTaskActive = false;
let cooldownActive = false;
const taskQueue = [];

async function broadcastStatus(status, message) {
  await broadcastToTabs('coogi-extension-status', { status, message });
}

function initSupabase(token) {
  if (!token) {
    supabase = null;
    broadcastStatus('disconnected', 'Not connected. Please log in to the web app.');
    return;
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function subscribeToTasks() {
  if (!supabase || !userId || (supabaseChannel && supabaseChannel.state === 'joined')) return;
  if (supabaseChannel) supabase.removeChannel(supabaseChannel);
  
  supabaseChannel = supabase
    .channel("contact_enrichment_tasks")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "contact_enrichment_tasks", filter: `user_id=eq.${userId}` }, (payload) => {
      if (payload.new.status === "pending") enqueueTask(payload.new);
    })
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') logger.log("✅ Realtime subscription active.");
      if (err) logger.error("❌ Supabase subscription error:", err);
    });
}

async function initializeFromStorage() {
  logger.log("Coogi Extension: Service worker starting...");
  const data = await chrome.storage.local.get(['token', 'userId']);
  if (data.token && data.userId) {
    userId = data.userId;
    initSupabase(data.token);
    subscribeToTasks();
    pollForPendingTasks();
  } else {
    broadcastStatus('disconnected', 'Not connected. Please log in to the web app.');
  }
}

chrome.runtime.onMessageExternal.addListener(async (message, sender, sendResponse) => {
  if (message.type === "SET_TOKEN") {
    userId = message.userId;
    await chrome.storage.local.set({ token: message.token, userId: message.userId });
    initSupabase(message.token);
    subscribeToTasks();
    pollForPendingTasks();
    sendResponse({ status: "Token received." });
    return true;
  }
});

function enqueueTask(task) {
  if (!taskQueue.some(t => t.id === task.id)) {
    taskQueue.push(task);
    broadcastStatus('idle', `New task for ${task.company_name} added to queue.`);
    processQueue();
  }
}

function processQueue() {
  if (isTaskActive || cooldownActive || taskQueue.length === 0) {
    if (!isTaskActive && !cooldownActive) broadcastStatus('idle', 'All tasks complete. Waiting...');
    return;
  }
  const nextTask = taskQueue.shift();
  handleTask(nextTask);
}

async function handleTask(task) {
  isTaskActive = true;
  if (chrome.action) chrome.action.setBadgeText({ text: "RUN" });
  
  try {
    await updateTaskStatus(task.id, "processing");
    broadcastStatus('active', `Searching for contacts for ${task.company_name}...`);

    const { error } = await supabase.functions.invoke('automated-contact-discovery', {
      body: { opportunityId: task.opportunity_id, taskId: task.id },
    });

    if (error) throw new Error(error.message);
    logger.log(`Successfully invoked contact discovery for task ${task.id}.`);

  } catch (e) {
    const errorMessage = `Failed to start contact discovery: ${e.message}`;
    logger.error(errorMessage);
    await updateTaskStatus(task.id, "error", errorMessage);
    broadcastStatus('error', errorMessage);
  } finally {
    finalizeTask();
  }
}

function finalizeTask() {
  if (chrome.action) chrome.action.setBadgeText({ text: "" });
  isTaskActive = false;
  startCooldown();
  processQueue();
}

async function pollForPendingTasks() {
  if (!supabase || !userId) return;
  const { data, error } = await supabase.from('contact_enrichment_tasks').select('*').eq('user_id', userId).eq('status', 'pending');
  if (error) logger.error("Error polling for tasks:", error);
  else if (data && data.length > 0) data.forEach(task => enqueueTask(task));
}

async function updateTaskStatus(taskId, status, errorMessage = null) {
  if (!supabase) return;
  await supabase.from("contact_enrichment_tasks").update({ status, error_message: errorMessage }).eq("id", taskId);
}

function startCooldown() {
  cooldownActive = true;
  const cooldownTime = Math.floor(Math.random() * (45000 - 15000 + 1)) + 15000;
  broadcastStatus('cooldown', `Taking a short break...`);
  setTimeout(() => {
    cooldownActive = false;
    processQueue();
  }, cooldownTime);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) pollForPendingTasks();
});

initializeFromStorage();