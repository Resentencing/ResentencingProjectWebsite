/* 
Mobile Menu Toggle
*/
const mobileBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

mobileBtn?.addEventListener('click', () => {
  const open = mobileBtn.getAttribute('aria-expanded') === 'true';
  mobileBtn.setAttribute('aria-expanded', String(!open));
  mobileMenu.classList.toggle('hidden');
  mobileMenu.setAttribute('aria-hidden', String(open));
  document.body.style.overflow = open ? 'auto' : 'hidden';
});

/* 
Chat Widget Elements
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

/* 
Chat UI Functions
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

/* 
Chat Event Listeners
*/
chatToggle?.addEventListener('click', () => {
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

/* 
Keyboard Navigation
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

/* 
Chat Message Functions
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

function appendTyping(container) {
  const el = appendMsg(container, '…', 'bot');
  el.classList.add('typing');
  return () => {
    el.parentElement?.remove();
  };
}

/* 
Backend Communication
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

/* 
Form Submission Handler
*/
async function handleFormSubmit(e, inputEl, msgsEl) {
  e.preventDefault();
  const text = (inputEl.value || '').trim();
  if (!text) return;

  // Show user's message
  appendMsg(msgsEl, text, 'user');
  inputEl.value = '';

  // Show typing indicator
  const stopTyping = appendTyping(msgsEl);

  // Disable submit button
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

/* 
Wire Up Forms
*/
chatForm?.addEventListener('submit', (e) => handleFormSubmit(e, chatInput, chatMsgs));
chatModalForm?.addEventListener('submit', (e) => handleFormSubmit(e, chatModalInput, chatModalMsgs));

/* 
Enter to Send
*/
function enterToSend(e, formEl) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    formEl.requestSubmit();
  }
}

chatInput?.addEventListener('keydown', (e) => enterToSend(e, chatForm));
chatModalInput?.addEventListener('keydown', (e) => enterToSend(e, chatModalForm));