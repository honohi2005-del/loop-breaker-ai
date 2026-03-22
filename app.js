const state = {
  mode: 'flat',
  tempo: 'normal',
  source: 'AI',
  runtimeReady: false,
  releaseTimer: null,
  session: null,
};

const el = {
  homeScreen: document.getElementById('homeScreen'),
  sessionScreen: document.getElementById('sessionScreen'),
  doneScreen: document.getElementById('doneScreen'),
  thoughtInput: document.getElementById('thoughtInput'),
  charCount: document.getElementById('charCount'),
  runtimeBadge: document.getElementById('runtimeBadge'),
  modeSelect: document.getElementById('modeSelect'),
  tempoSelect: document.getElementById('tempoSelect'),
  startBtn: document.getElementById('startBtn'),
  releaseBtn: document.getElementById('releaseBtn'),
  releaseModal: document.getElementById('releaseModal'),
  releaseInput: document.getElementById('releaseInput'),
  releaseCountdown: document.getElementById('releaseCountdown'),
  closeReleaseBtn: document.getElementById('closeReleaseBtn'),
  sessionMode: document.getElementById('sessionMode'),
  sessionSource: document.getElementById('sessionSource'),
  loopLabel: document.getElementById('loopLabel'),
  mainMessage: document.getElementById('mainMessage'),
  currentTask: document.getElementById('currentTask'),
  progressBar: document.getElementById('progressBar'),
  progressText: document.getElementById('progressText'),
  nextBtn: document.getElementById('nextBtn'),
  stopBtn: document.getElementById('stopBtn'),
  againBtn: document.getElementById('againBtn'),
  backBtn: document.getElementById('backBtn'),
};

const tempoMap = {
  slow: 6500,
  normal: 4500,
  fast: 3000,
};

function $(selector, root = document) {
  return root.querySelector(selector);
}

function setScreen(name) {
  for (const screen of [el.homeScreen, el.sessionScreen, el.doneScreen]) {
    screen.classList.remove('active');
  }
  if (name === 'home') el.homeScreen.classList.add('active');
  if (name === 'session') el.sessionScreen.classList.add('active');
  if (name === 'done') el.doneScreen.classList.add('active');
}

function setBadge(text, ai = false) {
  el.runtimeBadge.textContent = text;
  el.runtimeBadge.className = ai ? 'badge badge-outline' : 'badge badge-soft';
}

function updateCount() {
  el.charCount.textContent = `${el.thoughtInput.value.length} / 120`;
}

function setupSegments(container, key) {
  container.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-' + key + ']');
    if (!button) return;
    container.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    state[key] = button.dataset[key];
  });
}

async function apiCall(endpoint, payload) {
  const response = await fetch(`/.netlify/functions/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `${endpoint} failed`);
  }
  return response.json();
}

function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function pickUnique(array, count) {
  const pool = [...array];
  const output = [];
  while (pool.length && output.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    output.push(pool.splice(index, 1)[0]);
  }
  return output;
}

function createLocalIntervention(input, mode) {
  const t = (input || '').trim();
  let label = '曖昧な不快感ループ';
  if (/会話|言い方|失敗|言い過ぎ|思い返/.test(t)) label = '会話反省ループ';
  else if (/明日|将来|仕事|不安|心配/.test(t)) label = '未来不安ループ';
  else if (/自分|ダメ|恥|嫌い/.test(t)) label = '自己否定ループ';
  else if (/相手|嫌われ|どう思/.test(t)) label = '対人想像ループ';

  const messages = {
    flat: [
      'ここで検証はしません。',
      '結論はあとで扱います。',
      'いまは処理を止めます。',
      '今は保留で進みます。',
      '推論はここで切ります。',
    ],
    dry: [
      '同じ反復です。ここで切ります。',
      'この処理は打ち切りです。',
      '進展なし。停止します。',
      '今の推論は中断します。',
      'ループ検出。終了します。',
    ],
    soft: [
      '今は答えを急がなくて大丈夫です。',
      '少しだけ外側へ戻します。',
      'ここで一度、考えを離します。',
      '今は保留で十分です。',
      '短く切り替えていきます。',
    ],
  };

  const tasks = [
    '右側で青いものを2つ探してください。',
    '車内の直線を3つ見つけてください。',
    'いちばん遠い音を1つ探してください。',
    '動いていないものを3つ見つけてください。',
    '左手の温度を5秒感じてください。',
    '足裏の圧を10秒だけ感じてください。',
    'いちばん明るい場所を1つ選んでください。',
    '肩を1回だけ下げて3秒止めてください。',
    '丸い形を2つ探してください。',
    '四角い形を2つ探してください。',
    '金属っぽい質感を1つ探してください。',
    '白っぽいものを2つ見つけてください。',
    '左側から来る音を1つ拾ってください。',
    '座面に触れている面積を5秒感じてください。',
    '近いものと遠いものを1つずつ見てください。',
  ];

  const nexts = [
    '呼吸を1回だけ長く吐いてください。',
    '丸いものを2つ探してください。',
    '目線を少し上に動かしてください。',
    '近い音と遠い音を1つずつ分けてください。',
    '次は窓の端を1本だけ目で追ってください。',
    '次は手のひらを3秒だけ開いてください。',
    '次は暗い場所と明るい場所を1つずつ見てください。',
    '次は足の指を1回だけゆるめてください。',
  ];

  return {
    label,
    message: pick(messages[mode] || messages.flat),
    task: pick(tasks),
    next: pick(nexts),
  };
}

function createLocalSequence(mode, label) {
  const bank = [
    '右側の四角を2つ探してください。',
    '視界の中で一番静かな場所を選んでください。',
    '首の力を1回だけ抜いてください。',
    '近くの白いものを1つ見てください。',
    '手のひらの接触を感じてください。',
    '動いているものを2つ追ってください。',
    '音を3種類に分けてください。',
    '目の前の境界線を1つ見つけてください。',
    '考えの続きを禁止します。外を見てください。',
    `${label} は今は保留です。天井に近いものを見てください。`,
    '光っている点を1つだけ拾ってください。',
    '左側の音を1つ、右側の音を1つ分けてください。',
    '足裏の重さを5秒だけ感じてください。',
    '肩を下げたまま3秒止めてください。',
    '丸い形を2つだけ探してください。',
    '細い線を2本だけ見つけてください。',
    '遠い場所の色を1つ言葉にしてください。',
    '近い場所の影を1つ見つけてください。',
    '背中が触れている感覚を3秒だけ確認してください。',
    '大きい物と小さい物を1つずつ比べてください。',
    '静かな音を1つだけ選んでください。',
    '視線を水平に戻して3秒だけ保ってください。',
  ];
  const steps = pickUnique(bank, 5);
  return { steps };
}

async function fetchIntervention(input, mode) {
  try {
    const data = await apiCall('intervene', { input, mode });
    state.source = 'AI';
    return data;
  } catch {
    state.source = 'LOCAL';
    return createLocalIntervention(input, mode);
  }
}

async function fetchSequence(label, mode) {
  try {
    if (state.source !== 'AI') throw new Error('local');
    return await apiCall('sequence', { label, mode });
  } catch {
    state.source = 'LOCAL';
    return createLocalSequence(mode, label);
  }
}

function updateSessionHeader() {
  el.sessionMode.textContent = state.mode.toUpperCase();
  el.sessionSource.textContent = state.source === 'AI' ? 'AI' : 'LOCAL';
}

function renderStage(textTarget, text) {
  textTarget.textContent = text;
}

function clearSessionTimers() {
  if (!state.session) return;
  clearTimeout(state.session.timeoutId);
  clearInterval(state.session.progressId);
}

function finishSession() {
  clearSessionTimers();
  state.session = null;
  setScreen('done');
}

function advanceSession(manual = false) {
  if (!state.session) return;
  clearTimeout(state.session.timeoutId);
  clearInterval(state.session.progressId);

  const { steps } = state.session;
  if (state.session.index >= steps.length) {
    finishSession();
    return;
  }

  const current = steps[state.session.index];
  renderStage(el.currentTask, current.text);
  renderStage(el.loopLabel, state.session.label);
  renderStage(el.mainMessage, state.session.message);

  state.session.index += 1;
  const total = steps.length;
  const duration = manual ? tempoMap.fast : tempoMap[state.tempo] || tempoMap.normal;
  const startedAt = Date.now();
  el.progressText.textContent = `${state.session.index} / ${total}`;
  el.progressBar.style.width = `${((state.session.index - 1) / total) * 100}%`;

  state.session.progressId = setInterval(() => {
    const ratio = Math.min((Date.now() - startedAt) / duration, 1);
    el.progressBar.style.width = `${(((state.session.index - 1) + ratio) / total) * 100}%`;
  }, 80);

  state.session.timeoutId = setTimeout(() => advanceSession(false), duration);
}

async function startSession() {
  const input = el.thoughtInput.value.trim() || 'なんとなく嫌な気分が続く';
  el.startBtn.disabled = true;
  el.startBtn.textContent = '生成中…';

  const intervention = await fetchIntervention(input, state.mode);
  updateSessionHeader();
  setScreen('session');
  renderStage(el.loopLabel, intervention.label || 'ループ');
  renderStage(el.mainMessage, intervention.message || '今は止めます。');
  renderStage(el.currentTask, intervention.task || '周囲を見てください。');
  el.progressBar.style.width = '0%';
  el.progressText.textContent = '準備中';

  const sequence = await fetchSequence(intervention.label || 'ループ', state.mode);
  updateSessionHeader();

  const allSteps = [
    { text: intervention.task || '周囲を見てください。' },
    { text: intervention.next || '呼吸を1回だけ長く吐いてください。' },
    ...(sequence.steps || []).map(text => ({ text })),
  ];

  state.session = {
    label: intervention.label || 'ループ',
    message: intervention.message || '今は止めます。',
    steps: allSteps,
    index: 0,
    timeoutId: null,
    progressId: null,
  };

  advanceSession(false);
  el.startBtn.disabled = false;
  el.startBtn.textContent = 'Break the Loop';
}

function openReleaseModal() {
  el.releaseModal.classList.remove('hidden');
  el.releaseModal.setAttribute('aria-hidden', 'false');
  el.releaseInput.value = '';
  el.releaseCountdown.textContent = '30秒';
  let remaining = 30;
  clearInterval(state.releaseTimer);
  state.releaseTimer = setInterval(() => {
    remaining -= 1;
    el.releaseCountdown.textContent = `${remaining}秒`;
    if (remaining <= 0) closeReleaseModal(true);
  }, 1000);
}

function closeReleaseModal(expired = false) {
  clearInterval(state.releaseTimer);
  state.releaseTimer = null;
  if (expired) el.releaseInput.value = '';
  el.releaseModal.classList.add('hidden');
  el.releaseModal.setAttribute('aria-hidden', 'true');
}

async function detectRuntime() {
  try {
    const runtime = await apiCall('intervene', { input: 'テスト', mode: 'flat', probe: true });
    state.runtimeReady = true;
    state.source = 'AI';
    const label = runtime.provider ? `${String(runtime.provider).toUpperCase()} ready` : 'AI ready';
    setBadge(label, true);
  } catch {
    state.runtimeReady = false;
    state.source = 'LOCAL';
    setBadge('LOCAL fallback', false);
  }
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

el.thoughtInput.addEventListener('input', updateCount);
setupSegments(el.modeSelect, 'mode');
setupSegments(el.tempoSelect, 'tempo');
el.startBtn.addEventListener('click', startSession);
el.nextBtn.addEventListener('click', () => advanceSession(true));
el.stopBtn.addEventListener('click', finishSession);
el.againBtn.addEventListener('click', startSession);
el.backBtn.addEventListener('click', () => setScreen('home'));
el.releaseBtn.addEventListener('click', openReleaseModal);
el.closeReleaseBtn.addEventListener('click', () => closeReleaseModal(true));
el.releaseModal.addEventListener('click', (event) => {
  if (event.target === el.releaseModal) closeReleaseModal(true);
});

detectRuntime();
updateCount();
registerSW();
