import {
  type ClipSubtitleSegment,
  SUBTITLE_MAX_CHARS_PER_LINE,
} from '@clip-video/domain/models/clip-subtitle.js';
import type { RefinedSentence } from '@clip-video/domain/models/refined-transcription.js';

/**
 * 字幕分割のための入力データ
 */
export interface SubtitleSegmentationInput {
  clipStartSeconds: number;
  clipEndSeconds: number;
  refinedSentences: RefinedSentence[];
}

/**
 * SubtitleSegmentationPromptService
 *
 * LLMに字幕テキストをチャンク形式（1〜2行）で分割してもらい、タイムスタンプを割り当てる。
 *
 * 処理フロー:
 * 1. buildPrompt: 正規化全文テキストをLLMに渡し、番号付きチャンク形式で返すよう依頼
 * 2. parseResponse: LLM応答の各行をキーワードとして全文テキスト内を検索し、sliceで断片を復元
 * 3. splitLongLines: 16文字超の行を機械的に分割（フォールバック）
 * 4. assignTimestamps: 文字数按分でタイムスタンプを割り当て
 *
 * テキスト自体はsliceで機械的に復元するため、LLMのハルシネーションによるテキスト抜けが原理上発生しない。
 */
export class SubtitleSegmentationPromptService {
  /**
   * クリップ範囲のRefinedSentenceをフィルタリング
   */
  filterSentencesForClip(
    sentences: RefinedSentence[],
    clipStartSeconds: number,
    clipEndSeconds: number
  ): RefinedSentence[] {
    return sentences.filter(
      (s) => s.startTimeSeconds < clipEndSeconds && s.endTimeSeconds > clipStartSeconds
    );
  }

  /**
   * 正規化関数（句読点・空白除去）
   */
  normalizeText(text: string): string {
    return text.replace(/[、。！？!?\s]/g, '');
  }

  /**
   * RefinedSentenceから正規化全文テキストを生成
   */
  buildNormalizedFullText(sentences: RefinedSentence[]): string {
    return sentences.map((s) => this.normalizeText(s.text)).join('');
  }

  /**
   * 字幕分割用のプロンプトを生成
   * LLMには番号付きチャンク（1〜2行）形式で返すよう依頼する
   */
  buildPrompt(input: SubtitleSegmentationInput): string {
    const filteredSentences = this.filterSentencesForClip(
      input.refinedSentences,
      input.clipStartSeconds,
      input.clipEndSeconds
    );

    const fullText = this.buildNormalizedFullText(filteredSentences);

    return `あなたは動画の字幕編集者です。テキストを字幕用のチャンクに分けてください。

## テキスト
${fullText}

## タスク
上のテキストを字幕として画面に表示するために、1〜2行のチャンクに分けてください。

## ルール
- 1チャンクは1行または2行
- 各行は${SUBTITLE_MAX_CHARS_PER_LINE}文字以内
- 意味のまとまりで区切る（助詞の後、接続助詞の後、文末など）
- 単語の途中で区切らない
- テキストの全文を過不足なく含める
- 句読点は入れない（元テキストに句読点はありません）

## 出力形式
番号付きリスト形式で出力してください。2行のチャンクは字幕1画面に同時表示されます。
チャンクの間は空行で区切ってください。

## 例

テキスト: 今日はとても良い天気ですね皆さんお元気ですか元気ですよ

出力:
1. 今日はとても
2. 良い天気ですね

1. 皆さんお元気ですか

1. 元気ですよ`;
  }

  /**
   * LLMのレスポンスをパースし、チャンク構造を復元
   * 各行テキストをキーワードとして全文テキスト内を検索し、sliceで断片を復元する
   * @param response LLMの応答（番号付きリスト形式）
   * @param fullText 正規化全文テキスト
   * @returns セグメント配列（lines[]を持つ）
   */
  parseResponse(response: string, fullText: string): Array<{ lines: string[] }> {
    // レスポンスを行に分割してチャンクを構築
    // 対応形式:
    //   形式A (1./2.): "1. テキスト\n2. テキスト\n\n1. テキスト"
    //   形式B (連番+インデント): "1. テキスト\n   テキスト\n\n2. テキスト"
    const lines = response.split('\n');
    const chunks: Array<{ lineTexts: string[] }> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;

      // 番号付き行: "1. テキスト", "2. テキスト", "10. テキスト" etc.
      const numberedMatch = trimmed.match(/^\d+\.\s*(.+)$/);
      if (numberedMatch) {
        const text = (numberedMatch[1] as string).trim();
        chunks.push({ lineTexts: [text] });
        continue;
      }

      // インデントされた行（前のチャンクの2行目）
      if (line.match(/^\s+\S/) && chunks.length > 0) {
        const lastChunk = chunks[chunks.length - 1] as { lineTexts: string[] };
        if (lastChunk.lineTexts.length < 2) {
          lastChunk.lineTexts.push(trimmed);
        }
      }
    }

    if (chunks.length === 0) {
      throw new Error('Failed to parse AI response: No chunks found');
    }

    // 各チャンクの各行をキーワードとして全文テキスト内の位置を特定し、sliceで復元
    const breakPositions: Array<{ pos: number; chunkIndex: number; isSecondLine: boolean }> = [];
    let searchFrom = 0;

    for (const [ci, chunk] of chunks.entries()) {
      for (const [li, lineText] of chunk.lineTexts.entries()) {
        const normalizedLine = this.normalizeText(lineText);
        if (normalizedLine.length === 0) continue;

        const pos = fullText.indexOf(normalizedLine, searchFrom);
        if (pos === -1) continue;

        const endPos = pos + normalizedLine.length;
        breakPositions.push({
          pos: endPos,
          chunkIndex: ci,
          isSecondLine: li === 1,
        });
        searchFrom = endPos;
      }
    }

    // breakPositionsからセグメントを構築（sliceで復元）
    return this.buildSegmentsFromBreaks(breakPositions, chunks, fullText);
  }

  /**
   * break位置情報からセグメントを構築
   * チャンク構造（1行/2行）を保持しつつ、テキストはsliceで復元
   */
  private buildSegmentsFromBreaks(
    breakPositions: Array<{ pos: number; chunkIndex: number; isSecondLine: boolean }>,
    chunks: Array<{ lineTexts: string[] }>,
    fullText: string
  ): Array<{ lines: string[] }> {
    if (breakPositions.length === 0) {
      // 全てのキーワードが見つからなかった場合、全文を1セグメントで返す
      return [{ lines: [fullText] }];
    }

    const segments: Array<{ lines: string[] }> = [];
    let textPos = 0;

    // チャンクごとにbreakPositionsをグループ化して処理
    let bpIndex = 0;
    for (let ci = 0; ci < chunks.length; ci++) {
      const chunkBreaks: number[] = [];

      // このチャンクに属するbreak positionsを集める
      while (bpIndex < breakPositions.length && breakPositions[bpIndex]?.chunkIndex === ci) {
        chunkBreaks.push(breakPositions[bpIndex]?.pos as number);
        bpIndex++;
      }

      if (chunkBreaks.length === 0) continue;

      if (chunkBreaks.length === 1) {
        // 1行チャンク
        const endPos = chunkBreaks[0] as number;
        if (endPos > textPos) {
          segments.push({ lines: [fullText.slice(textPos, endPos)] });
          textPos = endPos;
        }
      } else {
        // 2行チャンク
        const midPos = chunkBreaks[0] as number;
        const endPos = chunkBreaks[1] as number;
        if (midPos > textPos && endPos > midPos) {
          segments.push({
            lines: [fullText.slice(textPos, midPos), fullText.slice(midPos, endPos)],
          });
          textPos = endPos;
        } else if (endPos > textPos) {
          // midPosがおかしい場合は1行として処理
          segments.push({ lines: [fullText.slice(textPos, endPos)] });
          textPos = endPos;
        }
      }
    }

    // 残りのテキスト
    if (textPos < fullText.length) {
      const remaining = fullText.slice(textPos);
      if (segments.length > 0) {
        const lastSeg = segments[segments.length - 1] as { lines: string[] };
        if (lastSeg.lines.length === 1) {
          // 最後のセグメントが1行なら2行目として追加
          lastSeg.lines.push(remaining);
        } else {
          segments.push({ lines: [remaining] });
        }
      } else {
        segments.push({ lines: [remaining] });
      }
    }

    return segments;
  }

  /**
   * セグメント内の16文字超の行を機械的に分割（フォールバック）
   */
  splitLongLines(segments: Array<{ lines: string[] }>): Array<{ lines: string[] }> {
    const result: Array<{ lines: string[] }> = [];

    for (const seg of segments) {
      // 全行を展開して16文字以内に分割
      const allLines: string[] = [];
      for (const line of seg.lines) {
        if (line.length <= SUBTITLE_MAX_CHARS_PER_LINE) {
          allLines.push(line);
        } else {
          for (let i = 0; i < line.length; i += SUBTITLE_MAX_CHARS_PER_LINE) {
            allLines.push(line.slice(i, i + SUBTITLE_MAX_CHARS_PER_LINE));
          }
        }
      }

      // 再度1〜2行のセグメントにグループ化
      let i = 0;
      while (i < allLines.length) {
        const current = allLines[i] as string;
        const next = allLines[i + 1];
        if (next) {
          result.push({ lines: [current, next] });
          i += 2;
        } else {
          result.push({ lines: [current] });
          i += 1;
        }
      }
    }

    return result;
  }

  /**
   * セグメントにタイムスタンプを文字数按分で割り当て
   */
  assignTimestamps(
    segments: Array<{ lines: string[] }>,
    sentences: RefinedSentence[],
    clipStartSeconds: number
  ): ClipSubtitleSegment[] {
    if (sentences.length === 0) {
      throw new Error('No sentences provided for timestamp assignment');
    }

    // 各sentenceの文字位置範囲を計算
    const sentenceRanges: Array<{
      sentence: RefinedSentence;
      charStart: number;
      charEnd: number;
    }> = [];
    let charPos = 0;
    for (const sentence of sentences) {
      const normalizedText = this.normalizeText(sentence.text);
      sentenceRanges.push({
        sentence,
        charStart: charPos,
        charEnd: charPos + normalizedText.length,
      });
      charPos += normalizedText.length;
    }

    // 各セグメントにタイムスタンプ割り当て
    const results: ClipSubtitleSegment[] = [];
    let currentCharPos = 0;

    for (const [i, seg] of segments.entries()) {
      const segmentText = seg.lines.join('');
      const segmentCharStart = currentCharPos;
      const segmentCharEnd = currentCharPos + segmentText.length;

      const startTime = this.charPosToTime(segmentCharStart, sentenceRanges, clipStartSeconds);
      const endTime = this.charPosToTime(segmentCharEnd, sentenceRanges, clipStartSeconds);

      results.push({
        index: i,
        lines: seg.lines,
        startTimeSeconds: Math.max(0, startTime),
        endTimeSeconds: Math.max(0, endTime),
      });

      currentCharPos = segmentCharEnd;
    }

    return results;
  }

  /**
   * 文字位置から時間を計算（文字数按分）
   */
  private charPosToTime(
    charPos: number,
    sentenceRanges: Array<{
      sentence: RefinedSentence;
      charStart: number;
      charEnd: number;
    }>,
    clipStartSeconds: number
  ): number {
    for (const range of sentenceRanges) {
      if (charPos >= range.charStart && charPos <= range.charEnd) {
        const { sentence, charStart, charEnd } = range;
        const sentenceLength = charEnd - charStart;

        if (sentenceLength === 0) {
          return sentence.startTimeSeconds - clipStartSeconds;
        }

        const ratio = (charPos - charStart) / sentenceLength;
        const duration = sentence.endTimeSeconds - sentence.startTimeSeconds;
        const absoluteTime = sentence.startTimeSeconds + duration * ratio;

        return absoluteTime - clipStartSeconds;
      }
    }

    const lastRange = sentenceRanges[sentenceRanges.length - 1];
    if (!lastRange) {
      return 0;
    }
    return lastRange.sentence.endTimeSeconds - clipStartSeconds;
  }
}
