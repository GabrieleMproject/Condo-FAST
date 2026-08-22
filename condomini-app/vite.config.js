import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function liveSyncPlugin() {
  let clients = [];
  let liveState = {
    odgList: [
      {
        id: 'odg-1',
        numero_ordine: 1,
        titolo: 'Approvazione Rendiconto Consuntivo 2025 e Riparto Spese',
        descrizione: 'Esame della gestione ordinaria e approvazione saldi.',
        stato_votazione: 'in_corso',
        tipo_quorum: 'ordinaria_maggioranza',
        quorum_millesimi_richiesto: 333.33,
        esito: 'non_votato'
      },
      {
        id: 'odg-2',
        numero_ordine: 2,
        titolo: 'Conferma o Nomina Amministratore e compenso professionale',
        descrizione: "Rinnovo incarico di gestione per l'esercizio corrente.",
        stato_votazione: 'chiusa',
        tipo_quorum: 'straordinaria_500',
        quorum_millesimi_richiesto: 500.0,
        esito: 'non_votato'
      },
      {
        id: 'odg-3',
        numero_ordine: 3,
        titolo: 'Sostituzione corpi illuminanti androne con tecnologia LED',
        descrizione: 'Proposta avanzata dai condòmini per efficientamento energetico.',
        stato_votazione: 'chiusa',
        tipo_quorum: 'ordinaria_maggioranza',
        quorum_millesimi_richiesto: 333.33,
        esito: 'non_votato'
      }
    ],
    activeOdgId: 'odg-1',
    voti: {
      'odg-1': {
        'u-1': 'favorevole',
        'u-2': 'favorevole',
        'u-3': 'contrario',
        'u-4': 'favorevole'
      }
    },
    timestamp: Date.now()
  };

  return {
    name: 'live-sync-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Header CORS universali per chiamate tra porte locali
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        const urlPath = req.url.split('?')[0];

        // Stream Server-Sent Events (SSE) ad altissima frequenza e bassissima latenza
        if (urlPath === '/api/live-sync/sse') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
          });
          res.write(`data: ${JSON.stringify(liveState)}\n\n`);
          clients.push(res);
          req.on('close', () => {
            clients = clients.filter(c => c !== res);
          });
          return;
        }

        // Endpoint di ricezione aggiornamenti dall'Amministratore
        if (urlPath === '/api/live-sync' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              liveState = { ...liveState, ...data, timestamp: Date.now() };
              const payload = `data: ${JSON.stringify(liveState)}\n\n`;
              clients.forEach(c => {
                try { c.write(payload); } catch (e) {}
              });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
            } catch (e) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // Endpoint di registrazione voto dal condòmino
        if (urlPath === '/api/live-vote' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { odgId, unitaId, voto } = JSON.parse(body);
              if (!liveState.voti) liveState.voti = {};
              if (!liveState.voti[odgId]) liveState.voti[odgId] = {};
              liveState.voti[odgId][unitaId || 'u-4'] = voto;
              liveState.timestamp = Date.now();
              const payload = `data: ${JSON.stringify(liveState)}\n\n`;
              clients.forEach(c => {
                try { c.write(payload); } catch (e) {}
              });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, voti: liveState.voti }));
            } catch (e) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // Get snapshot
        if (urlPath === '/api/live-sync' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(liveState));
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), liveSyncPlugin()],
})
