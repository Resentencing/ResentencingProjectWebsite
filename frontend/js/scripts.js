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
const chatModalClose = document.getElementById('chat-modal-close');
const chatModalInput = document.getElementById('chat-modal-input');
const chatModalMsgs = document.getElementById('chat-modal-messages');
const chatModalForm = document.getElementById('chat-modal-form');

/* Chat UI Functions
   - Helper functions to open/close docked and modal chat variants.
*/
function openDockedChat() {
  chatPanel.classList.remove('hidden');
  chatPanel.setAttribute('aria-hidden', 'false');
  chatToggle.setAttribute('aria-expanded', 'true');
  setTimeout(() => chatInput?.focus(), 0);
}

function closeDockedChat() {
  chatPanel.classList.add('hidden');
  chatPanel.setAttribute('aria-hidden', 'true');
  chatToggle.setAttribute('aria-expanded', 'false');
  chatToggle.focus();
}

function openModalChat() {
  chatModal.classList.remove('hidden');
  chatModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => chatModalInput?.focus(), 0);
}

function closeModalChat() {
  chatModal.classList.add('hidden');
  chatModal.setAttribute('aria-hidden', 'true');
  chatToggle.focus();
}

/* Chat Event Listeners
   - Wire up buttons to toggle between docked and full-screen chat.
*/
chatToggle?.addEventListener('click', () => {
  // On small screens, open modal; otherwise toggle docked panel
  if (window.matchMedia('(max-width: 640px)').matches) {
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
  closeDockedChat();
  openModalChat();
});
chatModalClose?.addEventListener('click', closeModalChat);

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