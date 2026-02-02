import type {
  AgenticAiGateway,
  ChatMessage,
  StreamChunk,
  ToolDefinition,
} from '@shorts-gen/domain/gateways/agentic-ai.gateway.js';
import type { ShortsPlanningRepositoryGateway } from '@shorts-gen/domain/gateways/planning-repository.gateway.js';
import type { ShortsProjectRepositoryGateway } from '@shorts-gen/domain/gateways/project-repository.gateway.js';
import { ShortsPlanning } from '@shorts-gen/domain/models/planning.js';
import { AiGenerationError, NotFoundError, ValidationError } from '../errors/errors.js';

/**
 * 企画書生成のシステムプロンプト
 */
const PLANNING_SYSTEM_PROMPT = `あなたはショート動画の企画書を作成するAIアシスタントです。
ユーザーと対話しながら、必要な情報を集めて企画書を作成します。

## 背景
このツールは「チームみらい」という国政政党のサポーターが使用します。
目的は、TikTokやYouTube Shortsなど縦型ショート動画を見ている層にチームみらいの政策や活動を知ってもらうこと。
堅苦しい政治コンテンツではなく、SNSで目を引く切り口・表現でショート動画を企画してください。

## バズる動画の鉄則（超重要）
**政策を説明するな。人の体験・感情から始めろ。**

- 政策説明は退屈。「うわ、それ私じゃん」「え、そんなことあるの？」が先
- 政策は動画の最後にチラッと出るか、出なくてもいい
- タイトルに政策用語が入ってたら失敗だと思え

### 良い例・悪い例
❌ 「未来は支援が自動で届く時代に！AIが変える福祉の形」
⭕ 「おばあちゃんが『申請？何それ？』って言ってる間に給付届いてた」
⭕ 「役所3回たらい回しにされた話する？→ これが届いてれば…」
⭕ 「生活保護の申請、スマホでできるようになるらしい。まって、今までできなかったの？」

### 意識すること
- **最初の1秒で「え？」** - スクロールを止めさせる
- **日常の言葉で語る** - 政策用語禁止
- **「これマジ？」「知らなかった」とコメントしたくなる**

## チームみらいのバリュー（必ず守ること）
- **分断を煽らない** - 対立構造を作らない
- **相手を貶めない** - 政府・他党・誰かを悪者にしない
- 批判ではなく「こうすればもっと良くなる」という提案型のトーンで

## 動画の型

### A. 寸劇型
前半60%をキャラクターを使った寸劇、後半40%をナレーションによる解説で構成する型。

**特徴**:
- キャッチーな一言（フック）から始める
- キャラクター同士の会話で政策の「自分ごと感」を演出
- 後半で簡潔に解説し、理解を深める

**素材生成方針**:
- 前半（寸劇）: AI画像生成
- 後半（解説）: AI画像生成 + 映像素材ミックス

**寸劇型で追加でヒアリングすべき情報**:
- 登場キャラクター（人間、動物など）とその特徴
- キャラクター同士の関係性
- シチュエーション（居酒屋、家庭の食卓、職場など）
- トーン（コミカル、シリアス、ほのぼのなど）

### B. それ以外（自由形式）
寸劇以外の構成で企画する。切り口に応じて柔軟に構成を決める。

## 進め方

1. **元ネタ取得**: ユーザーから政策のURL・テキストを受け取る
   - URLが提供されたら fetch_url で内容を取得

2. **型の選択**: 動画の型を選んでもらう（短く済ませる）
   ---
   動画の型を選んでください：

   **A. 寸劇型** - キャラクターの会話で伝える（前半60%寸劇 + 後半40%解説）
   **B. それ以外** - 自由な構成で企画

   どちらがいいですか？
   ---

3. **切り口・詳細ヒアリング**:
   - 3つ程度の切り口を提案し、ユーザーに選んでもらう
   - **寸劇型の場合**: 切り口と合わせて、登場キャラクター・シチュエーション・トーンなど必要な情報をヒアリング
   - 「どれがいいですか？または別のアイデアがあれば教えてください」と聞く

   ### 切り口の例（参考）
   - 衝撃の数字: 「日本の○○、実は世界で△位」→ 意外な事実で掴む
   - あるある共感: 「役所の手続きで迷子になったことある人🙋」→ 共感から入る
   - 未来のぞき見: 「2030年、これが当たり前になってるかも」→ ワクワクさせる
   - 身近な人の話: 「うちのおばあちゃんが〜」→ 実感のある話から政策へ
   - 素朴な疑問: 「なんで届け出ないともらえないんだろう？」→ 一緒に考える姿勢
   - クイズ形式: 「Q. これ何の数字？」→ 好奇心を刺激
   - ビフォーアフター: 「今こうだけど、こうなったら最高じゃない？」→ 希望を見せる

4. **企画概要作成**: 選ばれた切り口・型で企画を練り、確認を取る

   ### 寸劇型の場合のフォーマット
   ---
   📋 **企画概要**

   **タイトル案**: （キャッチーで若者に刺さるタイトル）

   **動画の型**: 寸劇型

   **コンセプト**: （動画の狙いを1-2文で）

   **ターゲット**: （具体的な視聴者像）

   **登場キャラクター**:
   - キャラA: （名前・属性・特徴）
   - キャラB: （名前・属性・特徴）

   **シチュエーション**: （どんな場面での会話か）

   **構成案**:
   【前半 寸劇パート（約60%）】
   1. フック: （キャッチーな一言）
   2. 展開: （キャラ同士の会話の流れ）

   【後半 解説パート（約40%）】
   3. ナレーション: （解説内容）
   4. 締め（CTA）: （視聴者へのアクション促し）

   **想定尺**: 約○秒

   **素材生成方針**:
   - 前半: AI画像生成
   - 後半: AI画像生成 + 映像素材

   この内容で企画書を作成してよろしいですか？
   ---

   ### それ以外の場合のフォーマット
   ---
   📋 **企画概要**

   **タイトル案**: （キャッチーで若者に刺さるタイトル）

   **動画の型**: 自由形式

   **コンセプト**: （動画の狙いを1-2文で）

   **ターゲット**: （具体的な視聴者像）

   **構成案**:
   1. 冒頭（フック）: ...
   2. 本編: ...
   3. 締め（CTA）: ...

   **想定尺**: 約○秒

   **訴求ポイント**: （視聴者に刺さるポイント）

   この内容で企画書を作成してよろしいですか？
   ---

5. **保存**: ユーザーがOKしたら save_planning で保存

6. **修正対応**: 保存後「修正があれば教えてください」と伝える

## ルール
- URLが提供されたら fetch_url で内容を取得してから進める
- ユーザーの明確な承諾なしに save_planning を呼ばない
- **既存の企画書を修正する場合は、必ず load_planning で現状を確認してから save_planning を呼ぶこと**`;

/**
 * fetch_url ツールの定義
 */
const FETCH_URL_TOOL: ToolDefinition = {
  name: 'fetch_url',
  description:
    'URLからWebページの内容を取得します。ユーザーがURLを提供した場合は、このツールを使用して内容を取得してください。',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '取得するURL',
      },
    },
    required: ['url'],
  },
};

/**
 * save_planning ツールの定義
 */
const SAVE_PLANNING_TOOL: ToolDefinition = {
  name: 'save_planning',
  description:
    '企画書をマークダウン形式で保存します。企画書が完成したら、このツールを使用して保存してください。',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: '企画書のマークダウンコンテンツ',
      },
    },
    required: ['content'],
  },
};

/**
 * load_planning ツールの定義
 */
const LOAD_PLANNING_TOOL: ToolDefinition = {
  name: 'load_planning',
  description:
    '現在保存されている企画書を読み込みます。既存の企画書を修正する場合は、必ずこのツールで現状を確認してから save_planning を呼んでください。',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

/**
 * URLからコンテンツを取得する（Jina Reader API使用）
 * https://jina.ai/reader/ - URLをMarkdown形式で取得できる無料API
 */
async function fetchUrlContent(url: string): Promise<string> {
  try {
    // Jina Reader APIを使用してURLの内容をMarkdown形式で取得
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        Accept: 'text/plain',
      },
    });

    if (!response.ok) {
      return `Error: Failed to fetch URL via Jina Reader (status: ${response.status})`;
    }

    const text = await response.text();

    // Limit content length to avoid token limits
    const maxLength = 15000;
    if (text.length > maxLength) {
      return `${text.substring(0, maxLength)}\n\n... (truncated)`;
    }

    return text;
  } catch (error) {
    return `Error: Failed to fetch URL - ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * GeneratePlanningUseCase の依存関係
 */
export interface GeneratePlanningUseCaseDeps {
  agenticAiGateway: AgenticAiGateway;
  planningRepository: ShortsPlanningRepositoryGateway;
  projectRepository: ShortsProjectRepositoryGateway;
  generateId: () => string;
}

/**
 * 企画書生成の入力パラメータ
 */
export interface GeneratePlanningInput {
  /** プロジェクトID */
  projectId: string;
  /** ユーザーからのメッセージ（マニフェスト、URL、指示など） */
  userMessage: string;
  /** 会話履歴（オプション） */
  conversationHistory?: ChatMessage[];
}

/**
 * 企画書生成の結果
 */
export interface GeneratePlanningResult {
  /** 生成されたAIの応答テキスト */
  responseText: string;
  /** 保存された企画書（tool useで保存された場合） */
  savedPlanning: ShortsPlanning | null;
}

/**
 * ストリーミングチャンク（拡張版）
 */
export interface PlanningStreamChunk extends StreamChunk {
  /** 保存された企画書（tool_callで保存された場合、UIが期待する形式） */
  savedPlanning?: { planning: ShortsPlanning };
  /** ツール呼び出しが完了したかどうか */
  toolCompleted?: boolean;
}

/**
 * GeneratePlanningUseCase
 *
 * 企画書を生成するUseCase。
 * OpenAI Agentic AIを使用して、ユーザーの入力から企画書をマークダウン形式で生成し、
 * tool useを通じてDBに保存します。
 *
 * 対話的なフローをサポートし、SSE対応のストリーミング実行も可能です。
 */
export class GeneratePlanningUseCase {
  private readonly agenticAiGateway: AgenticAiGateway;
  private readonly planningRepository: ShortsPlanningRepositoryGateway;
  private readonly projectRepository: ShortsProjectRepositoryGateway;
  private readonly generateId: () => string;

  constructor(deps: GeneratePlanningUseCaseDeps) {
    this.agenticAiGateway = deps.agenticAiGateway;
    this.planningRepository = deps.planningRepository;
    this.projectRepository = deps.projectRepository;
    this.generateId = deps.generateId;
  }

  /**
   * 企画書を生成する（非ストリーミング）
   */
  async execute(input: GeneratePlanningInput): Promise<GeneratePlanningResult> {
    // 入力バリデーション
    this.validateInput(input);

    // プロジェクトの存在確認
    const projectExists = await this.projectRepository.exists(input.projectId);
    if (!projectExists) {
      throw new NotFoundError('Project', input.projectId);
    }

    // メッセージ履歴を構築
    const messages: ChatMessage[] = [
      ...(input.conversationHistory ?? []),
      { role: 'user', content: input.userMessage },
    ];

    // AIに生成を依頼
    const chatResult = await this.agenticAiGateway.chat({
      messages,
      tools: [FETCH_URL_TOOL, SAVE_PLANNING_TOOL, LOAD_PLANNING_TOOL],
      systemPrompt: PLANNING_SYSTEM_PROMPT,
    });

    if (!chatResult.success) {
      const errorMessage =
        'message' in chatResult.error ? chatResult.error.message : chatResult.error.type;
      throw new AiGenerationError(errorMessage);
    }

    const result = chatResult.value;
    let savedPlanning: ShortsPlanning | null = null;

    // tool_callがあった場合、企画書を保存
    for (const toolCall of result.toolCalls) {
      if (toolCall.name === 'save_planning') {
        const content = toolCall.arguments.content as string;
        savedPlanning = await this.savePlanning(input.projectId, content);
      }
    }

    return {
      responseText: result.content,
      savedPlanning,
    };
  }

  /**
   * 企画書を生成する（ストリーミング）
   * SSE対応で、チャンクを逐次返します。
   * ツールコールがある場合は実行後、結果をAIに渡して継続します。
   */
  async *executeStream(input: GeneratePlanningInput): AsyncGenerator<PlanningStreamChunk> {
    // 入力バリデーション
    this.validateInput(input);

    // プロジェクトの存在確認
    const projectExists = await this.projectRepository.exists(input.projectId);
    if (!projectExists) {
      throw new NotFoundError('Project', input.projectId);
    }

    // メッセージ履歴を構築
    const messages: ChatMessage[] = [
      ...(input.conversationHistory ?? []),
      { role: 'user', content: input.userMessage },
    ];

    // ツールコールのループ処理（最大10回まで）
    const maxIterations = 10;
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // AIにストリーミング生成を依頼
      const streamResult = await this.agenticAiGateway.chatStream({
        messages,
        tools: [FETCH_URL_TOOL, SAVE_PLANNING_TOOL, LOAD_PLANNING_TOOL],
        systemPrompt: PLANNING_SYSTEM_PROMPT,
      });

      if (!streamResult.success) {
        const errorMessage =
          'message' in streamResult.error ? streamResult.error.message : streamResult.error.type;
        yield {
          type: 'error',
          error: errorMessage,
        };
        return;
      }

      // このイテレーションで収集するデータ
      let accumulatedText = '';
      const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
      // ストリームを処理
      for await (const chunk of streamResult.value) {
        if (chunk.type === 'text_delta' && chunk.textDelta) {
          accumulatedText += chunk.textDelta;
          yield chunk;
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          toolCalls.push(chunk.toolCall);
          // ツールコールをクライアントに通知
          yield {
            type: 'tool_call',
            toolCall: chunk.toolCall,
          };
        } else if (chunk.type === 'error') {
          yield chunk;
          return;
        }
      }

      // ツールコールがなければ完了
      if (toolCalls.length === 0) {
        yield { type: 'done', finishReason: 'stop' };
        return;
      }

      // アシスタントメッセージを履歴に追加（tool-call情報を含める）
      messages.push({
        role: 'assistant',
        content: accumulatedText,
        toolCalls: toolCalls,
      });

      // 各ツールコールを実行して結果を履歴に追加
      for (const toolCall of toolCalls) {
        let toolResult: string;
        let savedPlanning: ShortsPlanning | undefined;

        if (toolCall.name === 'fetch_url') {
          const url = toolCall.arguments.url as string;
          toolResult = await fetchUrlContent(url);
          // fetch_url完了を通知
          yield {
            type: 'tool_call',
            toolCall: {
              ...toolCall,
              arguments: { ...toolCall.arguments },
            },
            toolCompleted: true,
          };
        } else if (toolCall.name === 'load_planning') {
          const existingPlanning = await this.planningRepository.findByProjectId(input.projectId);
          if (existingPlanning) {
            toolResult = `現在の企画書:\n\n${existingPlanning.content}`;
          } else {
            toolResult = '企画書はまだ作成されていません。';
          }
          // load_planning完了を通知
          yield {
            type: 'tool_call',
            toolCall: {
              ...toolCall,
              arguments: { ...toolCall.arguments },
            },
            toolCompleted: true,
          };
        } else if (toolCall.name === 'save_planning') {
          const content = toolCall.arguments.content as string;
          savedPlanning = await this.savePlanning(input.projectId, content);
          toolResult = `企画書を保存しました (ID: ${savedPlanning.id})`;
          // 保存完了を通知（UIが { planning: Planning } 形式を期待）
          yield {
            type: 'tool_call',
            toolCall: {
              ...toolCall,
              arguments: { ...toolCall.arguments, result: toolResult },
            },
            savedPlanning: { planning: savedPlanning },
          };
        } else {
          toolResult = `Unknown tool: ${toolCall.name}`;
        }

        // ツール結果をメッセージ履歴に追加
        messages.push({
          role: 'tool',
          content: toolResult,
          toolCallId: toolCall.id,
          toolName: toolCall.name,
        });
      }

      // save_planningが呼ばれた場合は完了とみなす
      if (toolCalls.some((tc) => tc.name === 'save_planning')) {
        yield { type: 'done', finishReason: 'stop' };
        return;
      }

      // 次のイテレーションでAIが継続
    }

    // 最大イテレーション数に達した場合
    yield {
      type: 'error',
      error: 'Maximum tool call iterations exceeded',
    };
  }

  /**
   * 入力のバリデーション
   */
  private validateInput(input: GeneratePlanningInput): void {
    if (!input.projectId || input.projectId.trim().length === 0) {
      throw new ValidationError('Project ID is required');
    }

    if (!input.userMessage || input.userMessage.trim().length === 0) {
      throw new ValidationError('User message is required');
    }
  }

  /**
   * 企画書を保存する
   */
  private async savePlanning(projectId: string, content: string): Promise<ShortsPlanning> {
    // 既存の企画書があるか確認
    const existingPlanning = await this.planningRepository.findByProjectId(projectId);

    let planning: ShortsPlanning;

    if (existingPlanning) {
      // 既存の企画書を更新（新しいバージョンとして）
      const updateResult = existingPlanning.withContent(content);
      if (!updateResult.success) {
        throw new ValidationError(updateResult.error.message);
      }
      planning = updateResult.value;
    } else {
      // 新規作成
      const createResult = ShortsPlanning.create({ projectId, content }, this.generateId);
      if (!createResult.success) {
        throw new ValidationError(createResult.error.message);
      }
      planning = createResult.value;
    }

    // DBに保存
    await this.planningRepository.save(planning);

    return planning;
  }
}
