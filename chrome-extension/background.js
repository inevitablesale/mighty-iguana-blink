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

let supabase = null;
let userId = null;

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
  broadcastStatus('idle', 'Ready and waiting for tasks.');
}

async function initializeFromStorage() {
  logger.log("Coogi Extension: Service worker starting...");
  const data = await chrome.storage.local.get(['token', 'userId']);
  if (data.token && data.userId) {
    userId = data.userId;
    initSupabase(data.token);
  } else {
    broadcastStatus('disconnected', 'Not connected. Please log in to the web app.');
  }
}

chrome.runtime.onMessageExternal.addListener(async (message, sender, sendResponse) => {
  if (message.type === "SET_TOKEN") {
    userId = message.userId;
    await chrome.storage.local.set({ token: message.token, userId: message.userId });
    initSupabase(message.token);
    sendResponse({ status: "Token received." });
    return true;
  }
});

initializeFromStorage();