import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssetRegistryClient } from '../../../../../src/contexts/shorts-gen/infrastructure/clients/asset-registry.client.js';

describe('AssetRegistryClient', () => {
  let client: AssetRegistryClient;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asset-registry-test-'));

    // Create directories
    await fs.promises.mkdir(path.join(tempDir, 'videos'), { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'bgm'), { recursive: true });

    client = new AssetRegistryClient(tempDir);
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('getVideoAsset', () => {
    it('should return ASSET_NOT_FOUND error for unknown key', () => {
      const result = client.getVideoAsset('unknown_key');

      expect(result.success).toBe(false);
      if (!result.success && result.error.type === 'ASSET_NOT_FOUND') {
        expect(result.error.key).toBe('unknown_key');
        expect(result.error.assetType).toBe('video');
      }
    });

    it('should return FILE_NOT_FOUND error when file does not exist in custom dir', () => {
      // speech_exciting exists in registry but file is not in tempDir
      const result = client.getVideoAsset('speech_exciting');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('FILE_NOT_FOUND');
      }
    });
  });

  describe('getBgmAsset', () => {
    it('should return ASSET_NOT_FOUND error for unknown key', () => {
      const result = client.getBgmAsset('unknown_key');

      expect(result.success).toBe(false);
      if (!result.success && result.error.type === 'ASSET_NOT_FOUND') {
        expect(result.error.key).toBe('unknown_key');
        expect(result.error.assetType).toBe('bgm');
      }
    });
  });

  describe('listVideoAssetKeys', () => {
    it('should return all video asset keys from registry', () => {
      const keys = client.listVideoAssetKeys();

      expect(keys).toContain('speech_exciting');
      expect(keys).toContain('speech_serious');
      expect(keys).toContain('speech_smiley');
      expect(keys).toContain('family_financial_struggle');
      expect(keys).toContain('family_relief');
      expect(keys.length).toBe(5);
    });
  });

  describe('listBgmAssetKeys', () => {
    it('should return all BGM asset keys from registry', () => {
      const keys = client.listBgmAssetKeys();

      // BGM is currently empty in the registry
      expect(keys).toEqual([]);
    });
  });

  describe('assetExists', () => {
    it('should return false for non-existent video asset key', () => {
      expect(client.assetExists('unknown_key', 'video')).toBe(false);
    });

    it('should return false when video file is missing in custom dir', () => {
      // speech_exciting exists in registry but not in tempDir
      expect(client.assetExists('speech_exciting', 'video')).toBe(false);
    });

    it('should return false for non-existent BGM asset', () => {
      expect(client.assetExists('unknown_key', 'bgm')).toBe(false);
    });
  });
});

describe('AssetRegistryClient with default assets', () => {
  it('should use default assets directory when no path is provided', () => {
    const client = new AssetRegistryClient();

    // The default registry should load
    const videoKeys = client.listVideoAssetKeys();
    const bgmKeys = client.listBgmAssetKeys();

    // These are the keys defined in asset-registry.ts
    expect(videoKeys).toContain('speech_exciting');
    expect(videoKeys).toContain('speech_serious');
    expect(videoKeys).toContain('speech_smiley');
    // BGM is currently empty in the registry
    expect(bgmKeys).toEqual([]);
  });
});
