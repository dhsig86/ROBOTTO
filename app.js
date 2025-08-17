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
  const RULES_KEY = 'otto-rules';
  const TIMESTAMP_KEY = 'otto-chat-ts';
  const MAX_CHAT_AGE = 30 * 24 * 60 * 60 * 1000; // 30 dias

  let rules = null;

  class ChatState {
    constructor() {
      this.state = 'CONSENT';
      this.domain = '';
      this.proposedDomain = '';
      this.flags = [];
      this.flagIndex = 0;
      this.pendingFlags = [];
      this.answeredCount = 0;
      this.answers = {};
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
    localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
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

  function disableInteraction() {
    userInput.disabled = true;
    inputForm.querySelector('button').disabled = true;
    inputForm.classList.add('opacity-50');
    startBtn.disabled = true;
    startBtn.classList.add('opacity-50');
  }

  // Carrega regras apenas uma vez
  fetch('rules_otorrino.json')
    .then(r => r.json())
    .then(data => {
      const cachedStr = localStorage.getItem(RULES_KEY);
      if (cachedStr) {
        try {
          const cachedData = JSON.parse(cachedStr);
          if (
            cachedData.version === data.version &&
            cachedData.updated_at === data.updated_at
          ) {
            rules = cachedData;
            preprocessDomainKeywords(rules);
            return;
          }
          console.info('Cache de regras invalidado. Nova versão detectada.');
        } catch (e) {
          console.warn('Erro ao analisar cache de regras. Substituindo por nova versão.', e);
        }
      }
      rules = data;
      preprocessDomainKeywords(rules);
      localStorage.removeItem(RULES_KEY);
      localStorage.setItem(RULES_KEY, JSON.stringify(data));
    })
    .catch(err => {
      console.error('Erro ao carregar regras:', err);
      const cached = localStorage.getItem(RULES_KEY);
      if (cached) {
        try {
          rules = JSON.parse(cached);
          preprocessDomainKeywords(rules);
          botSay('Usando regras em cache offline.');
          return;
        } catch (e) {
          console.error('Erro ao carregar cache de regras:', e);
        }
      }
      botSay('Não foi possível carregar as regras. Verifique sua conexão e recarregue a página.');
      disableInteraction();
    });

  // Consentimento
  function showConsent() { consentOverlay.style.display = 'flex'; }
  function hideConsent() { consentOverlay.style.display = 'none'; }

  let savedChat = localStorage.getItem(CHAT_KEY);
  const savedTimestamp = parseInt(localStorage.getItem(TIMESTAMP_KEY), 10);
  if (savedTimestamp && Date.now() - savedTimestamp > MAX_CHAT_AGE) {
    localStorage.removeItem(CHAT_KEY);
    localStorage.removeItem(LGPD_KEY);
    localStorage.removeItem(TIMESTAMP_KEY);
    savedChat = null;
  }
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
      // Acessibilidade: rótulo e navegação por teclado
      btn.setAttribute('aria-label', opt.ariaLabel || opt.label);
      btn.tabIndex = 0;
      btn.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      });
      btn.addEventListener('click', () => {
        quickReplies.querySelectorAll('button').forEach(b => b.disabled = true);
        renderUser(opt.label);
        quickReplies.innerHTML = '';
        lastQuickReplies = [];
        saveChat();
        if (chat.state === 'CONFIRM_DOMAIN') {
          applyDomainConfirmation(opt.value);
        } else {
          applyAnswer(opt.value);
        }
      });
      quickReplies.appendChild(btn);
    });
    const firstBtn = quickReplies.querySelector('button');
    if (firstBtn) firstBtn.focus();
    scrollToBottom();
    saveChat();
  }

  // utilities for domain classification moved to classifier.js

  function askNextFlag() {
    if (chat.flagIndex >= chat.flags.length) {
      chat.state = 'ADVICE';
      showAdvice();
      return;
    }
    chat.pendingFlags = [];
    const batchSize = Math.min(rules?.logic?.ask_batch_size || 1, 3);
    while (chat.flagIndex < chat.flags.length && chat.pendingFlags.length < batchSize) {
      const flag = chat.flags[chat.flagIndex++];
      chat.pendingFlags.push(flag);
      botSay(flag.question);
    }
    const opts = (rules.logic?.answer_options || []).map(o => ({ label: o, value: o }));
    renderQuickReplies(opts);
  }

  function applyAnswer(value) {
    if (chat.state !== 'ASK_FLAGS') return;
    const flag = chat.pendingFlags.shift();
    if (!flag) return;
    chat.answers[flag.id] = value;
    chat.answeredCount++;
    progressBar.value = chat.answeredCount / chat.flags.length;
    if (value === 'Sim') {
      chat.state = 'ESCALATE';
      escalate(flag);
      return;
    }
    if (chat.pendingFlags.length) {
      const opts = (rules.logic?.answer_options || []).map(o => ({ label: o, value: o }));
      renderQuickReplies(opts);
    } else {
      askNextFlag();
    }
  }

  function escalate(flag) {
    const levels = rules.logic?.escalation_levels || {};
    const level = levels[flag.urgency] || {};
    const parts = [flag.on_true?.message];
    if (flag.on_true?.self_care) {
      const care = Array.isArray(flag.on_true.self_care)
        ? flag.on_true.self_care.join(' ')
        : flag.on_true.self_care;
      parts.push(care);
    }
    if (level.cta) {
      parts.push(level.cta);
    }
    const msg = parts.filter(Boolean).join(' ').trim();
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
    const result = classifyDomain(text);
    if (result.domain === 'outro' || result.confidence < 0.4) {
      botSay('Não consegui identificar o domínio. Pode explicar melhor?');
      chat.state = 'INTAKE';
      return;
    }
    if (result.confidence < 0.7) {
      chat.proposedDomain = result.domain;
      chat.state = 'CONFIRM_DOMAIN';
      botSay(`Você quis dizer algo relacionado a ${chat.proposedDomain}?`);
      renderQuickReplies([
        { label: 'Sim', value: 'Sim' },
        { label: 'Não', value: 'Não' }
      ]);
      return;
    }
    finalizeDomain(result.domain);
  }

  function finalizeDomain(domain) {
    chat.domain = domain;
    botSay(`Domínio identificado: ${chat.domain}.`);
    chat.flags = (rules?.global_red_flags || []).slice();
    const domainFlags = rules?.domains?.[chat.domain]?.red_flags || [];
    chat.flags = chat.flags.concat(domainFlags);
    chat.flagIndex = 0;
    chat.pendingFlags = [];
    chat.answeredCount = 0;
    chat.answers = {};
    chat.state = 'ASK_FLAGS';
    setTimeout(askNextFlag, 600);
  }

  function applyDomainConfirmation(value) {
    if (chat.state !== 'CONFIRM_DOMAIN') return;
    if (value.toLowerCase() === 'sim') {
      finalizeDomain(chat.proposedDomain);
    } else {
      botSay('Tudo bem, descreva novamente sua queixa principal.');
      chat.state = 'INTAKE';
    }
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
    } else if (chat.state === 'CONFIRM_DOMAIN') {
      applyDomainConfirmation(text);
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
    localStorage.removeItem(TIMESTAMP_KEY);
    showConsent();
  }

  resetBtn.addEventListener('click', reset);
});
