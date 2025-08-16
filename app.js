document.addEventListener('DOMContentLoaded', () => {
  // Elementos de interface
  const consentOverlay = document.getElementById('consent-overlay');
  const startBtn       = document.getElementById('start-btn');
  const lgpdCheckbox   = document.getElementById('lgpd-checkbox');
  const messages       = document.getElementById('messages');
  const inputForm      = document.getElementById('input-form');
  const userInput      = document.getElementById('user-input');
    const resetBtn       = document.getElementById('reset-btn');

  // Foco inicial e armadilhas de foco do modal de consentimento
  const overlayFocusable = consentOverlay.querySelectorAll('input, button');
  const firstOverlayEl = overlayFocusable[0];
  const lastOverlayEl = overlayFocusable[overlayFocusable.length - 1];

  function trapOverlayTab(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === firstOverlayEl) {
      e.preventDefault();
      lastOverlayEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastOverlayEl) {
      e.preventDefault();
      firstOverlayEl.focus();
    }
  }

  function maintainOverlayFocus(e) {
    if (!consentOverlay.contains(e.target)) {
      e.stopPropagation();
      firstOverlayEl.focus();
    }
  }

  function showConsentOverlay() {
    consentOverlay.style.display = 'flex';
    firstOverlayEl.focus();
    consentOverlay.addEventListener('keydown', trapOverlayTab);
    document.addEventListener('focus', maintainOverlayFocus, true);
  }

  function hideConsentOverlay() {
    consentOverlay.style.display = 'none';
    consentOverlay.removeEventListener('keydown', trapOverlayTab);
    document.removeEventListener('focus', maintainOverlayFocus, true);
    userInput.focus();
  }

  // Regras e estado da conversa
  let rules = {};
  let disclaimer = '';
  let redFlagIndex = 0;
  let pendingAnswers = 0;
  let finished = false;
  let rulesLoaded = false;
  let currentDomain = '';

    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loading';
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>Carregando...</p>';
    document.body.appendChild(loadingIndicator);

    function resetChat() {
      messages.innerHTML = '';
      redFlagIndex = 0;
      pendingAnswers = 0;
      finished = false;
      currentDomain = '';
      userInput.value = '';
      inputForm.style.display = 'block';
      lgpdCheckbox.checked = false;
      updateStartButton();
      showConsentOverlay();
    }

  // Carrega regras e disclaimer antes de iniciar o chat
  fetch('rules_otorrino.json')
    .then(r => r.json())
    .then(data => {
      rules = data;
      disclaimer = rules.legal?.disclaimer || '';
    })
    .catch(() => {
      // Fallback simples caso o arquivo não seja encontrado
      disclaimer = 'As informações fornecidas não substituem avaliação médica.';
    })
    .finally(() => {
      rulesLoaded = true;
      loadingIndicator.style.display = 'none';
      updateStartButton();
      showConsentOverlay();
    });

  // Habilita botão Start somente se checkbox + regras carregadas
  function updateStartButton() {
    startBtn.disabled = !(lgpdCheckbox.checked && rulesLoaded);
  }
  lgpdCheckbox.addEventListener('change', updateStartButton);

  resetBtn.addEventListener('click', resetChat);

  // Ao aceitar LGPD e iniciar
  startBtn.addEventListener('click', () => {
    hideConsentOverlay();
    appendMessage('bot', 'Qual sua queixa?');
  });

  // Recebe a queixa do usuário
  inputForm.addEventListener('submit', e => {
    e.preventDefault();
    if (finished) return;

    const text = userInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    currentDomain = classifyDomain(text);
    userInput.value = '';

    // Após a queixa, prossegue para red flags
    inputForm.style.display = 'none';
    showNextQuestions();
  });

  // Adiciona mensagem ao chat com disclaimer no rodapé
  function appendMessage(sender, text, extraNode = null) {
    const wrapper = document.createElement('div');
    wrapper.className = `message ${sender}`;

    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = text;
    wrapper.appendChild(content);

    if (extraNode) wrapper.appendChild(extraNode);

    const disc = document.createElement('div');
    disc.className = 'disclaimer';
    disc.textContent = disclaimer;
    wrapper.appendChild(disc);

    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
    return wrapper;
  }

  // Classificação muito simples do domínio
  function classifyDomain(text) {
    const domains = {
      ouvido:   ['ouvido', 'zumbido', 'auditivo', 'ouvidos'],
      nariz:    ['nariz', 'sangramento', 'congestao', 'sinusite'],
      garganta: ['garganta', 'dor de garganta', 'amigdala', 'tosse']
    };
    let detected = 'outro';
    const lower = text.toLowerCase();
    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some(k => lower.includes(k))) {
        detected = domain;
        break;
      }
    }
    appendMessage('bot', `Domínio identificado: ${detected}.`);
    return detected;
  }

  // Mostra até 3 perguntas de red flags por vez
  function showNextQuestions() {
    const domainRules = currentDomain && rules.domains ? rules.domains[currentDomain] : null;
    if (!domainRules?.red_flags || finished) return;

    if (redFlagIndex >= domainRules.red_flags.length) {
      // Nenhuma red flag positiva => orientação não urgente
      const summaryRaw = domainRules?.non_urgent_advice?.summary || '';
      const safetyRaw = rules.domains?.[currentDomain]?.non_urgent_advice?.safety_net || '';
      const summary = Array.isArray(summaryRaw) ? summaryRaw.join(' ') : summaryRaw;
      const safety = Array.isArray(safetyRaw) ? safetyRaw.join(' ') : safetyRaw;
      appendMessage('bot', `${summary} ${safety}`);
      finished = true;
      return;
    }

    const batch = domainRules.red_flags.slice(redFlagIndex, redFlagIndex + 3);
    pendingAnswers = batch.length;

    batch.forEach(flag => {
      const btnContainer = document.createElement('div');
      btnContainer.className = 'btn-group';

      ['Sim', 'Não', 'Não sei'].forEach(choice => {
        const btn = document.createElement('button');
        btn.textContent = choice;
        btn.addEventListener('click', () => {
          if (btnContainer.dataset.answered || finished) return;

          btnContainer.dataset.answered = 'true';
          btnContainer.querySelectorAll('button').forEach(b => b.disabled = true);

          appendMessage('user', choice);
          handleAnswer(choice, flag);
        });
        btnContainer.appendChild(btn);
      });

      appendMessage('bot', flag.question, btnContainer);
    });

    redFlagIndex += batch.length;
  }

  // Trata a resposta de cada red flag
  function handleAnswer(choice, flag) {
    pendingAnswers--;

    if (choice === 'Sim' && !finished) {
      finished = true;
      // Desabilita todos os botões remanescentes
      document.querySelectorAll('.btn-group button').forEach(b => b.disabled = true);

      const message = flag?.on_true?.message ? `${flag.on_true.message} Consulte presencialmente um especialista.` : 'Consulte presencialmente um especialista.';
      appendMessage('bot', message);

      const link = document.createElement('a');
      link.href = 'https://www.google.com/search?q=emergencia%20otorrino';
      link.target = '_blank';
      link.textContent = 'Buscar "emergencia otorrino"';
      appendMessage('bot', 'Sugerimos procurar atendimento presencial:', link);
      return;
    }

    if (pendingAnswers === 0 && !finished) {
      showNextQuestions();
    }
  }
});
