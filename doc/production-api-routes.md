# API ルート実装ガイド

## 概要

ferro では、**開発環境と本番環境で同じ実装**を使用します。すべての AI プラン生成は API Route 経由で行われ、API キーをブラウザに露出させません。

## 現在の実装

✅ **実装完了**: すべての AI プラン生成は`/api/ai/generate-plan`経由で行われます。

- クライアント側は常に fetch で API Route を呼び出す
- サーバーサイドでのみ環境変数にアクセス
- `dangerouslyAllowBrowser: true`は不要（クライアント側で SDK を使用しない）

## 実装詳細

### 1. API ルート

`app/api/ai/generate-plan/route.ts`で、サーバーサイドで AI プランを生成します。

- Azure OpenAI と OpenAI API の両方に対応
- プロバイダーとモデルをリクエストパラメータで指定
- 環境変数はサーバーサイドでのみ読み込む

### 2. クライアント側

`AIPlannerFactory`は常に API Route 経由で呼び出します。

```typescript
// lib/ai/AIPlannerFactory.ts

async generatePlan(
  audioTimeline: AudioTimeline,
  userMoodText: string = ""
): Promise<FerroAnimationPlan | null> {
  // 常にAPI Route経由
  const response = await fetch("/api/ai/generate-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioTimeline,
      userMoodText,
      provider: useAIProviderStore.getState().provider,
      model: provider === "azure" ? azureModel : openaiModel,
    }),
  });
  // ...
}
```

### 3. 環境変数の管理

**重要**: すべての環境変数はサーバーサイド専用です。

- `.env.local`（開発環境）: `NEXT_PUBLIC_`を付けない
- Vercel Environment Variables（本番環境）: 同じキー名を使用

```env
# 開発環境と本番環境で同じキー名
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT_NAME=...
AZURE_OPENAI_API_VERSION=...
OPENAI_API_KEY=...
```

## セキュリティ上の注意

1. **API キーの保護**

   - クライアントサイドでは`NEXT_PUBLIC_`プレフィックスの環境変数を使用しない
   - サーバーサイドでのみ環境変数を読み込む

2. **レート制限**

   - API ルートにレート制限を実装する
   - ユーザー認証を追加する

3. **エラーハンドリング**
   - 詳細なエラーメッセージをクライアントに返さない
   - ログに記録する

## 移行手順

1. API ルートを作成（完了）
2. `AIPlannerFactory`を修正して、本番環境では API ルート経由で呼び出す
3. 環境変数をサーバーサイド専用に変更
4. テスト環境で動作確認
5. 本番環境にデプロイ

## 参考

- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
