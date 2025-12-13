# ferro | Interactive Sound Visualizer

音楽や環境音を解析し、そのデータを OpenAI で「ムード」と「構成」に変換し、Three.js（react-three-fiber）で動く磁性流体っぽいオブジェクト（ferro）を振り付けする。

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local`ファイルをプロジェクトルートに作成し、以下を追加：

#### Azure AI (デフォルト・推奨)

```env
# Azure OpenAI（サーバーサイド専用 - NEXT_PUBLIC_を付けない）
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini-2
AZURE_OPENAI_API_VERSION=2024-07-18

# Azure Speech AI (将来的な拡張用)
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=your_azure_region_here
```

#### OpenAI API (比較・検証用)

```env
# OpenAI API（サーバーサイド専用 - NEXT_PUBLIC_を付けない）
OPENAI_API_KEY=your_openai_api_key_here
```

**重要**:
- 環境変数は**サーバーサイド専用**です（`NEXT_PUBLIC_`プレフィックスを付けない）
- `.env.local`（開発環境）とVercel/本番環境のEnvironment Variablesに同じキーを設定してください
- APIキーはブラウザに露出されません（API Route経由で呼び出します）
- Azure AIがデフォルトです。設定がない場合、AI機能は無効になりますが、リアルタイムの音声反応は動作します
- 開発者向けのAIプロバイダー切り替え機能は、画面右上の「Settings」から利用できます

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## 使い方

### 音声入力の選択

- **Mic**: マイクからの音声入力に反応
- **Audio File**: ローカルの音声ファイルを再生
- **Tab Audio**: ブラウザタブの音声に反応（対応環境のみ）

### セッションの開始

1. 音声入力方法を選択（Mic または Audio File）
2. ファイルの場合は音声ファイルを選択
3. （任意）「今の気分や状況」にテキストを入力
4. 「Start Session」をクリック

### AI機能について

- ファイル再生時: 自動的にAIがムードを解析し、アニメーションプランを生成
- マイク使用時: 停止時に収集したタイムラインからプランを生成
- APIキー未設定時: リアルタイムの音声反応のみ動作（AI機能は無効）

## 技術スタック

- **Next.js 16** (App Router)
- **React / TypeScript**
- **@react-three/fiber** / **@react-three/drei**
- **Web Audio API**
- **Azure OpenAI** (デフォルト) / **OpenAI API** (比較・検証用)
- **Azure Speech AI** (将来的な拡張用)
- **Zustand** (状態管理)
- **Zod** (型検証)

## プロジェクト構造

```
ferro-visualize/
├── app/
│   └── page.tsx              # メインページ
├── components/
│   ├── controls/
│   │   └── AudioControls.tsx     # 音声入力コントロール
│   ├── three/
│   │   ├── FerroObject.tsx       # ferro オブジェクト
│   │   └── Scene.tsx             # Three.js シーン
│   └── visualizer/
│       ├── FerrofluidVisualizer.tsx # メインのビジュアライザー
│       └── ReflectionDisplay.tsx    # リフレクション表示
├── lib/
│   ├── audio/
│   │   └── AudioInputModule.ts  # 音声入力・解析
│   ├── ai/
│   │   ├── AIPlannerModule.ts   # OpenAI API 統合
│   │   ├── AzureAIPlannerModule.ts  # Azure OpenAI 統合
│   │   ├── AzureSpeechModule.ts     # Azure Speech AI 統合
│   │   └── AIPlannerFactory.ts  # AIプロバイダー切り替え
│   ├── stores/
│   │   ├── audioStore.ts        # 音声状態管理
│   │   ├── aiPlanStore.ts       # AIプラン状態管理
│   │   └── aiProviderStore.ts  # AIプロバイダー状態管理
│   └── types.ts                 # 型定義
└── .env.local                  # 環境変数（要作成）
```

## 開発フェーズ

- ✅ **Phase 1**: ベースの ferro + マイク連動
- ✅ **Phase 2**: AudioTimeline 生成
- ✅ **Phase 3**: OpenAI 統合（AIPlanner）
- 🔄 **Phase 4**: VisualEngine と統合（進行中）
- ⏳ **Phase 5**: UI / UX 仕上げ

## ライセンス

MIT
