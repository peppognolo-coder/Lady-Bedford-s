# Configurazione Supabase

1. **Schema.** Nel progetto Supabase apri *SQL Editor* ed esegui `schema.sql` (si può rieseguire senza danni; non sovrascrive menu e servizi già modificati).
2. **Account staff.** In *Authentication → Users → Add user* crea quattro utenti con *Auto Confirm User* attivo.
   La password è il PIN: 6 cifre per cucina, cassa e sala, 8 per la proprietà (scegli PIN diversi). Le email non devono esistere davvero: la schermata staff le compone dal ruolo scelto.

   | Ruolo      | Email                            |
   |------------|----------------------------------|
   | Cucina     | `kitchen@staff.ladybedford.app`  |
   | Cassa      | `cashier@staff.ladybedford.app`  |
   | Sala       | `waiter@staff.ladybedford.app`   |
   | Proprietà  | `owner@staff.ladybedford.app`    |

3. **Assegna i ruoli.** Nello SQL Editor:

   ```sql
   insert into public.staff_roles (user_id, role)
   select id, split_part(email, '@', 1) from auth.users
   where email in ('kitchen@staff.ladybedford.app','cashier@staff.ladybedford.app','waiter@staff.ladybedford.app','owner@staff.ladybedford.app')
   on conflict (user_id) do update set role = excluded.role;
   ```
   (`split_part` ricava `kitchen`, `cashier`, `waiter`, `owner` dalla parte prima della @.)
4. **Chiavi nell'app.** Copia `.env.example` in `.env` e inserisci *Project URL* e *anon public key* (*Project Settings → API*).
   Senza queste variabili l'app parte in **modalità demo** (dati nel browser).
5. **Disattiva le registrazioni pubbliche:** *Authentication → Sign In / Providers → Email → disattiva "Allow new users to sign up"*.
   Gli ordini dei clienti non richiedono account.

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
