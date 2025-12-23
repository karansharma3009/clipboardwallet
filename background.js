// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'sendToNotebook',
    title: 'Send to Clipboard Vault',
    contexts: ['selection']  // Only show when text is selected
  });
  
  console.log('Clipboard Vault: Context menu created');
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'sendToNotebook' && info.selectionText) {
    const selectedText = info.selectionText.trim();
    
    if (!selectedText) {
      return;
    }

    try {
      // Get existing clips
      const { clips = [] } = await chrome.storage.local.get('clips');
      
      // Check for duplicates
      if (clips.some(clip => clip.text === selectedText)) {
        // Show notification for duplicate
        showBadge('!', '#ef4444');
        return;
      }

      // Create new clip entry
      const newClip = {
        id: Date.now(),
        text: selectedText,
        timestamp: new Date().toISOString(),
        source: 'context-menu',  // Mark as coming from right-click
        pageUrl: tab?.url || '',
        pageTitle: tab?.title || ''
      };

      // Add to beginning of array
      clips.unshift(newClip);
      
      // Save to storage
      await chrome.storage.local.set({ clips });
      
      // Show success badge on extension icon
      showBadge('✓', '#22c55e');
      
      console.log('Clipboard Vault: Text saved from context menu');
      
    } catch (error) {
      console.error('Clipboard Vault: Failed to save text', error);
      showBadge('✗', '#ef4444');
    }
  }
});

// Show a temporary badge on the extension icon
function showBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  
  // Clear badge after 2 seconds
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 2000);
}

