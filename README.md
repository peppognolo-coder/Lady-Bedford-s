# Lady Bedford’s

App per sala da tè (IT/EN) — implementazione React + TypeScript + Vite del prototipo `Lady Bedford App.dc.html`, con il design system Classical (`src/classical.css`).

    npm install
    npm run dev      # sviluppo
    npm run build    # produzione in dist/ (deploy statico, es. Netlify)

- `src/data.ts`: menu, testi IT/EN, storia, servizi, immagini
- `src/App.tsx`: schermate e logica (carrello, ritiro, tessera timbri)
- Stato (lingua, nome, timbri, cestino, ordini) salvato in localStorage; nessun backend: ordini e richieste servizi sono simulati.
- Foto in `public/img/`.

## Sistema ordini e gestione

- **App cliente:** `/` — menu, servizi, orari, fasce di ritiro e consiglio del giorno arrivano dal catalogo; l’ordine da asporto va in cucina in tempo reale e il cliente ne segue lo stato.
- **Staff:** `/#staff` — ruolo + PIN a 6 cifre.
  - *Cucina*: board Da preparare / In preparazione / Pronti, note, suono per i nuovi ordini, “Esaurito”.
  - *Sala*: mappa dei tavoli (numero configurabile), comanda per tavolo, “Servito”, avviso quando un ordine è pronto.
  - *Cassa*: ordini aperti, conti per tavolo, ordini al banco, incassi contanti/carta, annulli, riepilogo di giornata.
  - *Proprietà*: modifica di menu e prezzi (IT/EN), servizi, orari, fasce di ritiro, tavoli, consiglio del giorno e prodotti in home; vendite per giorno con export CSV.
- **Database:** vedi `supabase/README.md`. I permessi per ruolo sono imposti dal database. Senza chiavi l’app gira in modalità demo (PIN prova: cucina 111111, cassa 222222, sala 333333, proprietà 44444444).
- Non incluso: scontrino fiscale (registratore telematico), pagamento online con carta, foto prodotto modificabili, notifiche email per le richieste dei servizi.


## Ricettario, scorte e costi
- **Proprietà → Ricettario**: ingredienti (confezione e prezzo di acquisto, IVA esclusa) e ricette per ogni prodotto; "Incolla elenco" importa da Excel (nome; unità; quantità; prezzo; giacenza; soglia).
- **Scorte e spesa** (anche in Cucina → Scorte): giacenze, carichi, sprechi, inventario, lista della spesa sotto soglia, movimenti. Le scorte si scaricano da sole quando la cucina preme "Inizia" su un ordine.
- **Costi e prezzi**: spese mensili ripartite per porzione + costo ingredienti → costo pieno, margine attuale e prezzo consigliato (con IVA), con pulsante "Applica".

## App installabile (PWA)
Due app installabili dallo stesso sito:
- **Clienti:** `https://tuo-sito/` — "Aggiungi a Home" (iPhone/iPad: Condividi → Aggiungi alla schermata Home; Android/Chrome: Installa app).
- **Staff:** `https://tuo-sito/staff.html` (o `/staff`) — icona verde "LB STAFF", si apre a schermo intero direttamente sull'accesso con PIN. Installala sui tablet di cucina, sala e cassa.

Note:
- Serve HTTPS (Netlify lo fornisce). `public/_redirects` fa funzionare `/staff` su Netlify.
- Senza rete l'app si avvia lo stesso (ultima versione salvata), ma ordini e stato non si aggiornano: lo staff vede la barra "Senza connessione" e le azioni non vengono salvate di nascosto.
- Gli aggiornamenti arrivano da soli; sullo staff compare "È pronta una nuova versione — Aggiorna ora", così nessuno perde un ordine a metà.
- In cucina conviene impostare il tablet in modalità app singola (iPad: Accesso Guidato; Android: blocco schermo app) e disattivare il blocco automatico.


## Accesso del personale
- **Pagina iniziale** (`/staff`): quattro pulsanti (Cucina, Sala, Cassa, Proprietà); toccandone uno si chiede il PIN di quella sezione.
- **Tablet dedicati:** ogni sezione ha il suo indirizzo e la sua icona installabile, che si apre direttamente sul PIN: `/cucina`, `/sala`, `/cassa`, `/proprieta` (icone di colore diverso).
- **Proprietà:** PIN di 8 cifre (gli altri 6). Con il suo PIN il titolare passa da una sezione all'altra dalla barra in alto, senza altri PIN. Gli altri ruoli vedono solo la propria sezione.
- **Blocco per inattività:** Cucina e Sala mai (restano sbloccate per il servizio); Cassa dopo 10 minuti; Proprietà dopo 5. Si modifica in `LOCK_BY_ROLE` e `SECTIONS` in `src/staff/Staff.tsx`.
- La sicurezza vera resta nel database: ogni ruolo riceve solo i dati che gli spettano, qualunque pulsante si tocchi.

## Pubblicazione (GitHub + Supabase + Netlify)
1. **Supabase:** crea il progetto, esegui `supabase/schema.sql` e segui `supabase/README.md` (utenti staff, ruoli).
2. **GitHub:** carica il contenuto di questa cartella in un repository **privato** (`.gitignore` esclude `node_modules`, `dist` e `.env`). Non caricare mai il file `.env`.
3. **Netlify:** "Add new site → Import from Git" e scegli il repository. Build e cartella (`npm run build`, `dist`) sono già in `netlify.toml`. In *Site configuration → Environment variables* aggiungi `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API; la chiave "anon/publishable", mai la "service_role").
4. Dopo il primo deploy: in Supabase → Authentication → URL Configuration inserisci l'indirizzo del sito; disattiva le registrazioni pubbliche.
Ogni modifica caricata su GitHub ripubblica il sito da sola.

## Contenuti e foto (proprietà)
Scheda **Contenuti app**: foto di copertina e dei servizi, storia, galleria, invito/indirizzo/telefono (IT/EN). In **Menu e prezzi**: foto per ogni prodotto e interruttore generale "Mostra le foto dei prodotti" (spento di default). Le foto richiedono Supabase Storage (vedi `supabase/README.md`).
