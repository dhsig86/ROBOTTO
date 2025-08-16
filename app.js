document.addEventListener('DOMContentLoaded', () => {
  const messages = document.getElementById('messages');
  const quickReplies = document.getElementById('quick-replies');
  const inputForm = document.getElementById('input-form');
  const userInput = document.getElementById('user-input');
  const consentOverlay = document.getElementById('consent');
  const startBtn = document.getElementById('start-btn');
  const lgpdCheckbox = document.getElementById('lgpd-checkbox');
  const themeToggle = document.getElementById('theme-toggle');
  const resetBtn = document.getElementById('reset-btn');

  const LGPD_KEY = 'rob-accept-lgpd';
  const THEME_KEY = 'otto-theme';

  let rules = null;

  class ChatState {
    constructor() {
      this.state = 'CONSENT';
      this.domain = '';
      this.flags = [];
      this.flagIndex = 0;
      this.currentFlag = null;
    }
  }

  let chat = new ChatState();

  // Tema
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  });

  // Carrega regras apenas uma vez
  fetch('rules_otorrino.json')
    .then(r => r.json())
    .then(data => { rules = data; });

  // Consentimento
  function showConsent() { consentOverlay.style.display = 'flex'; }
  function hideConsent() { consentOverlay.style.display = 'none'; }

  if (localStorage.getItem(LGPD_KEY)) {
    chat.state = 'INTAKE';
    hideConsent();
    botSay('Olá! Qual é a sua queixa principal?');
  } else {
    showConsent();
  }

  lgpdCheckbox.addEventListener('change', () => {
    startBtn.disabled = !lgpdCheckbox.checked;
    startBtn.classList.toggle('opacity-50', !lgpdCheckbox.checked);
  });

  startBtn.addEventListener('click', () => {
    localStorage.setItem(LGPD_KEY, 'true');
    hideConsent();
    chat.state = 'INTAKE';
    botSay('Olá! Qual é a sua queixa principal?');
  });

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function renderUser(text) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message user';
    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = text;
    wrapper.appendChild(content);
    messages.appendChild(wrapper);
    scrollToBottom();
  }

  function renderBot(text) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message bot';
    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = text;
    wrapper.appendChild(content);
    messages.appendChild(wrapper);
    scrollToBottom();
  }

  function botSay(text) {
    const temp = document.createElement('div');
    temp.className = 'message bot';
    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = 'digitando…';
    temp.appendChild(content);
    messages.appendChild(temp);
    scrollToBottom();
    setTimeout(() => {
      temp.remove();
      renderBot(text);
    }, 500);
  }

  function renderQuickReplies(options) {
    quickReplies.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rounded border px-3 py-1';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        quickReplies.querySelectorAll('button').forEach(b => b.disabled = true);
        renderUser(opt.label);
        quickReplies.innerHTML = '';
        applyAnswer(opt.value);
      });
      quickReplies.appendChild(btn);
    });
    scrollToBottom();
  }

  function classifyDomain(text) {
    const map = rules?.logic?.domain_classification_keywords || {};
    const lower = text.toLowerCase();
    for (const [domain, keywords] of Object.entries(map)) {
      if (keywords.some(k => lower.includes(k))) return domain;
    }
    return 'outro';
  }

  function askNextFlag() {
    if (chat.flagIndex >= chat.flags.length) {
      chat.state = 'ADVICE';
      showAdvice();
      return;
    }
    chat.currentFlag = chat.flags[chat.flagIndex++];
    botSay(chat.currentFlag.question);
    const opts = (rules.logic?.answer_options || []).map(o => ({ label: o, value: o }));
    renderQuickReplies(opts);
  }

  function applyAnswer(value) {
    if (chat.state !== 'ASK_FLAGS') return;
    if (value === 'Sim') {
      chat.state = 'ESCALATE';
      escalate(chat.currentFlag);
    } else {
      askNextFlag();
    }
  }

  function escalate(flag) {
    const levels = rules.logic?.escalation_levels || {};
    const level = levels[flag.urgency] || {};
    const msg = `${flag.on_true?.message || ''} ${level.cta || ''}`.trim();
    botSay(msg);
    chat.state = 'END';
  }

  function showAdvice() {
    const advice = rules.domains?.[chat.domain]?.non_urgent_advice;
    if (advice) {
      const summary = Array.isArray(advice.summary) ? advice.summary.join(' ') : (advice.summary || '');
      const safety = Array.isArray(advice.safety_net) ? advice.safety_net.join(' ') : (advice.safety_net || '');
      botSay(`${summary} ${safety}`.trim());
    } else {
      botSay('Sem orientações específicas. Procure um especialista se necessário.');
    }
    chat.state = 'END';
  }

  function handleIntake(text) {
    chat.state = 'CLASSIFY';
    chat.domain = classifyDomain(text);
    botSay(`Domínio identificado: ${chat.domain}.`);
    chat.flags = (rules?.global_red_flags || []).slice();
    const domainFlags = rules?.domains?.[chat.domain]?.red_flags || [];
    chat.flags = chat.flags.concat(domainFlags);
    chat.flagIndex = 0;
    chat.state = 'ASK_FLAGS';
    setTimeout(askNextFlag, 600);
  }

  inputForm.addEventListener('submit', e => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;
    renderUser(text);
    userInput.value = '';
    if (chat.state === 'INTAKE') {
      handleIntake(text);
    } else if (chat.state === 'ASK_FLAGS') {
      applyAnswer(text);
    }
  });

  function reset() {
    messages.innerHTML = '';
    quickReplies.innerHTML = '';
    userInput.value = '';
    chat = new ChatState();
    localStorage.removeItem(LGPD_KEY);
    showConsent();
  }

  resetBtn.addEventListener('click', reset);
});
