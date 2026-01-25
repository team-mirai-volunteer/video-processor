import type { TranscriptionSegment } from '../models/transcription.js';

/**
 * Dictionary entry for proper noun correction
 */
export interface DictionaryEntry {
  correct: string;
  category: string;
  description: string;
  wrongPatterns: string[];
}

/**
 * Proper noun dictionary structure
 */
export interface ProperNounDictionary {
  version: string;
  description: string;
  entries: DictionaryEntry[];
}

/**
 * Service for building prompts for transcript refinement
 */
export class TranscriptRefinementPromptService {
  /**
   * Build a prompt for refining raw transcription segments
   */
  buildPrompt(segments: TranscriptionSegment[], dictionary: ProperNounDictionary): string {
    const dictionarySection = this.buildDictionarySection(dictionary);
    const inputSection = this.buildInputSection(segments);

    return `あなたは日本語の音声認識結果を校正するアシスタントです。

## 固有名詞辞書
以下の固有名詞は必ず正しい表記に修正してください:
${dictionarySection}

## タスク
1. 単語レベルのセグメントを日本語の自然な文単位にマージ
2. 固有名詞を辞書に基づいて修正
3. 政治の文脈を考慮して同音異義語を補正
4. 各文のタイムスタンプ（開始/終了）を保持
5. マージ元のセグメントindexを記録

## 重要な注意事項
- 句点（。）で文を区切ってください
- 読点（、）は文の途中で使用し、文の区切りには使用しないでください
- 長すぎる文は適切な位置で分割してください
- 話者の発言が終わる自然な区切りを尊重してください

## 入力フォーマット
[index] [startTime-endTime] text

## 入力データ
${inputSection}

## 出力フォーマット（JSON）
必ず以下の形式のJSONのみを出力してください。説明文や前置きは不要です。
{
  "sentences": [
    {
      "text": "文章テキスト。",
      "startTimeSeconds": 0.08,
      "endTimeSeconds": 0.80,
      "originalSegmentIndices": [0, 1, 2, 3]
    }
  ]
}`;
  }

  /**
   * Build dictionary section of the prompt
   */
  private buildDictionarySection(dictionary: ProperNounDictionary): string {
    return dictionary.entries
      .map((entry) => {
        const wrongPatterns = entry.wrongPatterns.join('、');
        return `- ${wrongPatterns} → ${entry.correct}（${entry.description}）`;
      })
      .join('\n');
  }

  /**
   * Build input section with formatted segments
   */
  private buildInputSection(segments: TranscriptionSegment[]): string {
    return segments
      .map((segment, index) => {
        const start = segment.startTimeSeconds.toFixed(2);
        const end = segment.endTimeSeconds.toFixed(2);
        return `[${index}] [${start}-${end}] ${segment.text}`;
      })
      .join('\n');
  }
}
