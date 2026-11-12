document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const chatHistory = document.getElementById('chat-history');

  if (!form || !input || !chatHistory) return;

  // 1. DEFINIZIONE DELL'ARRAY DI OGGETTI INIZIALE DELLA CHAT
  let chatMessages = [
    {
      sender: 'bot',
      avatar: 'robot.png',
      name: 'CineMad',
      text: 'Ciao! Sono CineMad, il tuo assistente personale per film e serie TV. Che genere preferisci guardare stasera?',
      timestamp: '14:05'
    },
  ];

  // Funzione per renderizzare tutti i messaggi dell'array nella pagina
  function renderChat() {
    chatHistory.innerHTML = `
      <div class="flex justify-center my-1" data-purpose="date-divider">
        <span class="text-[13px] font-medium text-slate-500 tracking-wide">Oggi</span>
      </div>
    `;

    chatMessages.forEach(msg => {
      if (msg.sender === 'user') {
        appendUserBubbleDOM(msg);
      } else {
        appendBotBubbleDOM(msg);
      }
    });

    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  // Evento di invio del modulo
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    // Aggiungiamo subito il messaggio dell'utente all'array locale
    const userMsg = {
      sender: 'user',
      avatar: 'woman.png',
      name: 'Tu',
      text: escapeHtml(text),
      timestamp: getCurrentTime()
    };

    chatMessages.push(userMsg);
    input.value = '';
    renderChat(); // Mostra subito il messaggio dell'utente nella chat

    // Chiamata al server Express con invio dell'intera cronologia
    await callServerAI();
  });

  // Funzione per interrogare il server Express passando lo storico della chat
  async function callServerAI() {
    try {
      const formattedHistory = chatMessages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages: formattedHistory })
      });

      const data = await response.json();
      
      // Utilizziamo 'let' per poter modificare il testo e rimuovere gli asterischi
      let botReplyText = data.reply || data.error || "Nessuna risposta ricevuta dal server.";

      // Rimuove gli asterischi dal testo generato dall'IA
      botReplyText = botReplyText.replace(/\*\*/g, '').replace(/\*/g, '');

      const botMsg = {
        sender: 'bot',
        avatar: 'robot.png',
        name: 'CineMad',
        text: botReplyText,
        timestamp: getCurrentTime()
      };

      chatMessages.push(botMsg);
      renderChat(); // Mostra la risposta del bot

    } catch (error) {
      console.error("Errore di connessione al server:", error);

      const errorMsg = {
        sender: 'bot',
        avatar: 'robot.png',
        name: 'CineMad',
        text: '⚠️ Errore di connessione con il server backend. Assicurati che `server.js` sia avviato nel terminale.',
        timestamp: getCurrentTime()
      };
      chatMessages.push(errorMsg);
      renderChat();
    }
  }

  // Funzioni di creazione DOM per l'utente
  function appendUserBubbleDOM(msg) {
    const userWrapper = document.createElement('div');
    userWrapper.className = 'flex flex-col items-end gap-1 ml-auto max-w-[85%]';
    userWrapper.setAttribute('data-purpose', 'user-message-wrapper');

    userWrapper.innerHTML = `
      <span class="text-[11px] font-medium text-slate-400 pr-11 mb-0.5">${msg.name}</span>
      <div class="flex items-start gap-2.5 flex-row-reverse">
        <div class="w-8 h-8 rounded-xl bg-cyan-700/60 border border-cyan-400/30 flex items-center justify-center overflow-hidden shrink-0 mt-0.5 shadow-sm">
          <img src="${msg.avatar}" alt="User Avatar" class="w-full h-full object-cover">
        </div>
        <div class="bg-[#0e7490] text-white px-4 py-3 rounded-2xl rounded-tr-sm text-[14px] leading-relaxed shadow-sm font-normal flex flex-col">
          ${msg.text}
          <span class="text-[10px] text-cyan-200/80 text-right mt-1 font-sans">${msg.timestamp}</span>
        </div>
      </div>
    `;
    chatHistory.appendChild(userWrapper);
  }

  // Funzioni di creazione DOM per il bot
  function appendBotBubbleDOM(msg) {
    const botWrapper = document.createElement('div');
    botWrapper.className = 'flex flex-col items-start gap-1 max-w-[85%]';
    botWrapper.setAttribute('data-purpose', 'bot-message-wrapper');

    botWrapper.innerHTML = `
      <span class="text-[11px] font-medium text-slate-400 pl-11 mb-0.5">${msg.name}</span>
      <div class="flex items-start gap-2.5">
        <div class="w-8 h-8 rounded-xl bg-[#0f172a] border border-cyan-500/30 flex items-center justify-center overflow-hidden shrink-0 mt-0.5 shadow-sm">
          <img src="${msg.avatar}" alt="Bot" class="w-full h-full object-cover">
        </div>
        <div class="bg-[#334155] text-slate-100 px-4 py-3 rounded-2xl rounded-tl-xs text-[14px] leading-relaxed shadow-md border border-slate-600/50 font-normal flex flex-col">
          ${msg.text}
          <span class="text-[10px] text-slate-300/80 text-right mt-1.5 font-sans tracking-wide">${msg.timestamp}</span>
        </div>
      </div>
    `;
    chatHistory.appendChild(botWrapper);
  }

  function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  renderChat();
});