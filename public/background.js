// This is a placeholder background script to test the connection.
// The full scraping logic will be built upon this foundation.

console.log("Coogi Extension background script loaded.");

// Listen for messages from the web app (e.g., to set the auth token)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log("Message received from web app:", message);
  if (message.type === 'SET_TOKEN') {
    if (message.token && message.userId) {
      chrome.storage.local.set({
        'supabase_token': message.token,
        'user_id': message.userId
      }, () => {
        console.log('Token and User ID saved to extension storage.');
        sendResponse({ success: true, message: 'Token received.' });
        // Here you would initialize the Supabase client and subscribe to tasks
      });
    } else {
      console.error('Token or User ID missing in message.');
      sendResponse({ success: false, message: 'Token or User ID missing.' });
    }
  }
  // Return true to indicate you wish to send a response asynchronously
  return true;
});