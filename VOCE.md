# English Sprint a voce: il piano

Obiettivo: il corso diventa **parlato**. Si conversa a voce con il tutor, si allena la pronuncia con un punteggio,
si simulano colloqui e riunioni di lavoro con un pagellino finale, e ogni giorno c'è un allenamento a voce di 10 minuti.
Tutto gratis (voce e microfono del browser, Groq gratuito) e senza perdere i progressi di nessuno.

## Le novità (cosa vede lo studente)

Nel menu la voce **Tutor AI** diventa **Parla** (`#/parla`), una pagina con quattro attività:

1. **Allenamento di oggi** (`#/parla/oggi`, 10 minuti): riscaldamento di pronuncia (5 frasi: prima le parole che si
   sbagliano di più, poi frasi della lezione a cui si è arrivati), poi un dialogo a voce di 4 battute sul tema della
   lezione, poi il pagellino. Conta i **giorni di fila** con l'allenamento fatto (serie da non interrompere).
2. **Conversazione** (`#/parla/conversazione`): dialogo libero a voce sul tema di una lezione o su una situazione
   (le 8 situazioni che c'erano già nel tutor). Il tutor parla con la voce migliore del dispositivo, ascolta,
   risponde. Correzioni gentili: durante il dialogo niente interruzioni, alla fine errori, frase giusta e parole da ripassare.
3. **Pronuncia** (`#/parla/pronuncia`): ripeti la frase, ricevi un punteggio 0-100 con le parole colorate
   (giusta, quasi, mancante). Riascolti la tua voce e quella giusta, anche rallentata. Le parole sbagliate entrano
   in un **ripasso di pronuncia a intervalli** (tornano dopo 1, 3, 7, 15 giorni se le dici bene).
4. **Simulazioni di lavoro** (`#/parla/simulazione/<id>`): colloqui per consulenza, coordinamento/project management,
   presales, accessibilità; riunione con un cliente; presentare un audit di accessibilità; telefonata; small talk.
   Il tutor recita la parte (selezionatore, cliente, collega). Alla fine il **pagellino**: fluidità, vocabolario,
   grammatica, obiettivo raggiunto (1-10), punteggio 0-100, errori con la frase giusta, frasi utili da imparare,
   una risposta migliorata. Lo storico mostra se il punteggio migliora nel tempo.

Nelle **lezioni** si aggiunge l'ultima parte, **Dialogo a voce** (`#/lezione/N/talk`): 4 battute con il tutor sugli
argomenti della lezione, usando le sue parole e frasi; il pagellino dice quali parole della lezione sono state usate.
Le lezioni già finite restano finite (hanno già `completedAt`).

## Voce e microfono

- **Riconoscimento**: Web Speech API (Chrome, Edge, Safari). In più, quando si può, si registra l'audio con
  `MediaRecorder` (serve per riascoltarsi). Dove il riconoscimento del browser non c'è (Firefox) o non capisce niente,
  l'audio va a **Groq Whisper** (`whisper-large-v3-turbo`, gratuito) tramite `api/?r=stt`.
- **Mani libere** nei dialoghi: dopo che il tutor ha parlato il microfono si apre da solo; 2,5 secondi di silenzio
  chiudono il turno. Si può sempre toccare per finire o scrivere al posto di parlare.
- **Voce del tutor**: sintesi del browser, con la classifica delle voci migliorata (le "Natural"/"Online" di Edge,
  Google, Siri "Avanzate/Premium"; poi le altre). Personaggi diversi usano la prima o la seconda voce inglese.
- **Pronuncia senza AI**: il punteggio confronta il testo riconosciuto (con le alternative del riconoscitore)
  con quello atteso, parola per parola (allineamento + tolleranza per piccoli errori). Zero chiamate AI.

## Uso dell'AI dentro i limiti

Limiti che restano uguali: senza account 30 risposte AI al giorno e 6 al minuto per IP, 300 al giorno in tutto
(modello `qwen/qwen3.8-27b`, riserva `openai/gpt-oss-20b`); con l'account del portale 400 al giorno.

| Attività | Chiamate AI |
|---|---|
| Pronuncia | 0 |
| Allenamento di oggi | 3 battute + 1 pagellino = 4 |
| Dialogo a fine lezione | 4 battute + 1 pagellino = 5 |
| Conversazione libera | fino a 6 battute + 1 = 7 |
| Simulazione | 6 battute + 1 pagellino = 7 (la prima domanda è già scritta: non costa) |

Come si sta dentro i limiti e cosa succede quando finiscono:
- Ogni attività dice prima quante risposte AI usa e quante ne restano oggi.
- La prima battuta del tutor è **scritta in anticipo** (niente AI). Ogni simulazione ha 6-8 domande già scritte.
- Il client tiene il conto delle chiamate dell'ultimo minuto: se sono già 6 aspetta il secondo giusto invece di
  sbattere contro il limite (il tutor "pensa" un attimo).
- Se le risposte AI rimaste non bastano, il dialogo usa l'AI solo per le battute che può e poi continua con le
  **domande già scritte** (modalità senza AI): il dialogo non si interrompe mai.
- Il **pagellino locale** c'è sempre (senza AI): fluidità (parole al minuto, lunghezza delle risposte),
  vocabolario (varietà, parole e frasi della lezione o della simulazione usate). La grammatica la valuta solo l'AI.
- Se l'AI per il pagellino non c'è, la trascrizione resta **in attesa** (max 5) e si può chiedere la correzione
  completa il giorno dopo con un tocco (1 chiamata).
- Whisper ha tetti suoi, separati: 40 trascrizioni al giorno e 10 al minuto per IP, 400 al giorno in tutto (tabella
  `eng_ai_limit`, bucket `s…`), e si usa solo se il riconoscimento del browser manca o fallisce.

## Dati e sicurezza dei progressi

- Struttura **solo aggiunta**: nello stato (`english-sprint-v1`, `version: 1`) arriva il campo `voice`:
  `{ sessions: [...max 80 pagellini], pron: { parola: {miss, hits, due, interval, ex, last} }, days: { data: {seconds, done} }, pending: [...] }`.
  Niente di quello che c'è viene rinominato o tolto. `mergeStates` unisce anche `voice` (niente si perde).
- **Backup nel browser**: alla prima apertura della nuova versione si salva una copia in `english-sprint-v1-backup-20261124`.
- **Backup sul server**: prima che il nuovo codice scriva, `api/` copia la tabella in `eng_progress_bak_20261124`
  (una volta sola) e scrive anche un file JSON in `private/backup/`.
- Il server, quando riceve progressi senza `voice` (per esempio da una scheda aperta con la versione vecchia),
  **rimette** il `voice` che aveva già salvato.

## Fasi (ognuna consegna una versione funzionante, con commit nel git di `sorgenti/`)

1. Base voce + conversazione: `lib/voice.js` (registrazione, Whisper, silenzio, voci), API `talk`/`report`/`stt`,
   motore del dialogo `lib/talk.js`, componente `Conversation`, pagina **Parla**, pagellino. Dati `voice` + backup.
2. Pronuncia: punteggio con allineamento, riascolto, lento, ripasso a intervalli delle parole sbagliate.
3. Simulazioni di lavoro: 10 situazioni con domande e frasi utili scritte, storico e andamento del punteggio.
4. Allenamento di oggi (10 minuti, giorni di fila) e **Dialogo a voce** alla fine di ogni lezione; Home e presentazione aggiornate.
5. Caricamento online (prima il PHP, poi il resto), verifica, report per mail.

## Dove sono arrivato (pausa del 24/11/2026)

Fatto e compilato (`npm run build` passa), **solo in locale, niente caricato online**:
- PHP: richieste `talk`, `report`, `stt` (Whisper con tetti suoi), backup una tantum di `eng_progress` (tabella + JSON in `private/backup/`), il server rimette `voice` se manca. Provate in locale con curl: tutor e pagellino rispondono bene.
- Client: `lib/voice.js`, `lib/pron.js`, `lib/talk.js`, `lib/scenarios.js` (10 simulazioni, suoni, frasi), componenti `VoiceOrb`, `Conversation`, `Report`, `PronDrill`, pagine `Parla` e `ParlaPagine` (simulazione, conversazione, pronuncia, allenamento), parte `talk` in fondo alle lezioni, Home/Presentazione/Opzioni aggiornate, campo `voice` nello stato con unione e backup nel browser.
- Vista nel browser solo la pagina `#/parla` (nessun errore in console).

Prossimo passo:
1. Provare nel browser: simulazione completa (anche con il microfono finto o scrivendo), pronuncia, allenamento di oggi, parte «Dialogo a voce» di una lezione, vista telefono, tema chiaro/scuro, reduced-motion.
2. Sistemare quello che non va, commit.
3. Caricare online: PRIMA `api/` e `lib/` (poi aprire `api/index.php?r=session` per far partire il backup e controllare `private/backup/`), POI `index.html`, `assets/`, `content/`. Verificare online.
4. Aggiornare `apps/LEGGIMI.md` (sezione english-sprint) e mandare il report per mail con `private/mailer.php`.

## Stato al 25/11/2026: ONLINE

Provato nel browser (simulazione completa a scrittura con tutor e pagellino veri, pagine Parla, Pronuncia, Allenamento, Dialogo a fine lezione, vista telefono), punteggio di pronuncia e unione dei dati provati in Node, Whisper provato online con un audio vero. Caricato prima il PHP (backup fatto online: file in private/backup e tabella eng_progress_bak_20261124), poi il resto. Da provare con un microfono vero: mani libere e riascolto della propria voce su telefono (Android può non permettere riconoscimento e registrazione insieme: l'app lo ricorda e va avanti senza riascolto).
