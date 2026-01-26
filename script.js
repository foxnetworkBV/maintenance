// Configuration is loaded from config.js
// Make sure config.js exists (copy from config.example.js if needed)

// Utility Functions
const pad = (n) => String(n).padStart(2, '0');

// Countdown Timer
function updateCountdown() {
  const now = new Date();
  const diff = Math.max(0, CONFIG.maintenanceEnd - now);
  
  if (diff <= 0) {
    document.getElementById('countdown').innerHTML = 
      '<div class="muted">Maintenance complete — check the site.</div>';
    return;
  }

  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / 1000 / 60) % 60;
  const hours = Math.floor(diff / 1000 / 60 / 60) % 24;
  const days = Math.floor(diff / 1000 / 60 / 60 / 24);

  document.getElementById('days').textContent = pad(days);
  document.getElementById('hours').textContent = pad(hours);
  document.getElementById('minutes').textContent = pad(minutes);
  document.getElementById('seconds').textContent = pad(seconds);
}

// Email Notification Handler
async function handleEmailSubmit(e) {
  e.preventDefault();
  
  const emailInput = document.getElementById('email');
  const email = emailInput.value.trim();
  
  if (!email) {
    alert('Please enter a valid email');
    return;
  }

  try {
    const response = await fetch(CONFIG.notificationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (response.ok) {
      alert('Thanks! We received your email and will notify you when we\'re back.');
      e.target.reset();
    } else {
      throw new Error(data.error || 'Failed to send notification');
    }
  } catch (err) {
    console.error('Error sending notification:', err);
    alert('Oops! Something went wrong. Please try again later.');
  }
}

// Accessibility Enhancement
function enhanceAccessibility() {
  const title = document.getElementById('title');
  if (title) {
    title.setAttribute('tabindex', '-1');
    title.focus();
  }
}

// Initialize
function init() {
  // Start countdown
  updateCountdown();
  setInterval(updateCountdown, 1000);

  // Setup email form handler
  const notifyForm = document.getElementById('notifyForm');
  if (notifyForm) {
    notifyForm.addEventListener('submit', handleEmailSubmit);
  }

  // Enhance accessibility
  enhanceAccessibility();
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
