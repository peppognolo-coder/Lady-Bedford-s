# Configurazione Supabase (in 5 passi)

I file SQL sono in `supabase/sql/` e vanno eseguiti **in ordine** nello *SQL Editor* del progetto (incolla il contenuto, premi *Run*).

1. **`01_schema.sql`** — crea tabelle, sicurezza, tempo reale, menu e servizi iniziali, archivio foto `media`. Si può rieseguire senza danni (non sovrascrive menu e servizi già modificati).
2. **Crea i 4 utenti staff.** *Authentication → Users → Add user → Create new user*, con *Auto Confirm User* attivo. La password è il PIN: **6 cifre** per cucina, cassa e sala, **8 cifre** per la proprietà (diversi tra loro, non banali). Le email non devono esistere davvero.

   | Ruolo      | Email                            |
   |------------|----------------------------------|
   | Cucina     | `kitchen@staff.ladybedford.app`  |
   | Cassa      | `cashier@staff.ladybedford.app`  |
   | Sala       | `waiter@staff.ladybedford.app`   |
   | Proprietà  | `owner@staff.ladybedford.app`    |

3. **`02_ruoli_staff.sql`** — assegna i ruoli. L'ultima riga mostra i 4 ruoli assegnati: se ne vedi meno, manca un utente del passo 2.
4. **Chiavi nell'app.** Su Netlify (*Site configuration → Environment variables*) aggiungi `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (*Project Settings → API*: Project URL e anon public key), poi rifai il deploy. In locale: copia `.env.example` in `.env`. Senza queste variabili l'app parte in **modalità demo**.
5. **Disattiva le registrazioni pubbliche:** *Authentication → Sign In / Providers → Email → disattiva "Allow new users to sign up"*. Gli ordini dei clienti non richiedono account.

Dopo il deploy, in *Authentication → URL Configuration* imposta *Site URL* sull'indirizzo del sito Netlify.

## Allergeni, backup, chiusura di cassa
- **Allergeni:** i 14 allergeni UE si dichiarano per prodotto (*Menu e prezzi → Modifica*), anche calcolati dagli ingredienti della ricetta (si assegnano in *Ricettario → Ingredienti*). I clienti li vedono nel menu e possono filtrare. Finché un prodotto non ha allergeni dichiarati, l'app scrive "chiedi al personale".
- **Backup:** scheda *Dati e backup* → "Scarica backup completo" (un file JSON con tutto). Fallo ogni settimana e conservalo fuori dal dispositivo. Il piano gratuito di Supabase **non include backup automatici**, quindi questo è importante. Il ripristino riporta menu, ricette, impostazioni e contenuti; ordini e giacenze non vengono toccati.
- **Chiusura di cassa:** la cassa chiude la giornata dalla scheda *Chiusura* (contanti contati, fondo per domani, differenza). La proprietà vede lo storico in *Chiusure cassa*. Tabella `cash_closures` (già in `01_schema.sql`). Non sostituisce la chiusura fiscale del registratore telematico.

## Prenotazioni
Tavoli e afternoon tea si prenotano dall'app clienti; le richieste di altri servizi (ricevimenti, lezioni, buoni) arrivano come richieste da confermare. La proprietà decide in *Regole prenotazione*: interruttore generale, modalità di solito (**necessaria / consigliata / accesso libero**), periodi particolari (anche ogni anno, es. Natale) con una modalità diversa, orari, coperti, durata del tavolo. Sala, cassa e proprietà vedono l'elenco in *Prenotazioni*, confermano, assegnano il tavolo e inseriscono prenotazioni telefoniche. I controlli (capienza, orari, giorni chiusi, periodi) sono fatti dal database, non solo dall'app. Tabella `bookings` e funzioni `place_booking` ecc. sono già in `01_schema.sql`.

## Cambio PIN
La proprietà cambia i PIN dalla scheda **PIN di accesso** (funzione `set_staff_pin`, inclusa in `01_schema.sql`: solo la proprietà può usarla, il PIN viene salvato come hash e le sessioni del ruolo vengono chiuse). Il PIN dimenticato dalla proprietà stessa si reimposta dal pannello Supabase (*Authentication → Users*).

## Foto e contenuti
Le foto caricate dalla proprietà (scheda *Contenuti app* e foto dei prodotti) vanno nell'archivio `media` (pubblico in lettura, scrittura solo proprietà, max 5 MB, WebP/JPEG/PNG; l'app le ridimensiona prima). Testi, galleria e invito sono salvati nella riga `content` di `settings`. L'interruttore "Mostra le foto dei prodotti" è in *Menu e prezzi*.

## Chi può fare cosa (imposto dal database, non solo dall'interfaccia)
- **Clienti:** vedono menu, servizi e orari; ordinano con `place_order` (prezzi sempre ricalcolati sul server).
- **Cucina:** vede gli ordini e li sposta tra *da preparare / in preparazione / pronto*; segna prodotti esauriti.
- **Sala:** crea comande ai tavoli e segna gli ordini pronti come *serviti*. Non incassa.
- **Cassa:** come la sala, più incassi, annulli, conti per tavolo e riepilogo di giornata.
- **Proprietà:** tutto, più modifica di menu, prezzi, servizi, orari, fasce di ritiro e vendite.

## Ricettario, scorte e costi (v2.1)

Rieseguire `schema.sql` aggiunge: categoria "Cocktail analcolici", tabelle `ingredients`, `recipes`, `stock_moves`, `owner_settings` (spese e margini: solo proprietà), le funzioni `move_stock` / `set_stock` e il trigger che scarica le scorte quando la cucina porta un ordine in "preparing".

- Cucina e proprietà vedono ingredienti, ricette e movimenti; la cucina può solo registrare carichi, sprechi e inventari.
- Solo la proprietà modifica ingredienti, ricette, prezzi di acquisto, spese e margini.
- La giacenza non si scrive mai direttamente: cambia solo tramite carichi/sprechi/inventari e vendite (così resta traccia di ogni movimento).

### Ricettario della cuoca
Il PIN Cucina può scrivere ricette (anche nuove, come bozze nascoste a prezzo 0) e creare ingredienti nuovi con prezzo 0 tramite `add_ingredient` / `create_draft_item`. Prezzi di acquisto, prezzi di vendita e pubblicazione restano alla proprietà. Rieseguire `schema.sql`.


### PIN
Il PIN della **proprietà è di 8 cifre**, quello di cucina, sala e cassa di 6 (è la password dell'utente Supabase `{ruolo}@staff.ladybedford.app`). Quando crei l'utente `owner@staff.ladybedford.app` usa una password di 8 cifre non banali (non 12345678). Se cambi le lunghezze, aggiorna anche `PIN_LENGTH` in `src/api/types.ts`.

## Personale e turni
Visibili e modificabili **solo dalla proprietà** (scheda *Personale e turni*): persone con ruolo e ore da contratto, planner settimanale, assenze (riposo, ferie, permesso, malattia), straordinari e uscite anticipate, buchi di copertura e riepilogo ore. Tabelle `staff_members`, `staff_shifts`, `staff_config` con permessi riservati al ruolo `owner`: gli altri ruoli e gli anonimi non possono né leggerle né scriverle. Sono già in `01_schema.sql`: rieseguilo una volta. Personale e turni entrano anche nel backup completo e nel ripristino.
