const OPENAI_URL = 'https://api.openai.com/v1/responses';
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const AI_PROVIDER = String(process.env.AI_PROVIDER || '').trim().toLowerCase();

function json(headers = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  };
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: json(),
    body: JSON.stringify(body),
  };
}

function extractJson(text) {
  const trimmed = String(text || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found');
  return JSON.parse(match[0]);
}

async function callOpenAI(instructions, input) {
  const runtime = getRuntimeStatus();
  if (!runtime.ready) throw new Error(runtime.reason);
  if (runtime.provider === 'groq') return callGroq(instructions, input, runtime);
  return callOpenAIResponses(instructions, input, runtime);
}

function getRuntimeStatus() {
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasGroq = Boolean(process.env.GROQ_API_KEY);

  if (AI_PROVIDER === 'groq') {
    if (!hasGroq) return { ready: false, reason: 'Missing GROQ_API_KEY (AI_PROVIDER=groq)' };
    return { ready: true, provider: 'groq', model: GROQ_MODEL };
  }

  if (AI_PROVIDER === 'openai') {
    if (!hasOpenAI) return { ready: false, reason: 'Missing OPENAI_API_KEY (AI_PROVIDER=openai)' };
    return { ready: true, provider: 'openai', model: OPENAI_MODEL };
  }

  if (hasGroq) return { ready: true, provider: 'groq', model: GROQ_MODEL };
  if (hasOpenAI) return { ready: true, provider: 'openai', model: OPENAI_MODEL };
  return { ready: false, reason: 'Missing GROQ_API_KEY or OPENAI_API_KEY' };
}

async function callOpenAIResponses(instructions, input, runtime) {
  const key = process.env.OPENAI_API_KEY;
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: runtime.model,
      store: false,
      instructions,
      input,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.output_text || '';
}

async function callGroq(instructions, input, runtime) {
  const key = process.env.GROQ_API_KEY;
  const res = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: runtime.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: input },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

module.exports = { response, extractJson, callOpenAI, getRuntimeStatus };
