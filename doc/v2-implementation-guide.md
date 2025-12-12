# ferro v2 実装ガイド

## 実装優先順位（スプリント）

### Sprint 1（AI なしで背景を作品化）

- [ ] BackgroundSystem 4 スタイル実装
- [ ] PostFX（Bloom/Vignette/Grain）実装
- [ ] WorldState 手動切替（キー操作で mood 変更）

**目標**：背景システムが独立して動作し、手動で mood を切り替えられる状態

### Sprint 2（色変更と meshOnly）

- [ ] ferro の baseColor/accentColor を uniform 化
- [ ] meshOnly モードで安定動作確認
- [ ] meshOnly 時の背景/FX 上限設定

**目標**：meshOnly モードで軽量かつ美しく動作する状態

### Sprint 3（AI 導入：編集者として）

- [ ] AIConductor：30 秒ごとに WorldTarget 取得
- [ ] TransitionEngine：全パラメータ補間
- [ ] AI プロンプト最適化

**目標**：AI が世界観を調律し、滑らかに遷移する状態

### Sprint 4（重力/磁力っぽさ）

- [ ] gravity bias（下側が少し伸びる/溜まる）
- [ ] attractStrength（中心へ戻る）
- [ ] 微調整とパフォーマンス最適化

**目標**：ferro がより有機的で自然な動きをする状態

## Cursor/Codex 向けタスク定義

### Task 1: WorldTarget 型と validation（clamp）を実装

**目的**：AI 出力を安全に受け入れるための型定義とバリデーション

**実装内容**：

- `lib/types/worldTarget.ts` に型定義を作成
- `clampWorldTarget` 関数を実装
- meshOnly 時の追加制約を適用

**参照**：`doc/v2-api-types.md`

### Task 2: TransitionEngine（GSAP で uniform 更新）実装

**目的**：WorldState から WorldTarget への滑らかな遷移

**実装内容**：

- `lib/state/TransitionEngine.ts` を作成
- GSAP を使用して uniform 値を補間
- 遷移時間とイージングを制御
- mood 変更時の特別な遷移ルールを実装

**参照**：`doc/v2-specification.md` セクション 6

### Task 3: BackgroundSystem（4 スタイル + uniforms）実装

**目的**：4 つの背景スタイルをパラメータで制御

**実装内容**：

- `core/renderer/BackgroundSystem.ts` を作成
- 4 つの背景スタイル（SoftGradient, Mist, DeepSpace, GlowField）を実装
- 背景パラメータを uniform 化
- 背景の変化速度を本体より遅く設定

**参照**：`doc/v2-specification.md` セクション 2

### Task 4: FerroMesh（baseColor/accentColor + deform + gravityBias）実装

**目的**：ferro メッシュの色と変形を外部制御可能にする

**実装内容**：

- `core/renderer/FerroMesh.ts` を作成
- baseColor/accentColor を uniform 化
- deform/sway/pulse パラメータを実装
- gravityBias と attractStrength を実装

**参照**：`doc/v2-specification.md` セクション 3

### Task 5: PostFX（Bloom/Vignette/Grain、meshOnly で上限変更）実装

**目的**：ポストエフェクトで最終的な空気感を調整

**実装内容**：

- `core/renderer/PostFX.ts` を作成
- EffectComposer をセットアップ
- Bloom/Vignette/Grain を実装
- meshOnly 時の上限変更ロジックを実装

**参照**：`doc/v2-specification.md` セクション 7.3

### Task 6: AIConductor（30s 間隔、features summary→WorldTarget JSON 取得）実装

**目的**：AI が音を分析して WorldTarget を生成

**実装内容**：

- `core/ai/AIConductor.ts` を作成
- AudioEngine から特徴量を要約
- OpenAI API を呼び出して WorldTarget を取得
- 30 秒間隔（flux が高いときは 15 秒）で更新
- プロンプトを最適化（数値のみ返すルールを強制）

**参照**：`doc/v2-specification.md` セクション 5、`doc/v2-reflection-rules.md`

## 実装時の注意事項

### パフォーマンス

- 毎フレームの処理は最小限に（AudioEngine と RendererCore のみ）
- AI 更新は非同期で、メインスレッドをブロックしない
- PostFX は必要最小限のパス数に

### メモリ管理

- シェーダーやテクスチャの適切な dispose
- イベントリスナーのクリーンアップ
- 長時間動作時のメモリリークチェック

### モバイル対応

- `setPixelRatio(Math.min(devicePixelRatio, 2))` でパフォーマンス調整
- meshOnly モードをデフォルトにする選択肢
- PostFX を簡略化するオプション

### デバッグ

- キー操作で mood を手動切り替え可能にする
- パラメータをリアルタイムで調整できる UI（開発時のみ）
- ログ出力で AI 更新タイミングを確認
