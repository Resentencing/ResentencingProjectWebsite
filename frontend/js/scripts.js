/* Mobile Menu Toggle
   - Controls the header navigation visibility on small screens.
*/
const mobileBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const mobileMenuLinks = mobileMenu ? [...mobileMenu.querySelectorAll('a')] : [];
const mobileLayoutQuery = window.matchMedia('(max-width: 767px)');

function isMobileLayout() {
  return mobileLayoutQuery.matches;
}

function isMobileMenuOpen() {
  return Boolean(mobileMenu) && !mobileMenu.classList.contains('hidden');
}

function syncBodyScrollLock() {
  const modalOpen = chatModal?.getAttribute('aria-hidden') === 'false';
  document.body.style.overflow = isMobileMenuOpen() || modalOpen ? 'hidden' : '';
}

function openMobileMenu() {
  if (!mobileBtn || !mobileMenu) return;
  mobileBtn.setAttribute('aria-expanded', 'true');
  mobileMenu.classList.remove('hidden');
  mobileMenu.setAttribute('aria-hidden', 'false');
  syncBodyScrollLock();
}

function closeMobileMenu({ focusButton = false } = {}) {
  if (!mobileBtn || !mobileMenu) return;
  mobileBtn.setAttribute('aria-expanded', 'false');
  mobileMenu.classList.add('hidden');
  mobileMenu.setAttribute('aria-hidden', 'true');
  syncBodyScrollLock();

  if (focusButton) {
    mobileBtn.focus();
  }
}

function toggleMobileMenu() {
  if (isMobileMenuOpen()) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
}

mobileBtn?.addEventListener('click', toggleMobileMenu);
mobileMenuLinks.forEach((link) => {
  link.addEventListener('click', () => {
    closeMobileMenu();
  });
});

document.addEventListener('click', (event) => {
  if (!isMobileMenuOpen() || !mobileMenu || !mobileBtn) return;

  const target = event.target;
  if (mobileMenu.contains(target) || mobileBtn.contains(target)) return;

  closeMobileMenu();
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

// Track which chat UI was last active so we can sync messages between views
let lastActiveChat = 'docked'; // 'docked' | 'modal'

function isDockedChatOpen() {
  return chatPanel?.getAttribute('aria-hidden') === 'false';
}

function isModalChatOpen() {
  return chatModal?.getAttribute('aria-hidden') === 'false';
}

function syncChatToggleA11y() {
  if (!chatToggle) return;

  const controlsId = isModalChatOpen() || isMobileLayout() ? 'chat-modal' : 'chat-panel';
  const expanded = isDockedChatOpen() || isModalChatOpen();

  chatToggle.setAttribute('aria-controls', controlsId);
  chatToggle.setAttribute('aria-expanded', String(expanded));
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
  lastActiveChat = 'docked';
  syncChatToggleA11y();
  setTimeout(() => chatInput?.focus(), 0);
}

function closeDockedChat({ focusLauncher = true } = {}) {
  chatPanel.classList.add('hidden');
  chatPanel.setAttribute('aria-hidden', 'true');
  syncChatToggleA11y();

  if (focusLauncher) {
    chatToggle?.focus();
  }
}

function openModalChat() {
  if (isMobileMenuOpen()) {
    closeMobileMenu();
  }

  // If we were last chatting in the docked panel, sync docked -> modal
  if (lastActiveChat === 'docked') {
    syncChatMessages(chatMsgs, chatModalMsgs);
  }

  chatModal.classList.remove('hidden');
  chatModal.setAttribute('aria-hidden', 'false');

  // Disable small chat button when large window is open
  chatToggle.disabled = true;
  chatToggle.setAttribute('aria-disabled', 'true');

  lastActiveChat = 'modal';
  syncBodyScrollLock();
  syncChatToggleA11y();
  setTimeout(() => chatModalInput?.focus(), 0);
}

function closeModalChat({ focusLauncher = true } = {}) {
  // When leaving modal, preserve modal state back into docked
  syncChatMessages(chatModalMsgs, chatMsgs);

  chatModal.classList.add('hidden');
  chatModal.setAttribute('aria-hidden', 'true');

  chatToggle.disabled = false;
  chatToggle.setAttribute('aria-disabled', 'false');

  lastActiveChat = 'docked';
  syncBodyScrollLock();
  syncChatToggleA11y();

  if (focusLauncher) {
    chatToggle.focus();
  }
}

/* Chat Event Listeners
   - Wire up buttons to toggle between docked and full-screen chat.
*/
chatToggle?.addEventListener('click', () => {
  if (chatToggle.disabled) return; // do nothing if window is open

  // On mobile/tablet layouts, open modal; otherwise toggle docked panel
  if (isMobileLayout()) {
    openModalChat();
  } else if (isDockedChatOpen()) {
    closeDockedChat();
  } else {
    openDockedChat();
  }
});

chatClose?.addEventListener('click', () => closeDockedChat());
chatExpand?.addEventListener('click', () => {
  // Copy docked -> modal right before switching
  syncChatMessages(chatMsgs, chatModalMsgs);
  closeDockedChat({ focusLauncher: false });
  openModalChat();
});
chatModalClose?.addEventListener('click', () => closeModalChat());

function handleResponsiveLayout() {
  if (!isMobileLayout()) {
    closeMobileMenu();
  }

  if (isMobileLayout() && isDockedChatOpen()) {
    closeDockedChat({ focusLauncher: false });
  }

  syncChatToggleA11y();
}

window.addEventListener('resize', handleResponsiveLayout);

/* Keyboard Navigation
   - Global Escape key handling to close chat and mobile menu.
*/
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (isModalChatOpen()) {
      closeModalChat();
    }
    if (isDockedChatOpen()) {
      closeDockedChat();
    }
    if (isMobileMenuOpen()) {
      closeMobileMenu({ focusButton: true });
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

// Add a temporary typing bubble and return a function to remove it
function appendTyping(container) {
  const el = appendMsg(container, '...', 'bot');
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
window.addEventListener('load', () => {
  handleResponsiveLayout();
  syncBodyScrollLock();
  syncChatToggleA11y();
  parallaxScroll();
});

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
