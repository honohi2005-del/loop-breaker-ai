const { response, extractJson, callOpenAI, getRuntimeStatus } = require('./_shared');

const MODE_MESSAGE_BANK = {
  flat: [
    'ここで検証はしません。',
    '結論はあとで扱います。',
    '今は思考を止めます。',
    '今は保留で進みます。',
  ],
  dry: [
    'ミッション開始。1手ずつ進めます。',
    'ラウンド開始。次の行動へ。',
    'ステージ進行。外側を観察します。',
    'クエスト継続。短く切り替えます。',
  ],
  soft: [
    '今は答えを急がなくて大丈夫です。',
    '少し外側に注意を戻します。',
    '今は保留で十分です。',
    'ここで一度、考えを離します。',
  ],
};

const TASK_BANK = [
  '右側で青いものを2つ探してください。',
  '車内の直線を3つ見つけてください。',
  'いちばん遠い音を1つ選んでください。',
  '足裏の圧を10秒だけ感じてください。',
  '左手の温度差を5秒だけ確認してください。',
  '丸い形を2つ見つけてください。',
  '金属っぽい質感を1つ探してください。',
  '動いていない物を3つ数えてください。',
  '明るい場所と暗い場所を1つずつ見てください。',
  '座面に触れている面積を5秒感じてください。',
];

const NEXT_BANK = [
  '次は目線を少し上げて、四角を1つ探してください。',
  '次は呼吸を1回だけ長く吐いてください。',
  '次は近い音と遠い音を1つずつ分けてください。',
  '次は肩を3秒だけ下げて、そのまま止めてください。',
  '次は窓の端を1本だけ目で追ってください。',
  '次は手のひらを軽く開いて5秒止めてください。',
  '次は視界の左端の色を1つ言葉にしてください。',
  '次は足の指を1回だけゆるめてください。',
];

const LABEL_BANK = {
  conversation: ['会話反省ループ', '言い方検査ループ', '発言採点ループ', 'やり取り再生ループ'],
  future: ['未来予測ループ', '最悪想像ループ', '先回り不安ループ', '予定警戒ループ'],
  self: ['自己採点ループ', '自己否定ループ', '欠点拡大ループ', '恥記憶ループ'],
  social: ['対人想像ループ', '評価不安ループ', '視線解釈ループ', '嫌われ想定ループ'],
  generic: ['反芻ループ', '思考反復ループ', '不快反復ループ', '内省過熱ループ'],
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function clean(text, max) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function detectIntent(input) {
  if (/会話|言い方|失敗|言い過ぎ|思い返/.test(input)) return 'conversation';
  if (/明日|将来|仕事|不安|心配|最悪/.test(input)) return 'future';
  if (/自分|ダメ|恥|嫌い|価値/.test(input)) return 'self';
  if (/相手|嫌われ|どう思|評価|視線/.test(input)) return 'social';
  return 'generic';
}

function makeLocalIntervention(mode, input) {
  const intent = detectIntent(input);
  return {
    label: pick(LABEL_BANK[intent] || LABEL_BANK.generic),
    message: pick(MODE_MESSAGE_BANK[mode] || MODE_MESSAGE_BANK.flat),
    task: pick(TASK_BANK),
    next: pick(NEXT_BANK),
  };
}

function isGenericLabel(text) {
  return !text || /^ループ$/.test(text) || text.length < 5;
}

function isGenericMessage(text) {
  return !text || /^(今は処理しません。?|今は止めます。?)$/.test(text);
}

function isGenericTask(text) {
  return !text || /^(周囲を見てください。?|目の前を見てください。?)$/.test(text);
}

function isGenericNext(text) {
  return !text || /^(呼吸を1回だけ長く吐いてください。?)$/.test(text);
}

function isMostlyJapanese(text, options = {}) {
  const { minRatio = 0.45, minJpChars = 3 } = options;
  const raw = String(text || '').trim();
  if (!raw) return false;

  const visible = raw
    .replace(/\s+/g, '')
    .replace(/[0-9０-９.,!！?？:：;；\-—_()（）「」『』【】[\]/\\'"`~+*=<>|]/g, '');

  if (!visible) return false;
  const jpMatches = visible.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || [];
  const jpCount = jpMatches.length;

  return jpCount >= minJpChars && jpCount / visible.length >= minRatio;
}

function buildVariationPack() {
  const styleHints = [
    '語尾を毎回変える',
    '同じ動詞を繰り返さない',
    '視覚・聴覚・触覚を混ぜる',
    '数詞を必ず入れる',
    '具体物の名詞を入れる',
  ];
  const cutStyles = [
    '短く断定',
    '機械的で簡潔',
    '静かで柔らかい',
    '観察寄り',
  ];
  const taskShapes = [
    '探索タスク',
    '比較タスク',
    'カウントタスク',
    '姿勢タスク',
    '接触感覚タスク',
  ];
  return {
    seed: Math.floor(Math.random() * 1000000),
    styleHint: pick(styleHints),
    cutStyle: pick(cutStyles),
    taskShape: pick(taskShapes),
  };
}

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
    const variation = buildVariationPack();

    const instructions = `You are a rumination interruption generator.
Output valid JSON only in natural Japanese.
The user is in public transit; keep everything quiet and socially safe.
Never provide therapy, diagnosis, cause analysis, or questions.
Avoid generic wording and avoid repeating stock phrases.
Every output must feel like a different pattern.

Use this schema exactly:
{
  "label": "short Japanese label",
  "message": "short interruption sentence",
  "task": "one concrete immediate action",
  "next": "one concrete next micro-action"
}

Hard constraints:
- label must not be "ループ" alone; make it specific (example style: "会話反省ループ")
- message must be short and distinct from task/next
- task and next must be different from each other
- task and next must each include at least one concrete noun and one number
- no "考えてみて" / no abstract advice
- no repeated sentence openings
- output must be Japanese only
- no sarcasm, no insulting or harsh language

Tone mode: ${mode}
Tone details:
- flat: neutral and minimal
- dry: game-like mission voice, playful but short
- soft: calm and reassuring
Variation hint: ${variation.styleHint}
Cut style: ${variation.cutStyle}
Task shape: ${variation.taskShape}`;

    const output = await callOpenAI(
      instructions,
      `mode: ${mode}\nuser_input: ${userInput}\nvariation_seed: ${variation.seed}`
    );
    const parsed = extractJson(output);
    const local = makeLocalIntervention(mode, userInput);

    const label = clean(parsed.label, 40);
    const message = clean(parsed.message, 80);
    const task = clean(parsed.task, 80);
    const next = clean(parsed.next, 80);

    return response(200, {
      label: isGenericLabel(label) || !isMostlyJapanese(label, { minRatio: 0.3, minJpChars: 2 }) ? local.label : label,
      message: isGenericMessage(message) || !isMostlyJapanese(message, { minRatio: 0.45, minJpChars: 4 }) ? local.message : message,
      task: isGenericTask(task) || !isMostlyJapanese(task, { minRatio: 0.45, minJpChars: 4 }) ? local.task : task,
      next: isGenericNext(next) || next === task || !isMostlyJapanese(next, { minRatio: 0.45, minJpChars: 4 }) ? local.next : next,
    });
  } catch (error) {
    return response(500, { error: error.message || 'intervene failed' });
  }
};
