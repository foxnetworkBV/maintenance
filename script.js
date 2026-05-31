// Configuration is loaded from config.js
// Make sure config.js exists (copy from config.example.js if needed)

// Utility Functions
const pad = (n) => String(n).padStart(2, '0');

function renderStatusSteps(steps) {
  const container = document.getElementById('statusSteps');
  if (!container) return;

  container.innerHTML = '';

  steps.forEach((step) => {
    const stepEl = document.createElement('div');
    stepEl.className = `status-step status-${step.state || 'pending'}`;

    const label = document.createElement('span');
    label.className = 'step-label';
    label.textContent = step.label || 'Onbekende stap';

    const status = document.createElement('span');
    status.className = 'step-status';
    status.textContent = step.detail || (
      step.state === 'complete' ? 'Voltooid' :
      step.state === 'current' ? 'Bezig' :
      'Komt eraan'
    );

    stepEl.appendChild(label);
    stepEl.appendChild(status);
    container.appendChild(stepEl);
  });
}

function updateStatus(status) {
  if (!status || typeof status !== 'object') return;

  const labelEl = document.querySelector('.status-label');
  const percentageEl = document.querySelector('.status-percentage');
  const progressBar = document.querySelector('.progress-bar-inner');

  if (labelEl && status.statusLabel) {
    labelEl.textContent = status.statusLabel;
  }

  if (percentageEl && typeof status.progress === 'number') {
    percentageEl.textContent = `${status.progress}%`;
  }

  if (progressBar && typeof status.progress === 'number') {
    progressBar.style.width = `${status.progress}%`;
  }

  if (Array.isArray(status.steps)) {
    renderStatusSteps(status.steps);
  }
}

async function loadStatus() {
  if (!CONFIG?.statusEndpoint) return;

  try {
    const response = await fetch(CONFIG.statusEndpoint, { cache: 'no-store' });
    if (!response.ok) return;
    const status = await response.json();
    updateStatus(status);
  } catch (err) {
    console.warn('Could not load status.json:', err);
  }
}

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

  // Load dynamic status from status.json
  loadStatus();

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
