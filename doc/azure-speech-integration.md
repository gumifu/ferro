# Azure Speech AI 統合ガイド

## 概要

Azure Speech AIは、ferroプロジェクトで音声特徴量の解析を行うために統合されています。

**注意**: ferroは感情をラベリングしません。このモジュールは音声の技術的特徴（音量、周波数、リズムなど）を抽出するのみです。

## 現在の実装状況

### 実装済み

- ✅ Azure Speech AI用のAPI Route (`/api/azure-speech/analyze`)
- ✅ サーバーサイドでの環境変数管理
- ✅ クライアント側の`AzureSpeechModule`クラス

### 実装済み機能

- ✅ 音声認識機能（Speech-to-Text）
  - API Route: `/api/azure-speech/recognize`
  - `AzureSpeechModule.recognizeSpeech()` メソッド
  - UIコンポーネントでの音声認識結果表示

- ✅ リアルタイム音声認識（ストリーミング）
  - API Route: `/api/azure-speech/recognize-stream`
  - `AzureSpeechModule.startRealtimeRecognition()` メソッド
  - マイクストリームからリアルタイムで音声認識
  - 音声チャンクをバッファリングして1秒ごとに送信

### 将来の拡張予定

- 🔄 音声合成機能（Text-to-Speech）
- 🔄 より高度な音声特徴量の抽出
- 🔄 リアルタイム音声認識（ストリーミング）

## 環境変数の設定

### 開発環境（.env.local）

```env
# Azure Speech AI（サーバーサイド専用 - NEXT_PUBLIC_を付けない）
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=your_azure_region_here
```

### 本番環境（Vercel）

Vercelのダッシュボードで、以下のEnvironment Variablesを設定：

- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`

**重要**: `NEXT_PUBLIC_`プレフィックスを付けないでください。すべての環境変数はサーバーサイド専用です。

## 使用方法

### 音声認識（Speech-to-Text）

クライアント側からは、`AzureSpeechModule`クラスを使用してAPI Route経由で呼び出します：

```typescript
import { AzureSpeechModule } from "@/lib/ai/AzureSpeechModule";

const speechModule = new AzureSpeechModule();

// 音声データをテキストに変換
const result = await speechModule.recognizeSpeech(audioData, "ja-JP");

if (result) {
  console.log("認識されたテキスト:", result.text);
  console.log("信頼度:", result.confidence);
  console.log("言語:", result.language);
}
```

### UIコンポーネントでの使用

#### リアルタイム音声認識

`AudioControls`コンポーネントにリアルタイム音声認識ボタンが追加されています：

1. 「リアルタイム音声認識を開始」ボタンをクリック
2. マイクへのアクセスを許可
3. 音声認識結果がリアルタイムで表示されます
4. 「音声認識を停止」ボタンで停止

**特徴**:
- マイクストリームから直接音声認識を実行
- 音声チャンクをバッファリングして1秒ごとに送信
- 認識結果がリアルタイムで表示される

**注意**: 現在の実装では、音声チャンクを1秒ごとにまとめて送信しています。より低レイテンシが必要な場合は、WebSocketを使用した実装に変更する必要があります。

### 現在の実装

現在、音声解析は主に**Web Audio API**で行われています：

- `AudioInputModule.ts`でリアルタイムの音声解析を実装
- `volumeRms`, `bass`, `treble`などの特徴量を抽出

Azure Speech AIは、将来的により高度な音声解析が必要になった場合に使用する予定です。

## アーキテクチャ

```
クライアント側
  ↓
AzureSpeechModule (lib/ai/AzureSpeechModule.ts)
  ↓
API Route (/api/azure-speech/recognize または /api/azure-speech/analyze)
  ↓
サーバーサイド (Azure Speech REST API)
  ↓
解析結果を返す
```

## 注意事項

1. **APIキーの保護**: すべてのAPIキーはサーバーサイドで管理され、ブラウザに露出しません
2. **感情分析は行わない**: ferroは感情をラベリングしません。技術的特徴のみを抽出します
3. **Web Audio APIとの併用**: 現在はWeb Audio APIで音声解析を行い、Azure Speech AIは将来的な拡張用です

## トラブルシューティング

### 環境変数が読み込まれない

1. 開発サーバーを再起動してください
2. `.env.local`ファイルがプロジェクトルートにあることを確認
3. 環境変数名に`NEXT_PUBLIC_`が付いていないことを確認

### API Routeが404エラーを返す

1. API Routeのパスが正しいか確認 (`/api/azure-speech/analyze`)
2. サーバー側のログを確認
3. 環境変数が正しく設定されているか確認

## 参考資料

- [Azure Speech Service ドキュメント](https://learn.microsoft.com/ja-jp/azure/ai-services/speech-service/)
- [Azure Speech SDK for JavaScript](https://learn.microsoft.com/ja-jp/azure/ai-services/speech-service/quickstart-javascript-browser)

