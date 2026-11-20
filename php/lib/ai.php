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
