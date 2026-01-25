import type { AiGateway } from '../../domain/gateways/ai.gateway.js';
import type { RefinedTranscriptionRepositoryGateway } from '../../domain/gateways/refined-transcription-repository.gateway.js';
import type { TranscriptionRepositoryGateway } from '../../domain/gateways/transcription-repository.gateway.js';
import {
  type RefinedSentence,
  RefinedTranscription,
} from '../../domain/models/refined-transcription.js';
import {
  type ProperNounDictionary,
  TranscriptRefinementPromptService,
} from '../../domain/services/transcript-refinement-prompt.service.js';
import { NotFoundError } from '../errors.js';

export interface RefineTranscriptUseCaseDeps {
  transcriptionRepository: TranscriptionRepositoryGateway;
  refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;
  aiGateway: AiGateway;
  generateId: () => string;
  loadDictionary: () => Promise<ProperNounDictionary>;
}

export interface RefineTranscriptResult {
  id: string;
  transcriptionId: string;
  fullText: string;
  sentenceCount: number;
  dictionaryVersion: string;
}

interface LlmResponse {
  sentences: RefinedSentence[];
}

export class RefineTranscriptUseCase {
  private readonly transcriptionRepository: TranscriptionRepositoryGateway;
  private readonly refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;
  private readonly aiGateway: AiGateway;
  private readonly generateId: () => string;
  private readonly loadDictionary: () => Promise<ProperNounDictionary>;
  private readonly promptService: TranscriptRefinementPromptService;

  constructor(deps: RefineTranscriptUseCaseDeps) {
    this.transcriptionRepository = deps.transcriptionRepository;
    this.refinedTranscriptionRepository = deps.refinedTranscriptionRepository;
    this.aiGateway = deps.aiGateway;
    this.generateId = deps.generateId;
    this.loadDictionary = deps.loadDictionary;
    this.promptService = new TranscriptRefinementPromptService();
  }

  private log(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`[RefineTranscriptUseCase] [${timestamp}] ${message}${logData}`);
  }

  async execute(videoId: string): Promise<RefineTranscriptResult> {
    this.log('Starting execution', { videoId });

    // 1. Get raw transcription by videoId
    const transcription = await this.transcriptionRepository.findByVideoId(videoId);
    if (!transcription) {
      throw new NotFoundError('Transcription', videoId);
    }
    this.log('Found transcription', {
      transcriptionId: transcription.id,
      segmentCount: transcription.segments.length,
    });

    // 2. Load proper noun dictionary
    this.log('Loading proper noun dictionary...');
    const dictionary = await this.loadDictionary();
    this.log('Dictionary loaded', {
      version: dictionary.version,
      entryCount: dictionary.entries.length,
    });

    // 3. Build prompt
    const prompt = this.promptService.buildPrompt(transcription.segments, dictionary);
    this.log('Prompt built', { promptLength: prompt.length });

    // 4. Call LLM
    this.log('Calling AI gateway...');
    const aiResponse = await this.aiGateway.generate(prompt);
    this.log('AI response received', { responseLength: aiResponse.length });

    // 5. Parse response
    const parsedResponse = this.parseResponse(aiResponse);
    this.log('Response parsed', { sentenceCount: parsedResponse.sentences.length });

    // 6. Generate fullText from sentences
    const fullText = parsedResponse.sentences.map((s) => s.text).join('');

    // 7. Create RefinedTranscription entity
    const refinedTranscriptionResult = RefinedTranscription.create(
      {
        transcriptionId: transcription.id,
        fullText,
        sentences: parsedResponse.sentences,
        dictionaryVersion: dictionary.version,
      },
      this.generateId
    );

    if (!refinedTranscriptionResult.success) {
      throw new Error(refinedTranscriptionResult.error.message);
    }

    const refinedTranscription = refinedTranscriptionResult.value;

    // 8. Save to repository
    await this.refinedTranscriptionRepository.save(refinedTranscription);
    this.log('Refined transcription saved', { id: refinedTranscription.id });

    // 9. Return result
    return {
      id: refinedTranscription.id,
      transcriptionId: refinedTranscription.transcriptionId,
      fullText: refinedTranscription.fullText,
      sentenceCount: refinedTranscription.sentences.length,
      dictionaryVersion: refinedTranscription.dictionaryVersion,
    };
  }

  private parseResponse(response: string): LlmResponse {
    // Try to extract JSON from the response
    // The LLM might include extra text before/after the JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response: No valid JSON found');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as LlmResponse;

      if (!parsed.sentences || !Array.isArray(parsed.sentences)) {
        throw new Error('Invalid response format: missing sentences array');
      }

      // Validate each sentence
      for (const sentence of parsed.sentences) {
        if (typeof sentence.text !== 'string') {
          throw new Error('Invalid sentence: missing text');
        }
        if (typeof sentence.startTimeSeconds !== 'number') {
          throw new Error('Invalid sentence: missing startTimeSeconds');
        }
        if (typeof sentence.endTimeSeconds !== 'number') {
          throw new Error('Invalid sentence: missing endTimeSeconds');
        }
        if (!Array.isArray(sentence.originalSegmentIndices)) {
          throw new Error('Invalid sentence: missing originalSegmentIndices');
        }
      }

      return parsed;
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(`Failed to parse AI response as JSON: ${e.message}`);
      }
      throw e;
    }
  }
}
