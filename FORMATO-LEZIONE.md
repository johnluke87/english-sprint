# Formato di una lezione (English Sprint)

Ogni lezione è un file JSON in `public/content/lessons/LNN.json` (es. `L01.json`, `L27.json`), UTF-8, senza commenti.
Titolo, settimana, argomento di grammatica e lessico di ogni lezione sono in `public/content/syllabus.json`: vanno rispettati.

Lo studente è un adulto italiano che usa l'inglese al lavoro (clienti, mail, call, riunioni, report). Il corso è pubblico dal 20/11/2026: testi in forma neutra e nessun nome di persone reali (nei dialoghi e nei modelli nomi inventati).
Ha studiato inglese a scuola e all'università ma non lo pratica da anni: livello reale A2/B1 arrugginito.
Obiettivo: inglese professionale scritto e parlato, il più in fretta possibile. Ogni lezione = circa 60 minuti.

Le spiegazioni in italiano usano **parole semplici e frasi brevi**. L'inglese è quello vero degli uffici (britannico o americano neutro), naturale, non da libro di scuola.

## Struttura

```json
{
  "id": 1,
  "week": 1,
  "title": "titolo in italiano (uguale al syllabus)",
  "titleEn": "titolo inglese (uguale al syllabus)",
  "intro": "2-3 frasi in italiano: cosa impari oggi e perché ti serve al lavoro",
  "goals": ["3-4 obiettivi in italiano, es. 'Scrivere una mail per mandare un file'"],

  "words": [
    {
      "en": "to schedule",
      "pron": "skèdgiul",
      "it": "fissare (un incontro), programmare",
      "type": "verb",
      "ex": "Can we schedule a call for Monday?",
      "exIt": "Possiamo fissare una chiamata per lunedì?"
    }
  ],

  "falseFriends": [
    { "en": "eventually", "it": "alla fine", "trap": "Non vuol dire 'eventualmente' (= if needed)." }
  ],

  "grammar": {
    "title": "titolo della regola in italiano",
    "explainIt": ["paragrafo 1 in italiano semplice", "paragrafo 2", "..."],
    "explainEn": ["la stessa spiegazione in inglese semplice (B1), paragrafo 1", "..."],
    "rules": [
      {
        "it": "la regola in una frase (italiano)",
        "en": "the rule in one sentence (English)",
        "form": "schema, es. 'have/has + participio' (facoltativo)",
        "examples": [ { "en": "I have sent you the file.", "it": "Ti ho mandato il file." } ]
      }
    ],
    "tip": "un trucco pratico per ricordarla (italiano)",
    "mistakes": [
      { "wrong": "I have sent it yesterday.", "right": "I sent it yesterday.", "why": "con yesterday si usa il past simple" }
    ]
  },

  "grammarExercises": [
    { "q": "I ___ (send) you the quote yesterday.", "a": ["sent"], "hint": "c'è yesterday", "explain": "Momento preciso nel passato → past simple." }
  ],

  "phrases": [
    { "group": "Aprire una mail", "en": "I hope you're well.", "it": "Spero tu stia bene.", "note": "facoltativa: quando usarla / tono" }
  ],

  "dialogue": {
    "title": "titolo breve in inglese",
    "context": "la situazione in italiano (1-2 frasi)",
    "lines": [
      { "s": "A", "name": "Sarah", "en": "Hi Luca, did you get my email?", "it": "Ciao Luca, hai ricevuto la mia mail?" },
      { "s": "B", "name": "Luca", "en": "...", "it": "..." }
    ]
  },

  "listening": [
    { "q": "domanda in inglese sul dialogo", "options": ["risposta", "risposta", "risposta"], "answer": 0 }
  ],

  "translations": [
    { "it": "Ti allego il preventivo.", "en": "I've attached the quote.", "alt": ["Please find attached the quote.", "I'm attaching the quote."] }
  ],

  "writing": {
    "taskIt": "consegna in italiano: cosa scrivere, a chi, cosa dire (5-8 righe)",
    "taskEn": "the same task in English",
    "model": "una risposta modello in inglese, scritta bene, con \\n per andare a capo"
  },

  "speaking": {
    "shadowing": ["frase inglese da ripetere ad alta voce", "..."],
    "prompts": [ { "en": "Tell me about your job.", "it": "Parlami del tuo lavoro.", "help": "Inizia con: I work as... / I'm responsible for..." } ]
  },

  "video": [
    {
      "title": "titolo della scena (italiano)",
      "show": ["2-4 righe brevi che compaiono sullo schermo (anche esempi inglesi)"],
      "say": [
        { "lang": "it", "text": "narrazione in italiano (1-3 frasi)" },
        { "lang": "en", "text": "esempio o frase in inglese detta dalla voce inglese" }
      ]
    }
  ]
}
```

## Quantità (obbligatorie)

| Campo | Quanti |
|---|---|
| `words` | **esattamente 50**, tutte diverse, legate al tema. `type`: `verb`, `noun`, `adj`, `adv`, `phrase`, `prep`, `conj` |
| `falseFriends` | 0-4 (solo se utili e veri) |
| `grammar.explainIt` / `explainEn` | 3-6 paragrafi ciascuno, spiegazione COMPLETA e chiara |
| `grammar.rules` | 3-6 regole, ognuna con 2-4 esempi |
| `grammar.mistakes` | 3-5 errori tipici degli italiani |
| `grammarExercises` | **12** (frasi con `___`; `a` = tutte le risposte giuste accettabili, minuscole/maiuscole non contano; contrazioni: metti sia "I have" che "I've" se valgono entrambe) |
| `phrases` | **25** espressioni fatte, divise in 4-6 `group` |
| `dialogue.lines` | 12-18 battute, naturali, che usano parole e frasi della lezione |
| `listening` | 4 domande a scelta (3 opzioni, `answer` = indice 0-2 della giusta) |
| `translations` | **12** frasi dall'italiano, utili al lavoro, con 1-3 `alt` accettabili |
| `speaking.shadowing` | 8 frasi |
| `speaking.prompts` | 5 domande |
| `video` | 7-10 scene: 1 introduzione, poi la grammatica spiegata passo passo con esempi, 1-2 scene sulle espressioni chiave, 1 riepilogo finale |

## Pronuncia (`pron`)

Pronuncia approssimata scritta **come la leggerebbe un italiano**, con l'accento grave sulla sillaba accentata:
`deadline` → `dèdlain`, `issue` → `ìsciu`, `available` → `avèilabol`, `to require` → `rikuàier`, `the` → `de`, `think` → `tink` (ma per i suoni `th` puoi scrivere `θink` NO: usa solo lettere italiane), `schedule` → `skèdgiul`, `quote` → `kuòut`.
Per i verbi scrivi la pronuncia senza "to". Usa `sc` per /ʃ/, `ci/ce` per /tʃ/, `gi/ge` per /dʒ/, `u` per /w/, `ai` per /aɪ/, `èi` per /eɪ/, `òu` per /oʊ/, `au` per /aʊ/, vocali doppie per quelle lunghe (`mìiting`).

## Regole di qualità

- Inglese corretto al 100%. Le traduzioni italiane naturali (non parola per parola).
- Esempi presi dal mondo del lavoro: siti web, clienti, progetti, riunioni, mail, audit, preventivi.
- Niente parole già nelle lezioni precedenti dello stesso gruppo che scrivi (vedi file già presenti in `public/content/lessons/`), salvo le lezioni di ripasso (10, 40, 59, 60) dove è voluto.
- Testi del video pensati per essere **letti da una voce sintetica**: frasi brevi, niente simboli, niente markdown, niente emoji, niente parentesi.
- Nei campi di testo niente markdown e niente HTML. In `explainIt`/`explainEn` puoi scrivere esempi tra virgolette.
- Il file deve passare il controllo: `node scripts/controlla-lezioni.mjs` (dalla cartella `sorgenti`).
