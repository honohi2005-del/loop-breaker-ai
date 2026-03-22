const { response, extractJson, callOpenAI } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const mode = ['flat', 'dry', 'soft'].includes(body.mode) ? body.mode : 'flat';
    const label = String(body.label || 'ループ').trim().slice(0, 40);

    const instructions = `Generate exactly 5 very short intervention steps in Japanese.
Return valid JSON only.
Rules:
- Output this schema exactly: {"steps": ["...", "...", "...", "...", "..."]}
- No analysis
- No emotional counseling
- No questions
- Every step should be brief and concrete
- Suitable for public places like trains
- Prefer sensory redirection, body awareness, gaze shift, or simple comparison tasks
- Vary the tasks so they do not feel repetitive
Tone: ${mode}`;

    const output = await callOpenAI(instructions, `loop_label: ${label}\nmode: ${mode}`);
    const parsed = extractJson(output);
    const steps = Array.isArray(parsed.steps) ? parsed.steps.slice(0, 5).map(step => String(step).slice(0, 80)) : [];

    return response(200, { steps });
  } catch (error) {
    return response(500, { error: error.message || 'sequence failed' });
  }
};
