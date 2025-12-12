# ferro v2 設計書・仕様書

## 目的

音に反応する ferro（メッシュ主体）を中核に、背景（世界観）の表現幅を高め、AI が"世界のルール"を主導して調律する体験を作る。

## 0. 非機能要件

- ブラウザ（モバイル含む）で安定動作
- 長時間起動しても破綻しない（メモリリーク/GC 抑制）
- AI は毎フレーム関与しない（10〜60 秒間隔で更新）
- 変化は急にしない（遷移は常に補間）

## 1. 全体アーキテクチャ

### 1.1 モジュール構成

- **AudioEngine**：WebAudio で特徴量抽出（RMS/Bands/Flux/Beat）
- **WorldState**：現在の世界状態（mood + params）を保持
- **AIConductor**：Audio 要約 →OpenAI API→WorldTarget（目標値）取得
- **TransitionEngine**：現在値 → 目標値を GSAP 等で滑らかに補間
- **RendererCore（Three.js）**：
  - FerroMesh（ShaderMaterial）
  - BackgroundSystem（Shader + Fog + PostProcessing）
  - Particles（任意/軽め）
  - PostFX（EffectComposer）

### 1.2 データフロー

1. AudioEngine が毎フレーム特徴量更新
2. RendererCore がその特徴量で"瞬間的な揺れ"を加える（軽量）
3. AIConductor が一定間隔で特徴量を要約し、WorldTarget を取得
4. TransitionEngine が WorldState を WorldTarget へ遷移（5〜20 秒）

## 2. 世界観（背景）設計：BackgroundSystem

背景は「種類を増やす」のではなく、少数の背景スタイルを"パラメータで育てる"。

### 2.1 背景スタイル（最小 4）

- **SoftGradient**：柔らかいグラデ + 微ノイズ
- **Mist**：霧（距離/高さで変化） + ビネット
- **DeepSpace**：深い暗部 + 低彩度グロー（集中用）
- **GlowField**：コントラスト強めの光場（Wild 寄りだが上品に）

### 2.2 背景の実装方式

- 背景は基本「フルスクリーンクアッド（Plane）」+ ShaderMaterial
- 霧は THREE.FogExp2 または背景シェーダ内で擬似 Fog
- 最終の"空気感"は PostFX（Bloom/Noise/Vignette）で統一

### 2.3 背景が持つパラメータ（AI が操作）

- `bgStyle`：背景スタイル名
- `bgGradientA`, `bgGradientB`：背景 2 色（上限 2〜3 色）
- `bgNoiseAmount`：背景の粒子ノイズ量（0〜0.25 推奨）
- `bgFogDensity`：霧密度（0〜0.8）
- `bgVignette`：集中感（0〜0.8）
- `bgMotion`：背景のゆらぎ速度（0〜1）
- `bloomIntensity`：Bloom（0〜1.2）
- `grainAmount`：Grain/Noise（0〜0.35）

**制約**：背景の変化速度は本体より遅く（"世界が先に暴れない"）

## 3. ferro 本体（メッシュ）設計：FerroMesh

### 3.1 機能要件

- 初期形状（現状のポリゴン/メッシュ）をコアとして維持
- 音に応じて「横揺れ」「呼吸」「変形」を段階的に切替
- 色変更（base/accent）を外部入力で可能にする
- **Mesh Only Mode**：パーティクル/背景 FX を抑え、メッシュ主体で成立させる

### 3.2 FerroMesh：主要パラメータ（AI が操作）

#### 形状

- `deformStrength`：変形量（0〜1）
- `deformScale`：変形粒度（0.5〜3）
- `deformSpeed`：変形速度（0〜2）
- `swayAmount`：横揺れ量（0〜1）
- `swaySpeed`：横揺れ速度（0〜1.5）
- `pulseAmount`：呼吸量（0〜1）

#### 重力/磁力っぽさ（見た目）

- `gravityStrength`：重力感（0〜1）※実物理でなく変形バイアス
- `attractStrength`：中心へ吸引（0〜1）

#### 色/質感

- `baseColor`：本体ベース色（HEX）
- `accentColor`：アクセント色（HEX）※任意
- `saturation`：彩度（0〜0.7 上限推奨）
- `roughness`：0〜1
- `metalness`：0〜1
- `envIntensity`：環境反射強度（0〜2）

### 3.3 Mesh Only Mode

- `renderMode: "meshOnly" | "full"`
- meshOnly 時：
  - Particles：停止 or 密度 0
  - PostFX：Bloom/Grain を最小限（上限を下げる）
  - 背景：SoftGradient 固定 or 霧を薄く
- full 時：
  - 背景スタイル+PostFX を解放

## 4. 音解析：AudioEngine（最低限）

毎フレーム更新（60fps 想定）

### 4.1 出力（frame features）

- `rms`：全体音量
- `bands: { bass, mid, treble }`
- `flux`：変化量（前フレームとの差分）
- `beat`：簡易ピーク検出（0/1 or 0..1）

### 4.2 スムージング

- `rmsSmoothed`：EMA（ex: 0.1〜0.2）
- `fluxSmoothed`：EMA（ex: 0.2〜0.35）

見た目の上品さはここで決まる

## 5. AI 制御：AIConductor（OpenAI API）

### 5.1 更新間隔

- デフォルト：30s（音が激変したら 15s に短縮しても OK）
- "平常時は更新しない"も可（flux が低いときはスキップ）

### 5.2 AI へ渡す要約（例）

- 過去 20 秒の統計（平均/最大/分散）
- 現在時刻（朝/夜）
- 現在 mood と前回の変更からの経過秒

### 5.3 AI の出力（WorldTarget）

AI は 数値と列挙だけ返す（文章禁止）

## 6. TransitionEngine（遷移）

### 6.1 要件

- WorldState.current を WorldTarget に向けて補間
- すべての uniform は "目標値" を持ち、`gsap.to(uniform, { value: target, duration })` で遷移

### 6.2 遷移原則

- 色：lerp（HSV で補間しても良い）
- Fog/Bloom：急変禁止（最低 8 秒）
- mood が wild→calm に戻るとき：戻りはさらに遅く（12〜20 秒）

## 7. RendererCore（Three.js 実装指針）

### 7.1 基本

- WebGLRenderer：`setPixelRatio(Math.min(devicePixelRatio, 2))`
- 影は必要最低限（基本 OFF でも可）
- OrbitControls はデバッグ限定（本番 OFF）

### 7.2 Shader 方針

- FerroMesh：頂点で displacement（noise + sway + gravity bias）
- Fragment で質感（PBR 寄せ：MeshStandardMaterial + onBeforeCompile でも可）
- Background：フルスクリーンクアッドでグラデ/霧/ノイズ

### 7.3 PostFX

- EffectComposer
- 最小：Bloom + Vignette + Film/Noise（必要なら）
- meshOnly では Bloom/Noise 弱め固定

## 8. ディレクトリ案（例）

```
src/
  core/
    renderer/
      RendererCore.ts
      PostFX.ts
      BackgroundSystem.ts
      FerroMesh.ts
      Particles.ts
    audio/
      AudioEngine.ts
      features.ts
    ai/
      AIConductor.ts
      prompts.ts
      schema.ts
    state/
      WorldState.ts
      TransitionEngine.ts
  app/
    main.ts
    config.ts
```

## 9. OpenAI へのプロンプト方針（重要）

- AI には「数値だけ返す」ルールを強制
- "世界観の狙い"は短いタグで渡す（例：calm, deep, minimal, work-friendly）
- 「派手禁止」「色数制限」「変化上限」を明記

## 10. Reflection（状態の反射）

AI が生成する Reflection は、音と時間から推測された「状態の反射」であり、キャラクターや解説ではない。

**詳細は** [`v2-reflection-rules.md`](./v2-reflection-rules.md) **を参照**
