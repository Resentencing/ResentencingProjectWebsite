import Chart from 'chart.js/auto';

/* Mobile Menu Toggle
   - Controls the header navigation visibility on small screens.
*/
const mobileBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

mobileBtn?.addEventListener('click', () => {
  const open = mobileBtn.getAttribute('aria-expanded') === 'true';
  mobileBtn.setAttribute('aria-expanded', String(!open));
  mobileMenu.classList.toggle('hidden');
  mobileMenu.setAttribute('aria-hidden', String(open));
  // Disable page scroll when menu is open
  document.body.style.overflow = open ? 'auto' : 'hidden';
});

/* Chat Widget Elements
   - Grab references for both docked chat and full-screen modal chat.
*/
// Docked panel elements
const chatToggle = document.getElementById('chat-toggle');
const chatPanel = document.getElementById('chat-panel');
const chatClose = document.getElementById('chat-close');
const chatExpand = document.getElementById('chat-expand');
const chatInput = document.getElementById('chat-input');
const chatMsgs = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');

// Modal elements
const chatModal = document.getElementById('chat-modal');
const chatModalCard = chatModal?.querySelector(':scope > div > div');
const chatModalClose = document.getElementById('chat-modal-close');
const chatModalInput = document.getElementById('chat-modal-input');
const chatModalMsgs = document.getElementById('chat-modal-messages');
const chatModalForm = document.getElementById('chat-modal-form');

// Track which chat UI was last active so we can sync messages between views
let lastActiveChat = 'docked'; // 'docked' | 'modal'
const mobileChatViewport = window.matchMedia('(max-width: 640px)');

function isMobileChatViewport() {
  return mobileChatViewport.matches;
}

function isChatModalOpen() {
  return chatModal?.getAttribute('aria-hidden') === 'false';
}

function syncChatMessages(fromEl, toEl) {
  if (!fromEl || !toEl) return;
  // Copy the rendered messages so both views match
  toEl.innerHTML = fromEl.innerHTML;
  toEl.scrollTop = toEl.scrollHeight;
}

/* Chat UI Functions
   - Helper functions to open/close docked and modal chat variants.
*/
function openDockedChat() {
  // If we were last chatting in the modal, sync modal -> docked
  if (lastActiveChat === 'modal') {
    syncChatMessages(chatModalMsgs, chatMsgs);
  }

  chatPanel.classList.remove('hidden');
  chatPanel.setAttribute('aria-hidden', 'false');
  chatToggle.setAttribute('aria-expanded', 'true');
  lastActiveChat = 'docked';
  setTimeout(() => chatInput?.focus(), 0);
}

function closeDockedChat() {
  chatPanel.classList.add('hidden');
  chatPanel.setAttribute('aria-hidden', 'true');
  chatToggle.setAttribute('aria-expanded', 'false');
  chatToggle.focus();
}

function openModalChat() {
  // If we were last chatting in the docked panel, sync docked -> modal
  if (lastActiveChat === 'docked') {
    syncChatMessages(chatMsgs, chatModalMsgs);
  }

  chatModal.classList.remove('hidden');
  chatModal.setAttribute('aria-hidden', 'false');
  chatToggle.setAttribute('aria-expanded', 'true');
  
  lastActiveChat = 'modal';
  setTimeout(() => chatModalInput?.focus(), 0);
}

function closeModalChat() {
  // When leaving modal, preserve modal state back into docked
  syncChatMessages(chatModalMsgs, chatMsgs);

  chatModal.classList.add('hidden');
  chatModal.setAttribute('aria-hidden', 'true');
  chatToggle.setAttribute('aria-expanded', 'false');
  
  lastActiveChat = 'docked';
  chatToggle.focus();
}

/* Chat Event Listeners
   - Wire up buttons to toggle between docked and full-screen chat.
*/
chatToggle?.addEventListener('click', () => {
  if (isChatModalOpen()) {
    closeModalChat();
    return;
  }

  // On small screens, open modal; otherwise toggle docked panel
  if (isMobileChatViewport()) {
    openModalChat();
  } else {
    if (chatPanel.getAttribute('aria-hidden') === 'true') {
      openDockedChat();
    } else {
      closeDockedChat();
    }
  }
});

chatClose?.addEventListener('click', closeDockedChat);
chatExpand?.addEventListener('click', () => {
  // Copy docked -> modal right before switching
  syncChatMessages(chatMsgs, chatModalMsgs);
  closeDockedChat();
  openModalChat();
});
chatModalClose?.addEventListener('click', closeModalChat);
chatModal?.addEventListener('click', (e) => {
  if (!isMobileChatViewport() || !chatModalCard || !(e.target instanceof Node)) {
    return;
  }

  if (!chatModalCard.contains(e.target)) {
    closeModalChat();
  }
});

/* Keyboard Navigation
   - Global Escape key handling to close chat and mobile menu.
*/
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (chatModal.getAttribute('aria-hidden') === 'false') {
      closeModalChat();
    }
    if (chatPanel.getAttribute('aria-hidden') === 'false') {
      closeDockedChat();
    }
    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
      mobileBtn.click();
    }
  }
});

/* Chat Message Functions
   - Append messages and show typing indicators in both chat UIs.
*/
function appendMsg(container, text, from = 'user') {
  const wrap = document.createElement('div');
  wrap.className = 'message-wrapper';
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble ' + from;
  bubble.textContent = text;
  wrap.appendChild(bubble);
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

// Add a temporary "typing…" bubble and return a function to remove it
function appendTyping(container) {
  const el = appendMsg(container, '…', 'bot');
  el.classList.add('typing');
  return () => {
    el.parentElement?.remove();
  };
}

/* Backend Communication
   - Call the Netlify function that proxies requests to the AI backend.
*/
const BACKEND_ENDPOINT = '/.netlify/functions/ai-proxy';
const STATS_ENDPOINT = '/.netlify/functions/stats-proxy';

async function callAI(query, { timeoutMs = 30000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  const res = await fetch(BACKEND_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: ctrl.signal
  }).catch((e) => {
    clearTimeout(t);
    throw e;
  });
  clearTimeout(t);

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {}
  
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  
  if (data && typeof data.response === 'string') {
    return data.response;
  }
  if (data && data.error) {
    throw new Error(data.error);
  }
  throw new Error('Unexpected backend response');
}

/* Stats Communication
   - Call the Netlify function that proxies requests to the stats backend.
*/
async function fetchStats(dataset, { timeoutMs = 30000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  const url = `${STATS_ENDPOINT}?dataset=${encodeURIComponent(dataset)}`;
  const res = await fetch(url, {
    method: 'GET',
    signal: ctrl.signal
  }).catch((e) => {
    clearTimeout(t);
    throw e;
  });
  clearTimeout(t);

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {}

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  if (data && Array.isArray(data.data)) {
    return data.data;
  }
  if (data && data.error) {
    throw new Error(data.error);
  }
  throw new Error('Unexpected stats response');
}

/* Homepage Charts
   - Fetch public-safe stats and render the three homepage charts.
*/
const homepageChartCards = Array.from(document.querySelectorAll('[data-chart-card]'));
const homepageCharts = new Map();

const CHART_COLORS = {
  stone: '#8b7357',
  sandstone: '#c9b18f',
  limestone: '#e2d3bf',
  slate: '#5f6a72',
  iron: '#475569',
  moss: '#5f7568',
  charcoal: '#463f35',
  grid: 'rgba(120, 102, 82, 0.16)'
};

function getChartParts(card) {
  return {
    status: card.querySelector('[data-chart-status]'),
    canvas: card.querySelector('[data-chart-canvas]')
  };
}

function setChartState(card, state, message = '') {
  const { status, canvas } = getChartParts(card);
  if (!status || !canvas) return;

  card.dataset.chartState = state;

  if (state === 'ready') {
    status.hidden = true;
    canvas.hidden = false;
    return;
  }

  status.hidden = false;
  status.textContent = message;
  canvas.hidden = true;
}

function destroyHomepageChart(dataset) {
  const chart = homepageCharts.get(dataset);
  if (chart) {
    chart.destroy();
    homepageCharts.delete(dataset);
  }
}

function renderHomepageChart(card, config) {
  const dataset = card.dataset.chartCard || '';
  const { canvas } = getChartParts(card);
  if (!canvas) return;

  destroyHomepageChart(dataset);
  canvas.hidden = false;
  homepageCharts.set(dataset, new Chart(canvas, config));
  setChartState(card, 'ready');
}

function normalizeLabel(value, fallback = 'Unknown') {
  const label = String(value || '').trim();
  return label || fallback;
}

function extractYear(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  const raw = String(value || '').trim();
  if (!raw) return NaN;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getUTCFullYear();
  }

  const yearMatch = raw.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? Number(yearMatch[0]) : NaN;
}

function summarizeYearsReduced(rows) {
  const totals = new Map();

  rows.forEach((row) => {
    const county = normalizeLabel(row.county);
    const yearsReduced = Number(row.years_reduced);
    if (!Number.isFinite(yearsReduced)) return;

    totals.set(county, (totals.get(county) || 0) + yearsReduced);
  });

  let items = Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  if (items.length > 7) {
    const topCounties = items.slice(0, 7);
    const otherTotal = items
      .slice(7)
      .reduce((sum, item) => sum + item.value, 0);

    if (otherTotal > 0) {
      topCounties.push({ label: 'Other', value: otherTotal });
    }

    items = topCounties;
  }

  return items;
}

function normalizeSentenceType(value) {
  const label = String(value || '').trim().toUpperCase();
  if (!label) return '';
  if (label.includes('ISL')) return 'ISL';
  if (label.includes('DSL')) return 'DSL';
  return '';
}

function summarizeSentenceTypes(rows) {
  const counts = new Map([
    ['ISL', 0],
    ['DSL', 0]
  ]);

  rows.forEach((row) => {
    const sentenceType = normalizeSentenceType(row.isl_dsl);
    if (!sentenceType) return;
    counts.set(sentenceType, (counts.get(sentenceType) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .filter((item) => item.value > 0);
}

function summarizeParoleEligibility(rows) {
  const counts = new Map();

  rows.forEach((row) => {
    const year = extractYear(row.parole_eligibility_date);
    if (!Number.isFinite(year)) return;

    counts.set(year, (counts.get(year) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label - b.label);
}

function createYearsReducedConfig(items) {
  return {
    type: 'bar',
    data: {
      labels: items.map((item) => item.label),
      datasets: [{
        label: 'Years Reduced',
        data: items.map((item) => item.value),
        backgroundColor: items.map((item) =>
          item.label === 'Other' ? CHART_COLORS.sandstone : CHART_COLORS.stone
        ),
        borderRadius: 0,
        borderSkipped: false
      }]
    },
    options: {
      animation: false,
      maintainAspectRatio: false,
      indexAxis: 'y',
      color: CHART_COLORS.charcoal,
      layout: {
        padding: {
          left: 4,
          right: 12,
          top: 6,
          bottom: 4
        }
      },
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: CHART_COLORS.charcoal,
            font: {
              size: 10
            }
          },
          grid: {
            color: CHART_COLORS.grid
          }
        },
        y: {
          ticks: {
            color: CHART_COLORS.charcoal,
            font: {
              size: 11
            }
          },
          grid: {
            display: false
          }
        }
      }
    }
  };
}

function createSentenceTypeConfig(items) {
  return {
    type: 'doughnut',
    data: {
      labels: items.map((item) => item.label),
      datasets: [{
        label: 'Sentence Types',
        data: items.map((item) => item.value),
        backgroundColor: [CHART_COLORS.sandstone, CHART_COLORS.slate],
        borderColor: 'rgba(246, 241, 233, 0.95)',
        borderWidth: 3,
        hoverOffset: 4
      }]
    },
    options: {
      animation: false,
      maintainAspectRatio: false,
      cutout: '62%',
      color: CHART_COLORS.charcoal,
      layout: {
        padding: {
          top: 8,
          bottom: 8
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 14,
            boxHeight: 14,
            color: CHART_COLORS.charcoal,
            font: {
              size: 11
            }
          }
        }
      }
    }
  };
}

function createParoleEligibilityConfig(items) {
  return {
    type: 'bar',
    data: {
      labels: items.map((item) => String(item.label)),
      datasets: [{
        label: 'Cases',
        data: items.map((item) => item.value),
        backgroundColor: CHART_COLORS.moss,
        borderRadius: 0,
        borderSkipped: false
      }]
    },
    options: {
      animation: false,
      maintainAspectRatio: false,
      color: CHART_COLORS.charcoal,
      layout: {
        padding: {
          right: 8,
          top: 6
        }
      },
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          ticks: {
            color: CHART_COLORS.charcoal,
            maxRotation: 60,
            minRotation: 60,
            autoSkip: true,
            maxTicksLimit: 8,
            font: {
              size: 9
            }
          },
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: CHART_COLORS.charcoal,
            font: {
              size: 10
            }
          },
          grid: {
            color: CHART_COLORS.grid
          }
        }
      }
    }
  };
}

async function loadHomepageChart(card) {
  const dataset = card.dataset.chartCard || '';
  if (!dataset) return;

  setChartState(card, 'loading', 'Loading chart...');

  try {
    const rows = await fetchStats(dataset);
    if (!rows.length) {
      destroyHomepageChart(dataset);
      setChartState(card, 'empty', 'No data available');
      return;
    }

    if (dataset === 'years_reduced') {
      const items = summarizeYearsReduced(rows);
      if (!items.length) {
        destroyHomepageChart(dataset);
        setChartState(card, 'empty', 'No data available');
        return;
      }

      renderHomepageChart(card, createYearsReducedConfig(items));
      return;
    }

    if (dataset === 'sentence_type') {
      const items = summarizeSentenceTypes(rows);
      if (!items.length) {
        destroyHomepageChart(dataset);
        setChartState(card, 'empty', 'No data available');
        return;
      }

      renderHomepageChart(card, createSentenceTypeConfig(items));
      return;
    }

    if (dataset === 'parole_eligibility') {
      const items = summarizeParoleEligibility(rows);
      if (!items.length) {
        destroyHomepageChart(dataset);
        setChartState(card, 'empty', 'No data available');
        return;
      }

      renderHomepageChart(card, createParoleEligibilityConfig(items));
      return;
    }

    destroyHomepageChart(dataset);
    setChartState(card, 'error', 'Chart unavailable');
  } catch (err) {
    destroyHomepageChart(dataset);
    setChartState(card, 'error', 'Chart unavailable');
    console.error(`Error loading chart for ${dataset}:`, err);
  }
}

async function loadHomepageCharts() {
  await Promise.allSettled(homepageChartCards.map((card) => loadHomepageChart(card)));
}

/* Form Submission Handler
   - Shared handler for both docked and modal chat forms.
*/
async function handleFormSubmit(e, inputEl, msgsEl) {
  e.preventDefault();
  const text = (inputEl.value || '').trim();
  if (!text) return;

  // Show user's message in the chat
  appendMsg(msgsEl, text, 'user');
  inputEl.value = '';

  // Show a typing indicator while we wait for the AI
  const stopTyping = appendTyping(msgsEl);

  // Disable submit button to prevent double submissions
  const btn = e.submitter || e.target.querySelector('button[type="submit"]');
  const prevDisabled = btn?.disabled;
  if (btn) btn.disabled = true;

  try {
    const answer = await callAI(text);
    stopTyping();
    appendMsg(msgsEl, answer, 'bot');
  } catch (err) {
    stopTyping();
    appendMsg(msgsEl, `Error: ${err.message || err}`, 'bot');
  } finally {
    if (btn) btn.disabled = prevDisabled ?? false;
    msgsEl.scrollTop = msgsEl.scrollHeight;
    inputEl.focus();
  }
}

/* Parallax Hero Background */
function parallaxScroll() {
  const hero = document.querySelector('.hero-section');
  if (!hero) return;

  if (isMobileChatViewport()) {
    hero.style.backgroundPositionY = '';
    return;
  }

  const offset = window.pageYOffset || document.documentElement.scrollTop || 0;
  hero.style.backgroundPositionY = `${offset * 0.5}px`;
}

window.addEventListener('scroll', parallaxScroll);
window.addEventListener('load', parallaxScroll); // optional initial position sync

/* Wire Up Forms
   - Attach submit handlers to both chat forms.
*/
chatForm?.addEventListener('submit', (e) => handleFormSubmit(e, chatInput, chatMsgs));
chatModalForm?.addEventListener('submit', (e) => handleFormSubmit(e, chatModalInput, chatModalMsgs));
loadHomepageCharts();

/* Enter to Send
   - Allow Enter to submit messages (Shift+Enter keeps new line).
*/
function enterToSend(e, formEl) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    formEl.requestSubmit();
  }
}

chatInput?.addEventListener('keydown', (e) => enterToSend(e, chatForm));
chatModalInput?.addEventListener('keydown', (e) => enterToSend(e, chatModalForm));
