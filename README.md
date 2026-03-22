# Loop Breaker AI

AI を組み込んだ PWA 版です。

## できること
- 一言入力 → AI が短いラベルと遮断文を生成
- そのまま短い観察タスクを連続表示
- Flat / Dry / Soft のトーン切り替え
- オフライン用の静的アセットをキャッシュ
- AI 関数が使えない環境ではローカル生成に自動フォールバック

## 重要
Netlify のドラッグ＆ドロップだけで公開した静的サイトでは、Netlify Functions は動きません。
AI を使うには、次のどちらかでデプロイしてください。

1. GitHub リポジトリを Netlify に Import する
2. Netlify CLI で deploy する

## Netlify でのおすすめ手順
1. このフォルダ一式を GitHub に置く
2. Netlify で `Add new project` → `Import an existing project`
3. GitHub リポジトリを選ぶ
4. Build command は空で OK
5. Publish directory は `.` のままで OK
6. Netlify の Site configuration / Environment variables で以下を追加
   - Groq を使う場合:
     - `GROQ_API_KEY` = あなたの Groq API key
     - 任意で `GROQ_MODEL` = 使いたいモデル名（既定: `llama-3.3-70b-versatile`）
   - OpenAI を使う場合:
     - `OPENAI_API_KEY` = あなたの OpenAI API key
     - 任意で `OPENAI_MODEL` = 使いたいモデル名
   - 任意で `AI_PROVIDER` = `groq` または `openai`
     - 未指定時は `GROQ_API_KEY` があれば Groq を優先、なければ OpenAI を使います。
7. 再デプロイ

## ローカル確認
静的表示だけなら:
```bash
npx serve .
```

Netlify Functions まで含めて確認するなら:
```bash
npm install
npx netlify dev
```

## 注意
これは反芻を一時的に中断するためのツールです。強い苦痛が続く場合は、専門家や信頼できる人への相談も検討してください。
