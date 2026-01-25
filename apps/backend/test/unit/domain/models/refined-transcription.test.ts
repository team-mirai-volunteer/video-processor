import { describe, expect, it } from 'vitest';
import { RefinedTranscription } from '../../../../src/domain/models/refined-transcription.js';

describe('RefinedTranscription', () => {
  const generateId = () => 'test-id-123';

  const validParams = {
    transcriptionId: 'trans-1',
    fullText: 'どうも、こんにちは。チームみらい党首の安野たかひろです。',
    sentences: [
      {
        text: 'どうも、こんにちは。',
        startTimeSeconds: 0.08,
        endTimeSeconds: 0.8,
        originalSegmentIndices: [0, 1, 2],
      },
      {
        text: 'チームみらい党首の安野たかひろです。',
        startTimeSeconds: 0.82,
        endTimeSeconds: 2.5,
        originalSegmentIndices: [3, 4, 5, 6, 7],
      },
    ],
    dictionaryVersion: '1.0.0',
  };

  describe('create', () => {
    it('should create a RefinedTranscription with valid params', () => {
      const result = RefinedTranscription.create(validParams, generateId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('test-id-123');
        expect(result.value.transcriptionId).toBe('trans-1');
        expect(result.value.fullText).toBe(validParams.fullText);
        expect(result.value.sentences).toHaveLength(2);
        expect(result.value.dictionaryVersion).toBe('1.0.0');
        expect(result.value.createdAt).toBeInstanceOf(Date);
        expect(result.value.updatedAt).toBeInstanceOf(Date);
      }
    });

    it('should return error for empty fullText', () => {
      const result = RefinedTranscription.create({ ...validParams, fullText: '' }, generateId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_TEXT');
      }
    });

    it('should return error for whitespace-only fullText', () => {
      const result = RefinedTranscription.create({ ...validParams, fullText: '   ' }, generateId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_TEXT');
      }
    });

    it('should return error for empty sentences array', () => {
      const result = RefinedTranscription.create({ ...validParams, sentences: [] }, generateId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_SENTENCES');
      }
    });

    it('should return error for empty dictionaryVersion', () => {
      const result = RefinedTranscription.create(
        { ...validParams, dictionaryVersion: '' },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DICTIONARY_VERSION');
      }
    });
  });

  describe('fromProps', () => {
    it('should reconstruct RefinedTranscription from props', () => {
      const now = new Date();
      const props = {
        id: 'refined-1',
        transcriptionId: 'trans-1',
        fullText: validParams.fullText,
        sentences: validParams.sentences,
        dictionaryVersion: '1.0.0',
        createdAt: now,
        updatedAt: now,
      };

      const refinedTranscription = RefinedTranscription.fromProps(props);

      expect(refinedTranscription.id).toBe('refined-1');
      expect(refinedTranscription.transcriptionId).toBe('trans-1');
      expect(refinedTranscription.fullText).toBe(props.fullText);
      expect(refinedTranscription.sentences).toEqual(props.sentences);
      expect(refinedTranscription.dictionaryVersion).toBe('1.0.0');
      expect(refinedTranscription.createdAt).toBe(now);
      expect(refinedTranscription.updatedAt).toBe(now);
    });
  });

  describe('toProps', () => {
    it('should convert to plain object', () => {
      const result = RefinedTranscription.create(validParams, generateId);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const props = result.value.toProps();

      expect(props.id).toBe('test-id-123');
      expect(props.transcriptionId).toBe('trans-1');
      expect(props.fullText).toBe(validParams.fullText);
      expect(props.sentences).toEqual(validParams.sentences);
      expect(props.dictionaryVersion).toBe('1.0.0');
      expect(props.createdAt).toBeInstanceOf(Date);
      expect(props.updatedAt).toBeInstanceOf(Date);
    });
  });
});
