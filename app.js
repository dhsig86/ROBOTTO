document.addEventListener('DOMContentLoaded', () => {
  // Elementos de interface
  const consentOverlay = document.getElementById('consent-overlay');
  const startBtn       = document.getElementById('start-btn');
  const lgpdCheckbox   = document.getElementById('lgpd-checkbox');
  const messages       = document.getElementById('messages');
  const inputForm      = document.getElementById('input-form');
  const userInput      = document.getElementById('user-input');
  const resetBtn       = document.getElementById('reset-btn');
  const downloadPdfBtn = document.getElementById('download-pdf-btn');
  const feedbackForm   = document.getElementById('feedback-form');
  const feedbackComment= document.getElementById('feedback-comment');
  const feedbackRating = document.getElementById('feedback-rating');

  const FEEDBACK_ENDPOINT = '';

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
  let pdfDoc = null;

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
      pdfDoc = null;
      userInput.value = '';
      inputForm.style.display = 'block';
      lgpdCheckbox.checked = false;
      updateStartButton();
      showConsentOverlay();
      downloadPdfBtn.style.display = 'none';
      feedbackForm.style.display = 'none';
      feedbackForm.reset();
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
  downloadPdfBtn.addEventListener('click', () => {
    if (pdfDoc) {
      pdfDoc.save('triagem.pdf');
    }
  });

  feedbackForm.addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      comment: feedbackComment.value.trim(),
      rating: feedbackRating.value,
      timestamp: new Date().toISOString()
    };
    if (FEEDBACK_ENDPOINT) {
      fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(console.error);
    } else {
      const stored = JSON.parse(localStorage.getItem('feedback') || '[]');
      stored.push(data);
      localStorage.setItem('feedback', JSON.stringify(stored));
    }
    feedbackForm.reset();
    feedbackForm.style.display = 'none';
  });

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
    wrapper.className = `message message-${sender}`;

    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = text;
    wrapper.appendChild(content);

    if (extraNode) wrapper.appendChild(extraNode);

    const time = document.createElement('span');
    time.className = 'timestamp';
    time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    wrapper.appendChild(time);

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

  function buildPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const date = new Date().toLocaleString('pt-BR');
    const userMsgs = Array.from(messages.querySelectorAll('.message.user .content'));
    const queixa = userMsgs[0]?.textContent || '';
    const responses = userMsgs.slice(1).map(m => m.textContent);

    let y = 10;
    doc.text(`Data: ${date}`, 10, y); y += 10;
    doc.text(`Queixa: ${queixa}`, 10, y); y += 10;
    doc.text(`Domínio: ${currentDomain}`, 10, y); y += 10;
    doc.text('Respostas:', 10, y); y += 10;
    responses.forEach(res => {
      doc.text(`- ${res}`, 10, y);
      y += 10;
      if (y > 280) {
        doc.addPage();
        y = 10;
      }
    });
    return doc;
  }

  function finishChat() {
    finished = true;
    pdfDoc = buildPDF();
    downloadPdfBtn.style.display = 'inline';
    feedbackForm.style.display = 'flex';
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
      finishChat();
      return;
    }

    const batch = domainRules.red_flags.slice(redFlagIndex, redFlagIndex + 3);
    pendingAnswers = batch.length;

    batch.forEach(flag => {
      const btnContainer = document.createElement('div');
      btnContainer.className = 'quick-replies';

      ['Sim', 'Não', 'Não sei'].forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'quick-reply';
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
      // Desabilita todos os botões remanescentes
      document.querySelectorAll('.quick-reply').forEach(b => b.disabled = true);

      const message = flag?.on_true?.message ? `${flag.on_true.message} Consulte presencialmente um especialista.` : 'Consulte presencialmente um especialista.';
      appendMessage('bot', message);

      const link = document.createElement('a');
      link.href = 'https://www.google.com/search?q=emergencia%20otorrino';
      link.target = '_blank';
      link.textContent = 'Buscar "emergencia otorrino"';
      appendMessage('bot', 'Sugerimos procurar atendimento presencial:', link);
      finishChat();
      return;
    }

    if (pendingAnswers === 0 && !finished) {
      showNextQuestions();
    }
  }
});
