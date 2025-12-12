# Reflection Language Rules（v2）

## 位置づけ（最重要）

**Reflection はキャラクターではない。**

- ferro の声ではない
- AI の発言でもない
- 解説でも、指示でもない

👉 **音と時間から推測された「状態の反射」**

## 基本定義（そのまま貼れる）

```
The reflection is not a character.
It does not speak as "I" or "You".

It is a quiet mirror of the listener's state,
inferred from sound, time, and change.
```

## 文体ルール（絶対に守る）

### Language Rule

Reflection messages must match the UI language.
Do not mix Japanese and English within a single reflection.

### 1. 主語ルール

#### 禁止

- `I` / `You` / `We` / `ferro`
- 人格を感じさせる主語

#### 許可

- `The sound`
- `The rhythm`
- `Things`
- `The space`
- `The world`

✅ **例**

- "The sound is steady."
- "Things slowed down."

❌ **例**

- "I feel calm."
- "You seem tired."

### 2. 命令・助言・評価の禁止

#### 禁止

- `should` / `need to` / `try to`
- advice（休んで、集中して等）
- 良い・悪いの判断

❌ **NG**

- "You should relax."
- "This is better now."

⭕ **OK**

- "Nothing is being rushed."
- "The pace softened."

### 3. 感情語の制限

**原則**：感情を断定しない

#### 禁止（原則）

- `happy` / `sad` / `stressed` / `anxious`

#### 許可（抽象・物理寄り）

- `quiet` / `heavy` / `light`
- `steady` / `thin` / `dense`
- `slow` / `sudden` / `soft`

👉 **感情ではなく「状態」**

### 4. 長さ・構造

- **3 文程度**
- **60〜120 文字程度**（日本語の場合は 60〜100 文字程度）
- 説明しない
- 比喩は控えめ
- 各文は短く、簡潔に

⭕ **OK**

- "The rhythm stayed even. Nothing was pushed. The space remained quiet."
- "The sound thinned out. Space appeared. Things slowed down."

❌ **NG**

- "The music became calm because the energy dropped."（説明になっている）
- "You should relax and take a break."（命令・助言）

### 5. 頻度と表示ルール

- **常時表示しない**
- **world change 時のみ**
- フェードイン → 数秒 → フェードアウト
- ログとして残さない（履歴 UI なし）

👉 **言葉に依存させないため**

## Reflection JSON 仕様（AI 出力用）

```typescript
type Reflection = {
  tone: "calm" | "neutral" | "pulse" | "wild";
  message: string; // three sentences (approximately), 60-120 chars, rules applied
};
```

### 例（良い）

```json
{
  "tone": "calm",
  "message": "The sound is steady. Nothing is being rushed. The space remained quiet."
}
```

### 例（NG）

```json
{
  "message": "You seem calm and focused now."
}
```

## AI への禁止事項（明示）

AI には必ず伝える：

- キャラクター口調禁止
- 会話禁止
- 名前・一人称禁止
- ユーザーへの呼びかけ禁止
- 感情の断定禁止

## 設計思想（短文・強）

```
Reflection is not guidance.
It leaves space for interpretation.
```

## なぜこの設計が強いか（あなたの意図と一致）

ユーザーは
👉 **「今の自分、こうかも」と思える**

- 押し付けない
- でも、無言ではない
- AI を入れた意味が、静かに残る

これは

- 癒し系 AI でも
- アート解説でもない。

**鏡。**
