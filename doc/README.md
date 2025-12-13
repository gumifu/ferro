# ferro v2 ドキュメント

このディレクトリには、ferro v2 の設計書・仕様書が含まれています。

## ドキュメント一覧

### [v2-specification.md](./v2-specification.md)

メインの仕様書。全体アーキテクチャ、モジュール構成、データフロー、各システムの設計が記載されています。

### [v2-api-types.md](./v2-api-types.md)

API 型定義とバリデーション仕様。WorldTarget 型の詳細と、制約・バリデーション関数が記載されています。

### [v2-implementation-guide.md](./v2-implementation-guide.md)

実装ガイド。スプリントごとの優先順位と、Cursor/Codex 向けのタスク定義が記載されています。

### [v2-reflection-rules.md](./v2-reflection-rules.md)

Reflection 言語ルール。AI が生成する Reflection メッセージの文体・構造・表示ルールが記載されています。

## クイックリファレンス

### 主要な概念

- **WorldTarget**: AI が生成する目標状態（すべてのパラメータを含む）
- **WorldState**: 現在の世界状態（WorldTarget に向けて遷移中）
- **TransitionEngine**: WorldState を WorldTarget へ滑らかに補間
- **Mesh Only Mode**: 軽量モード（パーティクル/背景 FX を最小限）
- **Reflection**: 音と時間から推測された「状態の反射」（キャラクターではない）

### 実装の流れ

1. Sprint 1: 背景システムと PostFX
2. Sprint 2: 色変更と meshOnly モード
3. Sprint 3: AI 導入と TransitionEngine
4. Sprint 4: 重力/磁力効果

## 参照方法

各タスクを実装する際は、対応するドキュメントを参照してください：

- 型定義が必要 → `v2-api-types.md`
- システム設計が必要 → `v2-specification.md`
- 実装手順が必要 → `v2-implementation-guide.md`


