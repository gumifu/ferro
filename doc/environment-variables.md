# 環境変数の設定ガイド

## 概要

ferroでは、APIキーをブラウザに露出させないため、**すべての環境変数はサーバーサイド専用**です。

## 環境変数の設定

### 開発環境（.env.local）

プロジェクトルートに`.env.local`ファイルを作成し、以下を設定：

```env
# Azure OpenAI（デフォルト）
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini-2
AZURE_OPENAI_API_VERSION=2024-07-18

# OpenAI API（比較・検証用）
OPENAI_API_KEY=your_openai_api_key_here

# Azure Speech AI（将来的な拡張用）
# 注意: サーバーサイド専用（NEXT_PUBLIC_を付けない）
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=your_azure_region_here
```

### 本番環境（Vercel）

Vercelのダッシュボードで、以下のEnvironment Variablesを設定：

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT_NAME`
- `AZURE_OPENAI_API_VERSION`
- `OPENAI_API_KEY`（使用する場合）
- `AZURE_SPEECH_KEY`（使用する場合）
- `AZURE_SPEECH_REGION`（使用する場合）

## 重要な注意事項

1. **`NEXT_PUBLIC_`プレフィックスを付けない**
   - すべての環境変数はサーバーサイド専用です
   - `NEXT_PUBLIC_`を付けると、ブラウザに露出してしまいます

2. **開発環境と本番環境で同じキー名を使用**
   - `.env.local`とVercelのEnvironment Variablesで同じキー名を使用してください
   - これにより、コードを変更せずに環境を切り替えられます

3. **API Route経由で呼び出し**
   - クライアント側は常に`/api/ai/generate-plan`を呼び出します
   - サーバーサイドでAPIキーを使用するため、セキュリティが保たれます

## トラブルシューティング

### 環境変数が読み込まれない

1. 開発サーバーを再起動してください
2. `.env.local`ファイルがプロジェクトルートにあることを確認
3. 環境変数名に`NEXT_PUBLIC_`が付いていないことを確認

### 本番環境でエラーが出る

1. VercelのEnvironment Variablesに正しく設定されているか確認
2. 環境変数名が開発環境と同じか確認
3. デプロイ後に環境変数が反映されているか確認（再デプロイが必要な場合があります）

