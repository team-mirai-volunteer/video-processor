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

    // Create test asset files
    await fs.promises.writeFile(
      path.join(tempDir, 'videos', 'test-video.mp4'),
      'dummy video content'
    );
    await fs.promises.writeFile(path.join(tempDir, 'bgm', 'test-bgm.mp3'), 'dummy bgm content');

    // Create test registry
    const registry = {
      videos: {
        test_video: {
          path: 'videos/test-video.mp4',
          description: 'Test video asset',
          durationMs: 5000,
        },
        missing_video: {
          path: 'videos/non-existent.mp4',
          description: 'Video that does not exist',
          durationMs: 3000,
        },
      },
      bgm: {
        test_bgm: {
          path: 'bgm/test-bgm.mp3',
          description: 'Test BGM asset',
        },
        missing_bgm: {
          path: 'bgm/non-existent.mp3',
          description: 'BGM that does not exist',
        },
      },
    };

    await fs.promises.writeFile(
      path.join(tempDir, 'asset-registry.json'),
      JSON.stringify(registry, null, 2)
    );

    client = new AssetRegistryClient(tempDir);
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('getVideoAsset', () => {
    it('should return video asset info for existing asset', () => {
      const result = client.getVideoAsset('test_video');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.key).toBe('test_video');
        expect(result.value.absolutePath).toBe(path.join(tempDir, 'videos', 'test-video.mp4'));
        expect(result.value.description).toBe('Test video asset');
        expect(result.value.durationMs).toBe(5000);
      }
    });

    it('should return ASSET_NOT_FOUND error for unknown key', () => {
      const result = client.getVideoAsset('unknown_key');

      expect(result.success).toBe(false);
      if (!result.success && result.error.type === 'ASSET_NOT_FOUND') {
        expect(result.error.key).toBe('unknown_key');
        expect(result.error.assetType).toBe('video');
      }
    });

    it('should return FILE_NOT_FOUND error when file does not exist', () => {
      const result = client.getVideoAsset('missing_video');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('FILE_NOT_FOUND');
      }
    });
  });

  describe('getBgmAsset', () => {
    it('should return BGM asset info for existing asset', () => {
      const result = client.getBgmAsset('test_bgm');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.key).toBe('test_bgm');
        expect(result.value.absolutePath).toBe(path.join(tempDir, 'bgm', 'test-bgm.mp3'));
        expect(result.value.description).toBe('Test BGM asset');
      }
    });

    it('should return ASSET_NOT_FOUND error for unknown key', () => {
      const result = client.getBgmAsset('unknown_key');

      expect(result.success).toBe(false);
      if (!result.success && result.error.type === 'ASSET_NOT_FOUND') {
        expect(result.error.key).toBe('unknown_key');
        expect(result.error.assetType).toBe('bgm');
      }
    });

    it('should return FILE_NOT_FOUND error when file does not exist', () => {
      const result = client.getBgmAsset('missing_bgm');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('FILE_NOT_FOUND');
      }
    });
  });

  describe('listVideoAssetKeys', () => {
    it('should return all video asset keys', () => {
      const keys = client.listVideoAssetKeys();

      expect(keys).toContain('test_video');
      expect(keys).toContain('missing_video');
      expect(keys.length).toBe(2);
    });
  });

  describe('listBgmAssetKeys', () => {
    it('should return all BGM asset keys', () => {
      const keys = client.listBgmAssetKeys();

      expect(keys).toContain('test_bgm');
      expect(keys).toContain('missing_bgm');
      expect(keys.length).toBe(2);
    });
  });

  describe('assetExists', () => {
    it('should return true for existing video asset', () => {
      expect(client.assetExists('test_video', 'video')).toBe(true);
    });

    it('should return false for non-existent video asset', () => {
      expect(client.assetExists('unknown_key', 'video')).toBe(false);
    });

    it('should return false when video file is missing', () => {
      expect(client.assetExists('missing_video', 'video')).toBe(false);
    });

    it('should return true for existing BGM asset', () => {
      expect(client.assetExists('test_bgm', 'bgm')).toBe(true);
    });

    it('should return false for non-existent BGM asset', () => {
      expect(client.assetExists('unknown_key', 'bgm')).toBe(false);
    });

    it('should return false when BGM file is missing', () => {
      expect(client.assetExists('missing_bgm', 'bgm')).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear the internal cache and reload registry', async () => {
      // First load
      client.getVideoAsset('test_video');

      // Modify the registry file
      const newRegistry = {
        videos: {
          new_video: {
            path: 'videos/test-video.mp4',
            description: 'New video asset',
            durationMs: 8000,
          },
        },
        bgm: {},
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'asset-registry.json'),
        JSON.stringify(newRegistry, null, 2)
      );

      // Clear cache
      client.clearCache();

      // Should now see the new registry
      const keys = client.listVideoAssetKeys();
      expect(keys).toContain('new_video');
      expect(keys).not.toContain('test_video');
    });
  });

  describe('registry load error', () => {
    it('should return REGISTRY_LOAD_ERROR when registry file is missing', async () => {
      const emptyDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asset-registry-empty-'));
      const emptyClient = new AssetRegistryClient(emptyDir);

      const result = emptyClient.getVideoAsset('any_key');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('REGISTRY_LOAD_ERROR');
      }

      await fs.promises.rm(emptyDir, { recursive: true, force: true });
    });

    it('should return REGISTRY_LOAD_ERROR when registry file is invalid JSON', async () => {
      const invalidDir = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), 'asset-registry-invalid-')
      );
      await fs.promises.writeFile(path.join(invalidDir, 'asset-registry.json'), 'invalid json {');

      const invalidClient = new AssetRegistryClient(invalidDir);
      const result = invalidClient.getVideoAsset('any_key');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('REGISTRY_LOAD_ERROR');
      }

      await fs.promises.rm(invalidDir, { recursive: true, force: true });
    });
  });
});

describe('AssetRegistryClient with default assets', () => {
  it('should use default assets directory when no path is provided', () => {
    const client = new AssetRegistryClient();

    // The default registry should load
    const videoKeys = client.listVideoAssetKeys();
    const bgmKeys = client.listBgmAssetKeys();

    // These are the keys defined in the default asset-registry.json
    expect(videoKeys).toContain('speech_exciting');
    expect(videoKeys).toContain('speech_serious');
    expect(videoKeys).toContain('speech_smiley');
    // BGM is currently empty in the default registry
    expect(bgmKeys).toEqual([]);
  });
});
