if (typeof module !== 'undefined') module.exports = {};

document.addEventListener('DOMContentLoaded', () => {
  const messagesEl = document.getElementById('messages');
  const quickReplies = document.getElementById('quick-replies');
  const inputForm = document.getElementById('input-form');
  const userInput = document.getElementById('user-input');
  const consentOverlay = document.getElementById('consent');
  const startBtn = document.getElementById('start-btn');
  const lgpdCheckbox = document.getElementById('lgpd-checkbox');
  const themeToggle = document.getElementById('theme-toggle');
  const resetBtn = document.getElementById('reset-btn');
  const progressBar = document.getElementById('progress');
  const symptomOverlay = document.getElementById('symptom-overlay');
  const symptomForm = document.getElementById('symptom-form');
  const symptomOptions = document.getElementById('symptom-options');
  const skipSymptomsBtn = document.getElementById('skip-symptoms');
  const reviewSymptomsBtn = document.getElementById('review-symptoms');

  const LGPD_KEY = 'rob-accept-lgpd';
  const THEME_KEY = 'otto-theme';
  const CHAT_KEY = 'otto-chat';
  const RULES_KEY = 'otto-rules';
  const TIMESTAMP_KEY = 'otto-chat-ts';
  const MAX_CHAT_AGE = 30 * 24 * 60 * 60 * 1000; // 30 dias
  const DOCTOR_ENDPOINT = window.DOCTOR_ENDPOINT;

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
      this.symptomsOffered = false;
      this.symptoms = [];
      this.pendingIntake = '';
    }
  }

  let chat = new ChatState();
  let messageHistory = [];
  let lastQuickReplies = [];
  let editingSymptoms = false;

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

  function beginIntake() {
    chat.state = 'INTAKE';
    saveChat();
    botSay(messages.greeting);
  }

  function renderSymptoms(prefill = false) {
    const section = rules?.intake?.sections?.find(s => s.id === 'symptoms');
    const field = section?.fields?.find(f => f.id === 'symptom_checklist');
    if (!field) {
      beginIntake();
      return;
    }
    symptomOptions.innerHTML = '';
    field.choices.forEach(choice => {
      const label = document.createElement('label');
      label.className = 'flex items-center space-x-2';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = choice;
      input.name = 'symptom';
      if (prefill && chat.symptoms.includes(choice)) input.checked = true;
      label.appendChild(input);
      const span = document.createElement('span');
      span.textContent = choice;
      label.appendChild(span);
      symptomOptions.appendChild(label);
    });
    symptomOverlay.style.display = 'flex';
  }

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
      botSay(messages.greeting);
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
    beginIntake();
  });

  symptomForm.addEventListener('submit', e => {
    e.preventDefault();
    const selected = Array.from(symptomForm.querySelectorAll('input[name="symptom"]:checked')).map(i => i.value);
    symptomOverlay.style.display = 'none';
    chat.symptoms = selected;
    saveChat();

    const pending = chat.pendingIntake;
    chat.pendingIntake = '';
    handleIntake(pending);

  });

  skipSymptomsBtn.addEventListener('click', () => {
    symptomOverlay.style.display = 'none';
    chat.symptoms = [];
    saveChat();

    const pending = chat.pendingIntake;
    chat.pendingIntake = '';
    handleIntake(pending);

  });

  reviewSymptomsBtn.addEventListener('click', () => {
    editingSymptoms = true;
    renderSymptoms(true);
  });

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
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
    messagesEl.appendChild(wrapper);
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
    messagesEl.appendChild(wrapper);
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
    messagesEl.appendChild(temp);
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
    const prefix = rules.ui_texts?.global_escalation_prefix;
    const finalMsg = prefix ? `${prefix} ${msg}`.trim() : msg;
    botSay(finalMsg);
    if (rules.ui_texts?.schedule_cta) {
      botSay(rules.ui_texts.schedule_cta);
    }
    chat.state = 'END';
    progressBar.value = 0;
  }

  function showAdvice() {
    const advice = rules.domains?.[chat.domain]?.non_urgent_advice;
    if (advice) {
      const advSummary = Array.isArray(advice.summary) ? advice.summary.join(' ') : (advice.summary || '');
      const safety = Array.isArray(advice.safety_net) ? advice.safety_net.join(' ') : (advice.safety_net || '');
      const summaryText = advSummary ? `${rules.ui_texts?.advice_prefix || ''} ${advSummary}`.trim() : '';
      const safetyText = safety ? `${rules.ui_texts?.safety_net_prefix || ''} ${safety}`.trim() : '';
      const msg = `${summaryText} ${safetyText}`.trim();
      if (msg) botSay(msg);
    } else {
      botSay('Sem orientações específicas. Procure um especialista se necessário.');
    }
    if (rules.ui_texts?.schedule_cta) {
      botSay(rules.ui_texts.schedule_cta);
    }
    chat.state = 'END';
    progressBar.value = 0;

    const summary = {
      domain: chat.domain,
      symptoms: chat.symptoms,
      answers: chat.answers
    };

    quickReplies.innerHTML = '';
    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'rounded bg-green-600 px-3 py-1 text-white';
    sendBtn.textContent = 'Enviar para médico';
    sendBtn.addEventListener('click', () => {
      sendBtn.disabled = true;
      sendResultsToDoctor(summary);
    });
    quickReplies.appendChild(sendBtn);
  }

  async function sendResultsToDoctor(resumo) {
    if (!DOCTOR_ENDPOINT) {
      const json = JSON.stringify(resumo, null, 2);
      const subject = encodeURIComponent('Resumo da triagem');
      const body = encodeURIComponent(`Segue resumo da triagem:\n\n${json}`);

      const mail = document.createElement('a');
      mail.href = `mailto:?subject=${subject}&body=${body}`;
      mail.style.display = 'none';
      document.body.appendChild(mail);
      mail.click();
      document.body.removeChild(mail);

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dl = document.createElement('a');
      dl.href = url;
      dl.download = 'triagem.json';
      document.body.appendChild(dl);
      dl.click();
      document.body.removeChild(dl);
      URL.revokeObjectURL(url);

      botSay('Envio simulado. Um e-mail foi preparado e o arquivo pode ser baixado para compartilhar com um profissional.');
      return;
    }

    try {
      await fetch(DOCTOR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resumo)
      });
      botSay('Resultados enviados ao médico.');
    } catch (err) {
      console.error('Erro ao enviar resultados:', err);
      botSay('Não foi possível enviar os resultados.');
    }
  }

  function handleIntake(text) {
    if (!text) {
      if (chat.pendingIntake) {
        text = chat.pendingIntake;
        chat.pendingIntake = '';
      } else {
        return;
      }
    }
    if (!chat.symptomsOffered) {
      chat.symptomsOffered = true;
      chat.pendingIntake = text;
      saveChat();
      renderSymptoms();
      return;
    }
    chat.state = 'CLASSIFY';
    const result = classifyDomain(text, rules);
    if (result.domain === 'outro' || result.confidence < 0.4) {
      botSay(messages.classificationError);
      chat.state = 'INTAKE';
      return;
    }
    if (result.confidence < 0.7) {
      chat.proposedDomain = result.domain;
      chat.state = 'CONFIRM_DOMAIN';
      botSay(messages.confirmDomain(chat.proposedDomain));
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
      botSay(messages.askAgain);
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
    messagesEl.innerHTML = '';
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

  if (typeof module !== 'undefined') {
    module.exports.handleIntake = handleIntake;
    module.exports.chat = chat;
  }
});
