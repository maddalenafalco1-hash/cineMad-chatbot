// Disabilita il controllo dei certificati TLS auto-firmati (risolve SELF_SIGNED_CERT_IN_CHAIN generato da proxy, firewall o antivirus)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 1. Carica le variabili d'ambiente dal file .env
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 2. Middleware
app.use(cors());
app.use(express.json());

// Serve i file statici del frontend (index.html, main.js, immagini, CSS) nella root
app.use(express.static(__dirname));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim())
    });
});

// 3. Endpoint per la chat con OpenRouter (con Multi-Model Fallback del professore)
app.post('/api/chat', async (req, res) => {
    try {
        const { message, messages } = req.body;
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey || apiKey.trim() === '' || apiKey === 'tuo_api_key_di_openrouter' || apiKey === 'your_openrouter_api_key_here') {
            return res.status(500).json({
                error: 'API Key non configurata',
                details: 'Configura la tua chiave OPENROUTER_API_KEY nel file .env'
            });
        }

        // Definizione del prompt di sistema ottimizzato per CineMad (bilanciato: né papiri, né troppo corto)
        const systemPrompt = {
            role: 'system',
            content: `Sei CineMad, la guida cinematografica da poltrona più brillante, appassionata e simpatica del web.

REGOLE DI SCRITTURA:
1. **Equilibrio perfetto:** Niente papiri enciclopedici, ma nemmeno risposte troppo secche. Scrivi brevi paragrafi discorsivi o elenchi agili (circa 5-7 righe in totale) che si leggono d'un fiato e catturano subito l'attenzione.
2. **Stile e Tono:** Caldo, amichevole, leggermente ironico, come un amico esperto che ti consiglia cosa guardare davanti a una tazza di popcorn. Usa qualche emoji a tema (🎬, 🍿, 💥) per spezzare il testo.
3. **Cosa includere:** Quando consigli un film o una serie, metti in evidenza il titolo (es. Inception (2010)), spiega in modo accattivante di cosa parla senza fare spoiler, e dai una ragione irresistibile per cui vederlo stasera.
4. **Formattazione:** Parla in italiano fluidissimo. Evita simboli di formattazione complessi o asterischi (*) per mantenere la chat pulita e leggibile.`
        };

        // Costruzione dinamica del payload dei messaggi includendo la cronologia (se presente)
        let formattedMessages = [systemPrompt];

        if (Array.isArray(messages) && messages.length > 0) {
            formattedMessages = [systemPrompt, ...messages];
        } else if (message) {
            formattedMessages.push({
                role: 'user',
                content: message
            });
        }

        // Modelli da provare in sequenza (in caso di rate-limit su uno specifico provider)
        const primaryModel = process.env.OPENROUTER_MODEL || 'openrouter/free';
        const candidateModels = [
            primaryModel,
            process.env.OPENROUTER_MODEL_BACKUP,
            'openrouter/free',
            'nvidia/nemotron-3.5-lightning:free',
            'liquid/lfm-2.5-2.6b:free'
        ].filter(Boolean);

        const modelsToTry = [...new Set(candidateModels)];

        let reply = null;
        let lastErrorDetails = null;

        for (const model of modelsToTry) {
            try {
                const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey.trim()}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': `http://localhost:${PORT}`,
                        'X-Title': 'CineMad Assistant'
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: formattedMessages
                    })
                });

                if (openRouterResponse.ok) {
                    const data = await openRouterResponse.json();
                    if (data.choices && data.choices[0] && data.choices[0].message) {
                        reply = data.choices[0].message.content;
                        break;
                    }
                } else {
                    const errorText = await openRouterResponse.text();
                    lastErrorDetails = `Modello ${model} errore ${openRouterResponse.status}: ${errorText}`;
                    console.warn(lastErrorDetails);
                }
            } catch (fetchErr) {
                lastErrorDetails = fetchErr.message;
                console.warn(`Tentativo con ${model} fallito:`, fetchErr.message);
            }
        }

        if (reply) {
            return res.json({ reply });
        }

        console.error('Tutti i tentativi con i modelli OpenRouter sono falliti:', lastErrorDetails);
        return res.status(502).json({
            error: 'Nessun modello OpenRouter al momento disponibile. Riprova tra poco.',
            details: lastErrorDetails
        });

    } catch (error) {
        console.error('Errore nel server /api/chat:', error);
        res.status(500).json({ error: 'Errore interno del server.', message: error.message });
    }
});

// 4. Avvio del server
app.listen(PORT, () => {
    console.log(`🎬 Server CineMad avviato su http://localhost:${PORT}`);
    console.log(`⚡ Watch mode attivo con Express, dotenv e CORS`);
});