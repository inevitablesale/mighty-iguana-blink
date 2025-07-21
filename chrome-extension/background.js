// background.js
console.log("Coogi Extension: Background script started and listening for messages.");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Coogi Extension: Message received!", { message, sender });

  if (message.command === "TEST_COMMAND") {
    console.log("%cCoogi Extension: Successfully received TEST_COMMAND with data:", "color: #00ff00; font-weight: bold;", message.data);
  }
});