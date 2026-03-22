const { response, extractJson, callOpenAI } = require('./_shared');

const CATEGORY_BANK = {
  visual: [
    '右側で角のある物を2つ見つけてください。',
    '光っている点を1つ選んでください。',
    '白っぽい物と黒っぽい物を1つずつ見てください。',
    '丸い形を2つ探してください。',
    '遠くの直線を1本だけ目で追ってください。',
  ],
  sound: [
    '近い音を1つ、遠い音を1つ分けてください。',
    'いちばん低い音を1つ探してください。',
    '連続している音を1つ数えてください。',
    '一瞬だけ鳴る音を1つ拾ってください。',
    '左側から来る音を1つ見つけてください。',
  ],
  touch: [
    '足裏の圧を5秒だけ感じてください。',
    '手のひらの温度差を3秒確認してください。',
    '背中が触れている面を1つ意識してください。',
    '指先の接触を2か所だけ感じてください。',
    '服の生地感を1か所だけ確かめてください。',
  ],
  posture: [
    '肩を1回だけ下げて、そのまま3秒止めてください。',
    'あごを2cmだけ引いてください。',
    '首をゆっくり1回だけ戻してください。',
    '息を1回だけ長く吐いてください。',
    '両足の荷重差を1回だけ整えてください。',
  ],
  compare: [
    '明るい場所と暗い場所を1つずつ比べてください。',
    '大きい物と小さい物を1つずつ選んでください。',
    '動く物と止まる物を1つずつ見てください。',
    '近い物と遠い物を1つずつ選んでください。',
    '{label} は保留して、外側の情報を2つ拾ってください。',
  ],
  count: [
    '視界の中の直線を3本だけ数えてください。',
    '青系の色を2つ見つけてください。',
    '四角い要素を2つだけ探してください。',
    '文字を3つだけ拾ってください。',
    '座席まわりの境界線を2つ見つけてください。',
  ],
};

const ORDER_PATTERNS = [
  ['visual', 'sound', 'touch', 'posture', 'compare'],
  ['sound', 'visual', 'count', 'touch', 'posture'],
  ['count', 'visual', 'sound', 'compare', 'touch'],
  ['posture', 'touch', 'visual', 'sound', 'compare'],
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function clean(text, max = 80) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function looksJapanese(text) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(text || ''));
}

function buildLocalSequence(label) {
  const order = pick(ORDER_PATTERNS);
  return order.map((category) => clean(pick(CATEGORY_BANK[category]).replace('{label}', label)));
}

function fillSteps(rawSteps, label) {
  const local = buildLocalSequence(label);
  const output = [];
  const seen = new Set();

  for (const step of rawSteps) {
    const text = clean(step);
    if (!text || seen.has(text) || !looksJapanese(text)) continue;
    output.push(text);
    seen.add(text);
    if (output.length === 5) break;
  }

  for (const fallback of local) {
    if (output.length === 5) break;
    if (seen.has(fallback)) continue;
    output.push(fallback);
    seen.add(fallback);
  }

  return output.slice(0, 5);
}

function buildVariationPack() {
  const order = pick(ORDER_PATTERNS);
  return {
    seed: Math.floor(Math.random() * 1000000),
    order,
    hint: '各ステップで動詞と感覚チャネルを変える',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const mode = ['flat', 'dry', 'soft'].includes(body.mode) ? body.mode : 'flat';
    const label = String(body.label || 'ループ').trim().slice(0, 40);
    const variation = buildVariationPack();

    const instructions = `Generate exactly 5 Japanese intervention steps.
Return valid JSON only.
Schema: {"steps":["...","...","...","...","..."]}

Rules:
- no analysis, no counseling, no questions
- each step must be concrete and brief
- each step must include at least one number
- avoid repeating sentence starts and verbs
- keep all steps socially safe in public transit
- do not repeat almost the same action
- include "${label}" in at most one step
- output must be Japanese only
- no sarcasm, no insulting or harsh language

Preferred flow order: ${variation.order.join(' -> ')}
Variation hint: ${variation.hint}
Tone details:
- flat: neutral concise
- dry: game-like mission calls
- soft: gentle and calm
Tone: ${mode}`;

    const output = await callOpenAI(
      instructions,
      `loop_label: ${label}\nmode: ${mode}\nvariation_seed: ${variation.seed}`
    );
    const parsed = extractJson(output);
    const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
    const steps = fillSteps(rawSteps, label);

    return response(200, { steps });
  } catch (error) {
    return response(500, { error: error.message || 'sequence failed' });
  }
};
