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
  const progressBar = document.getElementById('progress');

  const LGPD_KEY = 'rob-accept-lgpd';
  const THEME_KEY = 'otto-theme';
  const CHAT_KEY = 'otto-chat';

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
  let messageHistory = [];
  let lastQuickReplies = [];

  function saveChat() {
    const data = {
      chat,
      messages: messageHistory,
      quickReplies: lastQuickReplies
    };
    localStorage.setItem(CHAT_KEY, JSON.stringify(data));
  }

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

  const savedChat = localStorage.getItem(CHAT_KEY);
  if (savedChat) {
    try {
      const data = JSON.parse(savedChat);
      Object.assign(chat, data.chat || {});
      messageHistory = data.messages || [];
      messageHistory.forEach(m => {
        if (m.sender === 'user') {
          renderUser(m.text, false, m.time);
        } else {
          renderBot(m.text, false, m.time);
        }
      });
      lastQuickReplies = data.quickReplies || [];
      if (lastQuickReplies.length) renderQuickReplies(lastQuickReplies);
      if (chat.state !== 'CONSENT') {
        hideConsent();
      } else {
        showConsent();
      }
    } catch (e) {
      showConsent();
    }
  } else {
    if (localStorage.getItem(LGPD_KEY)) {
      chat.state = 'INTAKE';
      hideConsent();
      saveChat();
      botSay('Olá! Qual é a sua queixa principal?');
    } else {
      showConsent();
    }
  }

  lgpdCheckbox.addEventListener('change', () => {
    startBtn.disabled = !lgpdCheckbox.checked;
    startBtn.classList.toggle('opacity-50', !lgpdCheckbox.checked);
  });

  startBtn.addEventListener('click', () => {
    localStorage.setItem(LGPD_KEY, 'true');
    hideConsent();
    chat.state = 'INTAKE';
    saveChat();
    botSay('Olá! Qual é a sua queixa principal?');
  });

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function renderUser(text, save = true, time = new Date().toLocaleTimeString()) {
    const wrapper = document.createElement('div');
    wrapper.className = 'mb-4 flex items-end flex-row-reverse';

    const avatar = document.createElement('span');
    avatar.className = 'mx-2 text-2xl';
    avatar.textContent = '🧑';

    const bubble = document.createElement('div');
    bubble.className = 'flex flex-col items-end';

    const content = document.createElement('div');
    content.className = 'w-fit max-w-[90%] rounded-lg bg-blue-300 p-3 leading-snug text-black';
    content.textContent = text;

    const timestamp = document.createElement('span');
    timestamp.className = 'mt-1 text-xs text-gray-600';
    timestamp.textContent = time;

    bubble.appendChild(content);
    bubble.appendChild(timestamp);
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    messages.appendChild(wrapper);
    scrollToBottom();
    if (save) {
      messageHistory.push({ sender: 'user', text, time });
      saveChat();
    }
  }

  function renderBot(text, save = true, time = new Date().toLocaleTimeString()) {
    const wrapper = document.createElement('div');
    wrapper.className = 'mb-4 flex items-end';

    const avatar = document.createElement('span');
    avatar.className = 'mx-2 text-2xl';
    avatar.textContent = '🤖';

    const bubble = document.createElement('div');
    bubble.className = 'flex flex-col items-start';

    const content = document.createElement('div');
    content.className = 'w-fit max-w-[90%] rounded-lg bg-gray-100 p-3 leading-snug text-black';
    content.textContent = text;

    const timestamp = document.createElement('span');
    timestamp.className = 'mt-1 text-xs text-gray-600';
    timestamp.textContent = time;

    bubble.appendChild(content);
    bubble.appendChild(timestamp);
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    messages.appendChild(wrapper);
    scrollToBottom();
    if (save) {
      messageHistory.push({ sender: 'bot', text, time });
      saveChat();
    }
  }

  function botSay(text) {
    const temp = document.createElement('div');
    temp.className = 'mb-4 flex items-end';
    const content = document.createElement('div');
    content.className = 'w-fit max-w-[90%] rounded-lg bg-gray-100 p-3 leading-snug text-black';
    const indicator = document.createElement('div');
    indicator.className = 'flex gap-1';
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'h-2 w-2 rounded-full bg-gray-400 animate-[blink_1.4s_infinite_both]';
      dot.style.animationDelay = `${i * 0.2}s`;
      indicator.appendChild(dot);
    }
    content.appendChild(indicator);
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
    lastQuickReplies = options;
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rounded border px-3 py-1';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        quickReplies.querySelectorAll('button').forEach(b => b.disabled = true);
        renderUser(opt.label);
        quickReplies.innerHTML = '';
        lastQuickReplies = [];
        saveChat();
        applyAnswer(opt.value);
      });
      quickReplies.appendChild(btn);
    });
    scrollToBottom();
    saveChat();
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
    const progress = (chat.flagIndex + 1) / chat.flags.length;
    progressBar.value = progress;
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
    progressBar.value = 0;
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
    progressBar.value = 0;
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
    progressBar.value = 0;
    chat = new ChatState();
    messageHistory = [];
    lastQuickReplies = [];
    localStorage.removeItem(LGPD_KEY);
    localStorage.removeItem(CHAT_KEY);
    showConsent();
  }

  resetBtn.addEventListener('click', reset);
});
