<?php
// English Sprint: correzioni e tutor con Groq (gratis, console.groq.com). Risposte sempre in JSON.
declare(strict_types=1);

function eng_cfg(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $priv = dirname(__DIR__, 3) . '/private';
        // groq_model: chi ha l'account del portale; groq_model_guest (+ riserva): chi usa l'app senza account,
        // su modelli diversi, così ciascuno ha la sua quota gratuita di Groq e il pubblico non consuma quella delle altre app
        $cfg = ['groq_key' => '', 'groq_model' => 'openai/gpt-oss-120b', 'groq_model_guest' => 'qwen/qwen3.8-27b', 'groq_model_guest2' => 'openai/gpt-oss-20b'];
        foreach (['english-sprint.php', 'bollette-chiare.php'] as $f) {
            if (is_file("$priv/$f")) {
                $c = require "$priv/$f";
                if (is_array($c) && trim((string) ($c['groq_key'] ?? '')) !== '') {
                    $cfg['groq_key'] = trim($c['groq_key']);
                    if ($f === 'english-sprint.php') {
                        foreach (['groq_model', 'groq_model_guest', 'groq_model_guest2'] as $m) {
                            if (!empty($c[$m])) $cfg[$m] = $c[$m];
                        }
                    }
                    break;
                }
            }
        }
    }
    return $cfg;
}

/** @return array|string|null  array JSON; '429' se troppe richieste; null se errore */
function eng_llm(array $messages, int $max = 1200, float $temp = 0.2)
{
    $cfg = eng_cfg();
    if ($cfg['groq_key'] === '') return null;
    if (!empty($GLOBALS['eng_guest'])) {
        // senza account: un modello diverso (quota gratuita sua); se è al limite o non risponde, quello di riserva
        $r = eng_llm_call($cfg['groq_key'], $cfg['groq_model_guest'], $messages, $max, $temp);
        return is_array($r) ? $r : eng_llm_call($cfg['groq_key'], $cfg['groq_model_guest2'], $messages, $max, $temp);
    }
    return eng_llm_call($cfg['groq_key'], $cfg['groq_model'], $messages, $max, $temp);
}

/** @return array|string|null */
function eng_llm_call(string $key, string $model, array $messages, int $max, float $temp)
{
    $body = [
        'model' => $model,
        'temperature' => $temp,
        'max_tokens' => $max,
        'response_format' => ['type' => 'json_object'],
        'messages' => $messages,
    ];
    // il modello piccolo di riserva ragiona poco: altrimenti finisce i token prima di scrivere il JSON
    if ($model === 'openai/gpt-oss-20b') $body['reasoning_effort'] = 'low';
    $ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
        CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE),
    ]);
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code === 429) return '429';
    $content = json_decode((string) $raw, true)['choices'][0]['message']['content'] ?? null;
    if ($code !== 200 || !is_string($content)) {
        error_log('english-sprint groq ' . $model . ' ' . $code . ': ' . substr((string) $raw, 0, 300));
        return null;
    }
    $d = json_decode($content, true);
    if (!is_array($d)) {
        // alcuni modelli aggiungono un ragionamento <think> o i ``` attorno al JSON: tengo solo l'oggetto
        $c = preg_replace('~<think>.*?</think>~s', '', $content);
        $a = strpos($c, '{');
        $b = strrpos($c, '}');
        $d = $a !== false && $b > $a ? json_decode(substr($c, $a, $b - $a + 1), true) : null;
    }
    return is_array($d) ? $d : null;
}

function eng_s($v, int $max = 4000): string
{
    return mb_substr(trim((string) $v), 0, $max);
}

function eng_hist($messages): array
{
    $hist = [];
    foreach (array_slice((array) $messages, -16) as $m) {
        $role = ($m['role'] ?? '') === 'assistant' ? 'assistant' : 'user';
        $hist[] = ['role' => $role, 'content' => eng_s($m['content'] ?? '', 1500)];
    }
    return $hist;
}

function eng_level($l): string
{
    $l = (string) $l;
    return in_array($l, ['A2', 'B1', 'B2'], true) ? $l : 'B1';
}

function eng_level_rules(string $l): string
{
    if ($l === 'A2') return 'Use very simple, common words, short sentences, present and past simple; speak slowly and clearly.';
    if ($l === 'B2') return 'Use natural professional English with idioms and varied structures, as with a confident colleague.';
    return 'Use clear everyday business English, short sentences, a few new professional words.';
}

// Trascrizione con Groq Whisper (gratis). @return string|null|'429'
function eng_stt(string $path, string $name, string $prompt = '')
{
    $cfg = eng_cfg();
    if ($cfg['groq_key'] === '' || !is_file($path)) return null;
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($ext, ['webm', 'ogg', 'mp4', 'm4a', 'wav', 'mp3'], true)) $ext = 'webm';
    $fields = [
        'file' => new CURLFile($path, 'audio/' . ($ext === 'm4a' ? 'mp4' : $ext), 'audio.' . $ext),
        'model' => 'whisper-large-v3-turbo',
        'language' => 'en',
        'temperature' => '0',
        'response_format' => 'json',
    ];
    if (trim($prompt) !== '') $fields['prompt'] = eng_s($prompt, 400);
    $ch = curl_init('https://api.groq.com/openai/v1/audio/transcriptions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $cfg['groq_key']],
        CURLOPT_POSTFIELDS => $fields,
    ]);
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code === 429) return '429';
    $text = json_decode((string) $raw, true)['text'] ?? null;
    if ($code !== 200 || !is_string($text)) {
        error_log('english-sprint whisper ' . $code . ': ' . substr((string) $raw, 0, 300));
        return null;
    }
    return trim($text);
}

const ENG_TEACHER = "You are an expert, encouraging English teacher for an Italian adult who wants to use English at work (emails, calls, meetings, clients). "
    . "Their level is usually A2/B1 and they want professional, natural English fast. Explanations for them must be in simple Italian (frasi brevi, parole semplici). "
    . "Be precise: only flag real errors, not stylistic preferences, and never invent errors. Always reply with valid JSON only.";

function eng_ai(string $kind, array $d, bool $guest = false)
{
    $GLOBALS['eng_guest'] = $guest;
    $schemaCorr = 'Reply JSON: {"score": integer 0-10, "summaryIt": "2-3 frasi in italiano: com\'è andata, cosa va bene, cosa migliorare", '
        . '"corrected": "the student\'s text with only the errors fixed (keep their words)", '
        . '"errors": [{"wrong": "exact wrong fragment", "right": "correct fragment", "whyIt": "spiegazione breve in italiano"}], '
        . '"better": "a more natural, professional version a native speaker would write", '
        . '"newWords": [{"en": "useful word or phrase used in the better version", "it": "traduzione"}]}. Max 8 errors, max 5 newWords.';

    switch ($kind) {
        case 'writing':
            $msgs = [
                ['role' => 'system', 'content' => ENG_TEACHER],
                ['role' => 'user', 'content' => "Lesson topic: " . eng_s($d['lesson'] ?? '', 200) . "\nTask: " . eng_s($d['task'] ?? '', 1000)
                    . "\n\nStudent's text:\n\"\"\"\n" . eng_s($d['text'] ?? '', 4000) . "\n\"\"\"\n\nCorrect it. Also check that it completes the task. " . $schemaCorr],
            ];
            return eng_llm($msgs, 1800);

        case 'speaking':
            $msgs = [
                ['role' => 'system', 'content' => ENG_TEACHER],
                ['role' => 'user', 'content' => "The student answered this question by speaking (the text is an automatic speech-to-text transcript, so ignore punctuation, capital letters and obvious recognition glitches).\n"
                    . "Question: " . eng_s($d['question'] ?? '', 500) . "\nTranscript: \"" . eng_s($d['text'] ?? '', 2500) . "\"\n\n"
                    . "Evaluate grammar, vocabulary and whether they answered the question. " . $schemaCorr],
            ];
            return eng_llm($msgs, 1500);

        case 'translation':
            $msgs = [
                ['role' => 'system', 'content' => ENG_TEACHER],
                ['role' => 'user', 'content' => "Italian sentence: \"" . eng_s($d['it'] ?? '', 500) . "\"\nReference translation: \"" . eng_s($d['expected'] ?? '', 500)
                    . "\"\nStudent's translation: \"" . eng_s($d['given'] ?? '', 500) . "\"\n\n"
                    . "Is the student's translation correct English with the same meaning? Different but correct wording is fine. "
                    . 'Reply JSON: {"verdict": "ok" | "almost" | "wrong", "feedbackIt": "1-2 frasi in italiano: cosa va o cosa correggere", "corrected": "the student\'s sentence fixed (or the same if ok)"}'],
            ];
            return eng_llm($msgs, 600, 0.1);

        case 'chat':
            $scenario = eng_s($d['scenario'] ?? 'A friendly conversation about work.', 800);
            $hist = [];
            foreach (array_slice((array) ($d['messages'] ?? []), -16) as $m) {
                $role = ($m['role'] ?? '') === 'assistant' ? 'assistant' : 'user';
                $hist[] = ['role' => $role, 'content' => eng_s($m['content'] ?? '', 1500)];
            }
            $sys = "You are a role-play conversation partner helping an Italian professional practise spoken business English (level A2/B1, wants to improve fast). "
                . "Scenario: $scenario\n"
                . "Rules: stay in character; speak natural, clear English; keep each reply short (1-3 sentences) and end with a question or a prompt so they keep talking; "
                . "use vocabulary slightly above their level. If their last message has a real grammar or vocabulary mistake, give ONE correction. "
                . "If they write in Italian or are stuck, help them with a short hint. "
                . "Every field whose name ends in 'It' (replyIt, whyIt) MUST be written in Italian. "
                . 'Reply JSON only: {"reply": "your in-character answer in English", "replyIt": "traduzione italiana della tua risposta", '
                . '"correction": null or {"wrong": "...", "right": "...", "whyIt": "spiegazione brevissima in italiano"}, '
                . '"suggestion": "a natural sentence they could say next, in English"}';
            if (!$hist) $hist[] = ['role' => 'user', 'content' => '(Start the conversation.)'];
            return eng_llm(array_merge([['role' => 'system', 'content' => $sys]], $hist), 700, 0.6);

        case 'talk':
            // una battuta del dialogo A VOCE (conversazione, simulazioni, allenamento, fine lezione): risposta breve e veloce.
            // Gli errori dello studente si raccolgono in silenzio e si mostrano solo alla fine (correzione gentile).
            $hist = eng_hist($d['messages'] ?? []);
            $level = eng_level($d['level'] ?? '');
            $turn = max(1, min(20, (int) ($d['turn'] ?? 1)));
            $maxT = max(1, min(20, (int) ($d['maxTurns'] ?? 6)));
            $words = eng_s($d['words'] ?? '', 900);
            $last = $turn >= $maxT;
            $sys = "You are a role-play partner in a SPOKEN English practice for an Italian professional. Your words are read aloud by a speech synthesizer, and the student's words come from speech recognition (ignore punctuation, capital letters and obvious recognition glitches).\n"
                . "Your role and the situation: " . eng_s($d['scenario'] ?? 'A friendly conversation about work.', 1200) . "\n"
                . ($d['goal'] ?? '' ? "The student's goal: " . eng_s($d['goal'], 300) . "\n" : '')
                . "Student level: $level. " . eng_level_rules($level) . "\n"
                . ($words !== '' ? "Vocabulary the student is studying (you may use some of these single words naturally so they hear them; never say the student's own phrases as if they were yours, e.g. do not describe your own role or experience with them): $words\n" : '')
                . "This is turn $turn of $maxT. "
                . ($last ? "This is your LAST turn: react briefly to what they said and close the conversation in a natural, friendly way (no question).\n"
                    : "Stay in character, react to what they said in a natural way, then ask ONE clear question to keep them talking.\n")
                . "Rules: 1-3 short sentences, max 45 words, no lists, no emoji, no brackets, no stage directions. Never correct the student inside the reply: corrections go only in the errors field. "
                . "If the student speaks Italian or seems stuck, gently rephrase your question in simpler English.\n"
                . 'Reply JSON only: {"reply": "your spoken answer in English", "replyIt": "traduzione italiana della tua risposta", '
                . '"errors": [{"wrong": "exact wrong fragment from the student\'s LAST message", "right": "correct version", "whyIt": "spiegazione brevissima in italiano"}] '
                . '(check the student\'s LAST message carefully for real grammar or vocabulary errors, especially typical Italian-speaker mistakes: "since ten years" for "for ten years", "responsible of" for "responsible for", "work like" for "work as", missing articles or subjects, wrong tense, "people is", false friends; max 3; [] only if there are really none), '
                . '"hint": "a natural sentence the student could say next, in English (short)"}';
            if (!$hist) $hist[] = ['role' => 'user', 'content' => '(Start the conversation.)'];
            return eng_llm(array_merge([['role' => 'system', 'content' => $sys]], $hist), 600, 0.6);

        case 'report':
            // pagellino a fine dialogo: una sola chiamata con tutta la trascrizione
            $level = eng_level($d['level'] ?? '');
            $lines = [];
            foreach (array_slice((array) ($d['messages'] ?? []), -30) as $m) {
                $who = ($m['role'] ?? '') === 'assistant' ? 'PARTNER' : 'STUDENT';
                $lines[] = $who . ': ' . eng_s($m['content'] ?? '', 1200);
            }
            $metrics = eng_s($d['metrics'] ?? '', 400);
            $msgs = [
                ['role' => 'system', 'content' => ENG_TEACHER . " You are now evaluating a SPOKEN conversation: the student's lines are speech-to-text transcripts, so ignore punctuation, capital letters and obvious recognition glitches. Be kind but honest, and coherent with level $level. In the Italian fields address the student with gender-neutral wording (avoid adjectives or participles with a masculine or feminine ending referring to the student, like sei stato/stata, interessato/a, bravo/a: write for example hai ammesso, ti interessa, ottimo lavoro)."],
                ['role' => 'user', 'content' => "Situation: " . eng_s($d['scenario'] ?? '', 1200) . "\n"
                    . ($d['goal'] ?? '' ? "Goal of the student: " . eng_s($d['goal'], 300) . "\n" : '')
                    . ($metrics !== '' ? "Measured by the app: $metrics\n" : '')
                    . "Transcript:\n" . implode("\n", $lines) . "\n\n"
                    . "Write the report card. Scores 1-10: fluency (how easily and fully they expressed ideas), vocabulary (range and professional words), grammar (accuracy), task (did they reach the goal of the situation). "
                    . 'Reply JSON: {"scores": {"fluency": int, "vocabulary": int, "grammar": int, "task": int}, "total": integer 0-100, '
                    . '"summaryIt": "2-3 frasi in italiano semplice: com\'è andata", "strengthsIt": ["max 3 punti di forza, in italiano"], "improveIt": ["max 3 cose da migliorare, in italiano, concrete"], '
                    . '"errors": [{"wrong": "exact fragment the student said", "right": "correct version", "whyIt": "spiegazione breve in italiano"}] (max 8, real errors only), '
                    . '"phrases": [{"en": "a useful professional phrase for this situation they should learn", "it": "traduzione"}] (max 6), '
                    . '"reviewWords": [{"en": "word to review", "it": "traduzione"}] (max 5), '
                    . '"better": {"q": "one question from the partner", "en": "a better, natural answer at their level (2-3 sentences)"}}'],
            ];
            return eng_llm($msgs, 1700, 0.2);

        case 'prep':
            // preparazione al colloquio: risposte personalizzate dal profilo che lo studente scrive (resta nel suo browser)
            $level = eng_level($d['level'] ?? '');
            $p = (array) ($d['profile'] ?? []);
            $lines = [];
            foreach (['target' => 'Role they are applying for', 'current' => 'Current or last job', 'years' => 'Years of experience', 'sector' => 'Sector / clients', 'achievements' => 'Achievements and projects', 'strengths' => 'Strengths and skills', 'why' => 'Why they want this role', 'extra' => 'Other notes'] as $k => $label) {
                $v = eng_s($p[$k] ?? '', 600);
                if ($v !== '') $lines[] = "$label: $v";
            }
            $msgs = [
                ['role' => 'system', 'content' => ENG_TEACHER . " Now you are a job-interview coach. The profile may be written in Italian: translate the facts, never invent jobs, companies, numbers or degrees that are not in the profile (if something is missing, keep it general)."],
                ['role' => 'user', 'content' => "Candidate profile:\n" . implode("\n", $lines) . "\n\n"
                    . "Write model answers for a job interview in English, in the first person, natural and spoken (not written style), level $level, 50-90 words each, concrete, using the facts of the profile and a clear structure (situation, action, result when useful). "
                    . "Questions: 1 Tell me about yourself. 2 Why do you want this role? 3 What are your main strengths? 4 Tell me about a project you are proud of. 5 Tell me about a difficult situation at work and how you handled it. 6 What is your biggest weakness? 7 Where do you see yourself in three years? 8 Do you have any questions for us? "
                    . 'Reply JSON: {"answers": [{"q": "question in English", "qIt": "domanda in italiano", "en": "model answer", "it": "traduzione italiana", "tipIt": "un consiglio breve in italiano per dirla bene"}] (exactly 8)}'],
            ];
            return eng_llm($msgs, 3500, 0.4);

        case 'case':
            // caso del giorno: una simulazione nuova inventata dall'AI, legata al tema della lezione
            $level = eng_level($d['level'] ?? '');
            $topic = eng_s($d['topic'] ?? 'work in an international digital company', 200);
            $seed = eng_s($d['seed'] ?? '', 20);
            $msgs = [
                ['role' => 'system', 'content' => ENG_TEACHER],
                ['role' => 'user', 'content' => "Invent a NEW, realistic role-play situation for spoken practice at work (seed $seed, so it is different every day). Theme: $topic. "
                    . "The student is an Italian professional (digital projects, clients, consulting, coordination, accessibility). The partner is a client, a colleague, a manager or a supplier with an invented name; never give the student a name, address them as you. Level $level. "
                    . 'Reply JSON: {"t": "titolo breve in italiano", "d": "la situazione in una frase, in italiano", "partner": "nome e ruolo del personaggio, in italiano", '
                    . '"goalIt": "obiettivo dello studente in italiano", "goal": "the same goal in English", '
                    . '"scenario": "instructions in English for the AI playing the partner: who you are, what you want, your attitude, one complication", '
                    . '"opener": {"en": "the partner\'s first line, ending with a question", "it": "traduzione"}, '
                    . '"questions": ["6 more questions or lines the partner can say, in English"], '
                    . '"phrases": [{"en": "useful phrase for the student", "it": "traduzione"}] (6)}'],
            ];
            return eng_llm($msgs, 1500, 0.9);

        case 'explain':
            // spiegazione al volo di una parola o frase
            $msgs = [
                ['role' => 'system', 'content' => ENG_TEACHER],
                ['role' => 'user', 'content' => "Explain this English word or sentence to the student: \"" . eng_s($d['text'] ?? '', 500) . "\". "
                    . 'Reply JSON: {"it": "traduzione italiana", "explainIt": "spiegazione semplice in italiano (uso, tono, quando si usa)", '
                    . '"examples": [{"en": "...", "it": "..."}] (3 esempi di lavoro), "pron": "pronuncia approssimata scritta all\'italiana con accento grave"}'],
            ];
            return eng_llm($msgs, 800);
    }
    return null;
}
