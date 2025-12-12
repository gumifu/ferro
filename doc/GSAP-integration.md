# GSAP統合ガイド

GSAP（GreenSock Animation Platform）を使用した滑らかな遷移システムの実装ガイドです。

## インストール

```bash
npm install gsap
```

## 主要コンポーネント

### 1. TransitionEngine

`lib/state/TransitionEngine.ts` - WorldStateからWorldTargetへの滑らかな遷移を管理します。

**特徴:**
- GSAPを使用したイージング付き遷移
- 複数パラメータの同期制御
- mood遷移に応じた動的な遷移時間とイージング
- wild→calm遷移は自動的に遅く（12-20秒）

**使用例:**

```typescript
import { TransitionEngine, type WorldState } from "@/lib/state/TransitionEngine";
import { clampWorldTarget, type WorldTarget } from "@/lib/types/worldTarget";

// 初期状態を設定
const initialState: WorldState = {
  renderMode: "full",
  mood: "neutral",
  ferro: {
    baseColor: "#3366ff",
    saturation: 0.5,
    // ... 他のパラメータ
  },
  background: {
    bgStyle: "SoftGradient",
    bgGradientA: "#1a0033",
    // ... 他のパラメータ
  },
};

// TransitionEngineを作成
const engine = new TransitionEngine(initialState, (state) => {
  // 状態が更新されるたびに呼ばれるコールバック
  // Three.jsのマテリアルなどを更新
  material.color.setHex(state.ferro.baseColor);
  material.metalness = state.ferro.metalness;
});

// 新しいWorldTargetに遷移
const target: WorldTarget = {
  version: "v2",
  renderMode: "full",
  mood: "pulse",
  transitionSeconds: 8,
  ferro: {
    baseColor: "#ff3366",
    // ... 他のパラメータ
  },
  background: {
    bgStyle: "GlowField",
    // ... 他のパラメータ
  },
};

// 値をクランプして遷移開始
const clampedTarget = clampWorldTarget(target);
engine.transitionTo(clampedTarget);
```

### 2. colorTransition ヘルパー

`lib/utils/colorTransition.ts` - Three.jsのColorオブジェクトをGSAPで遷移させるヘルパー関数。

**使用例:**

```typescript
import { transitionColor, transitionColorSequence } from "@/lib/utils/colorTransition";
import * as THREE from "three";

// 単一の色遷移
const material = new THREE.MeshStandardMaterial();
transitionColor(
  material.color,
  "#ff3366",
  2.0, // 2秒で遷移
  "power2.inOut"
);

// カラーパレットの循環遷移
const colorPalette = ["#3366ff", "#ff3366", "#66ff33"];
const stopAnimation = transitionColorSequence(
  material.color,
  colorPalette,
  2.0, // 各色への遷移時間
  "power2.inOut"
);

// アニメーションを停止する場合
stopAnimation();
```

## 既存コードへの統合

### 現在の実装（lerpColors）

```typescript
// 現在: 線形補間のみ
const t = (time * 0.5) % 1.0;
material.color.lerpColors(color1, color2, t);
```

### GSAPを使用した実装

```typescript
// 改善: イージング付きの滑らかな遷移
import { transitionColorSequence } from "@/lib/utils/colorTransition";

// カラーパレットの循環遷移
const stopAnimation = transitionColorSequence(
  material.color,
  currentSection.colorPalette,
  2.0, // 遷移時間
  "power2.inOut"
);

// クリーンアップ時に停止
useEffect(() => {
  return () => {
    stopAnimation();
  };
}, [currentSection]);
```

## イージング関数

GSAPでは様々なイージング関数が使用できます：

- `"power1.inOut"` - 軽い加速・減速
- `"power2.inOut"` - 中程度の加速・減速（推奨）
- `"power3.inOut"` - 強い加速・減速
- `"elastic.out"` - バネのような動き
- `"bounce.out"` - バウンス効果
- `"sine.inOut"` - サイン波のような滑らかさ

## パフォーマンス

GSAPは60fpsを維持するように最適化されています：

- ハードウェアアクセラレーションを活用
- 不要な再計算を最小化
- メモリ効率的な実装

## 参考

- [GSAP公式ドキュメント](https://greensock.com/docs/)
- `doc/v2-specification.md` - 遷移の設計原則
- `doc/v2-implementation-guide.md` - 実装ガイド

