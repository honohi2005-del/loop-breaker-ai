const { response, extractJson, callOpenAI, getRuntimeStatus } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    if (body.probe) {
      const runtime = getRuntimeStatus();
      if (!runtime.ready) return response(503, { ok: false, reason: runtime.reason });
      return response(200, { ok: true, provider: runtime.provider, model: runtime.model });
    }

    const mode = ['flat', 'dry', 'soft'].includes(body.mode) ? body.mode : 'flat';
    const userInput = String(body.input || '').trim().slice(0, 160) || 'なんとなく嫌な気分が続く';

    const instructions = `You are not a therapist and not a conversation partner.
Your job is to interrupt rumination quickly.
Return valid JSON only.
Rules:
- Do not analyze causes.
- Do not ask follow-up questions.
- Do not encourage long reflection.
- Keep responses short and concrete.
- The user is probably on a train or in public.
- Tasks must be quiet, simple, and socially safe.
- Write all content in natural Japanese.
- Use this schema exactly:
{
  "label": "short Japanese label",
  "message": "one short interruption sentence",
  "task": "one immediate sensory or body-based task",
  "next": "one short next step"
}
Tone:
- flat: neutral and minimal
- dry: blunt and slightly cold
- soft: calm and lightly reassuring
Selected tone: ${mode}`;

    const output = await callOpenAI(instructions, `mode: ${mode}\nuser_input: ${userInput}`);
    const parsed = extractJson(output);

    return response(200, {
      label: String(parsed.label || 'ループ').slice(0, 40),
      message: String(parsed.message || '今は処理しません。').slice(0, 80),
      task: String(parsed.task || '周囲を見てください。').slice(0, 80),
      next: String(parsed.next || '呼吸を1回だけ長く吐いてください。').slice(0, 80),
    });
  } catch (error) {
    return response(500, { error: error.message || 'intervene failed' });
  }
};
