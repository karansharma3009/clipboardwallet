// DOM Elements
const captureBtn = document.getElementById('captureBtn');
const clipsList = document.getElementById('clipsList');
const emptyState = document.getElementById('emptyState');
const itemCount = document.getElementById('itemCount');
const clearBtn = document.getElementById('clearBtn');
const footer = document.getElementById('footer');
const toast = document.getElementById('toast');

// Modal Elements
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');
const modalMeta = document.getElementById('modalMeta');
const modalClose = document.getElementById('modalClose');
const modalCopyBtn = document.getElementById('modalCopyBtn');
const modalDeleteBtn = document.getElementById('modalDeleteBtn');

// Storage Stats Elements
const storageText = document.getElementById('storageText');
const storageFill = document.getElementById('storageFill');

// Theme Toggle
const themeToggle = document.getElementById('themeToggle');

let currentModalClipId = null;

// Storage limit for visual indicator (5MB default, but unlimited with permission)
const STORAGE_VISUAL_LIMIT = 50 * 1024 * 1024; // 50MB for progress bar visualization

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadClips();
  initTheme();
});

// Event Listeners
captureBtn.addEventListener('click', captureClipboard);
clearBtn.addEventListener('click', clearAllClips);

// Modal Event Listeners
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
modalCopyBtn.addEventListener('click', () => {
  if (currentModalClipId) {
    copyClip(currentModalClipId);
  }
});
modalDeleteBtn.addEventListener('click', async () => {
  if (currentModalClipId) {
    await deleteClip(currentModalClipId);
    closeModal();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOverlay.classList.contains('show')) {
    closeModal();
  }
});

// Theme Toggle
themeToggle.addEventListener('click', toggleTheme);

// Capture clipboard content
async function captureClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    
    if (!text || text.trim() === '') {
      showToast('Clipboard is empty', 'error');
      return;
    }

    // Get existing clips
    const { clips = [] } = await chrome.storage.local.get('clips');
    
    // Check for duplicates
    if (clips.some(clip => clip.text === text)) {
      showToast('Already saved!', 'error');
      return;
    }

    // Add new clip
    const newClip = {
      id: Date.now(),
      text: text,
      timestamp: new Date().toISOString()
    };

    clips.unshift(newClip);
    
    // Save to storage
    await chrome.storage.local.set({ clips });
    
    // Update UI
    renderClips(clips);
    showToast('Saved to vault!', 'success');
    
  } catch (error) {
    console.error('Failed to read clipboard:', error);
    showToast('Failed to access clipboard', 'error');
  }
}

// Load clips from storage
async function loadClips() {
  const { clips = [] } = await chrome.storage.local.get('clips');
  renderClips(clips);
}

// Render clips list
function renderClips(clips) {
  // Update count
  itemCount.textContent = `${clips.length} item${clips.length !== 1 ? 's' : ''}`;
  
  // Toggle empty state and footer
  if (clips.length === 0) {
    emptyState.style.display = 'flex';
    clipsList.style.display = 'none';
    footer.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    clipsList.style.display = 'flex';
    footer.style.display = 'block';
  }

  // Render list
  clipsList.innerHTML = clips.map(clip => `
    <li class="clip-item ${clip.source === 'context-menu' ? 'from-page' : ''}" data-id="${clip.id}">
      ${clip.source === 'context-menu' ? `
        <div class="clip-source">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          </svg>
          <span title="${escapeHtml(clip.pageUrl || '')}">${escapeHtml(clip.pageTitle || 'Web page')}</span>
        </div>
      ` : ''}
      <div class="clip-content">${escapeHtml(clip.text)}</div>
      <div class="clip-actions">
        <span class="clip-time">${formatTime(clip.timestamp)}</span>
        <div class="clip-buttons">
          <button class="clip-btn copy-btn" title="Copy to clipboard" data-id="${clip.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
              <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
          <button class="clip-btn delete-btn" title="Delete" data-id="${clip.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </li>
  `).join('');

  // Add event listeners for buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyClip(btn.dataset.id);
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteClip(btn.dataset.id);
    });
  });

  // Add click listener on clip content to open expanded view
  document.querySelectorAll('.clip-item').forEach(item => {
    item.addEventListener('click', () => openModal(item.dataset.id));
  });

  // Update storage stats
  updateStorageStats();
}

// Open modal with full clip content
async function openModal(id) {
  const { clips = [] } = await chrome.storage.local.get('clips');
  const clip = clips.find(c => c.id === parseInt(id));
  
  if (!clip) return;
  
  currentModalClipId = id;
  
  // Set content
  modalContent.textContent = clip.text;
  
  // Set meta info
  if (clip.source === 'context-menu' && (clip.pageTitle || clip.pageUrl)) {
    modalMeta.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      </svg>
      <div class="modal-meta-text">
        <span class="modal-meta-title">${escapeHtml(clip.pageTitle || 'Web page')}</span>
        <span class="modal-meta-url">${escapeHtml(clip.pageUrl || '')}</span>
      </div>
      <span class="modal-meta-time">${formatTime(clip.timestamp)}</span>
    `;
    modalMeta.classList.add('show');
  } else {
    modalMeta.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 4H18C19.1046 4 20 4.89543 20 6V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V6C4 4.89543 4.89543 4 6 4H8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" stroke-width="2"/>
      </svg>
      <div class="modal-meta-text">
        <span class="modal-meta-title">Clipboard Capture</span>
      </div>
      <span class="modal-meta-time">${formatTime(clip.timestamp)}</span>
    `;
    modalMeta.classList.add('show');
  }
  
  // Show modal
  modalOverlay.classList.add('show');
}

// Close modal
function closeModal() {
  modalOverlay.classList.remove('show');
  currentModalClipId = null;
}

// Copy clip to clipboard
async function copyClip(id) {
  const { clips = [] } = await chrome.storage.local.get('clips');
  const clip = clips.find(c => c.id === parseInt(id));
  
  if (clip) {
    await navigator.clipboard.writeText(clip.text);
    showToast('Copied!', 'success');
  }
}

// Delete single clip
async function deleteClip(id) {
  const { clips = [] } = await chrome.storage.local.get('clips');
  const updatedClips = clips.filter(c => c.id !== parseInt(id));
  
  await chrome.storage.local.set({ clips: updatedClips });
  renderClips(updatedClips);
  showToast('Deleted', 'success');
}

// Clear all clips
async function clearAllClips() {
  await chrome.storage.local.set({ clips: [] });
  renderClips([]);
  showToast('All clips cleared', 'success');
}

// Format timestamp
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // Less than a minute
  if (diff < 60000) {
    return 'Just now';
  }
  
  // Less than an hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }
  
  // Less than a day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  
  // Show date
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show toast notification
function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// Calculate and display storage stats
async function updateStorageStats() {
  try {
    const { clips = [] } = await chrome.storage.local.get('clips');
    
    // Calculate size of stored data
    const dataString = JSON.stringify(clips);
    const bytes = new Blob([dataString]).size;
    
    // Format size
    const formattedSize = formatBytes(bytes);
    const clipCount = clips.length;
    
    // Update text
    storageText.textContent = `${formattedSize} used • ${clipCount} clip${clipCount !== 1 ? 's' : ''}`;
    
    // Update progress bar (visual representation)
    const percentage = Math.min((bytes / STORAGE_VISUAL_LIMIT) * 100, 100);
    storageFill.style.width = `${Math.max(percentage, 0.5)}%`;
    
    // Change color based on usage
    storageFill.classList.remove('warning', 'danger');
    if (percentage > 80) {
      storageFill.classList.add('danger');
    } else if (percentage > 50) {
      storageFill.classList.add('warning');
    }
    
  } catch (error) {
    console.error('Failed to calculate storage:', error);
    storageText.textContent = 'Unable to calculate';
  }
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

// Initialize theme from storage or system preference
async function initTheme() {
  const { theme } = await chrome.storage.local.get('theme');
  
  if (theme) {
    // User has manually set a theme
    document.documentElement.setAttribute('data-theme', theme);
  }
  // Otherwise, CSS will use prefers-color-scheme automatically
}

// Toggle between themes: auto -> light -> dark -> auto
async function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  let newTheme;
  
  if (!currentTheme) {
    // Currently on auto - switch to opposite of system
    newTheme = systemPrefersDark ? 'light' : 'dark';
  } else if (currentTheme === 'light') {
    newTheme = 'dark';
  } else {
    // Was dark, go back to auto (remove attribute)
    newTheme = null;
  }
  
  if (newTheme) {
    document.documentElement.setAttribute('data-theme', newTheme);
    await chrome.storage.local.set({ theme: newTheme });
    showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode`, 'success');
  } else {
    document.documentElement.removeAttribute('data-theme');
    await chrome.storage.local.remove('theme');
    showToast('Auto theme (system)', 'success');
  }
}

  
