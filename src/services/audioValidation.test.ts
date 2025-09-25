import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockAudioFiles } from '@/tests/utils/testUtils';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

// Helper function to validate audio files (extracted from transcriptionService logic)
export function validateAudioFile(file: File): { isValid: boolean; error?: string } {
  // Check if file exists and has size
  if (!file || !file.size) {
    return { isValid: false, error: 'Invalid or empty audio file' };
  }

  // Check file size (max 100MB)
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    return { isValid: false, error: 'File is too large. Maximum size is 100MB' };
  }

  // Check file type
  const supportedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/webm'];
  let contentType = file.type;

  // If type is not explicitly supported, try to determine from extension
  if (!supportedTypes.includes(contentType)) {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    switch (extension) {
      case 'wav':
      case 'wave':
        contentType = 'audio/wav';
        break;
      case 'mp3':
      case 'mpeg':
        contentType = 'audio/mpeg';
        break;
      case 'm4a':
        contentType = 'audio/x-m4a';
        break;
      case 'mp4':
        contentType = 'audio/mp4';
        break;
      case 'webm':
        contentType = 'audio/webm';
        break;
      default:
        return {
          isValid: false,
          error: `Unsupported file type: ${extension}. Please use WAV, MP3, M4A, or WebM files.`
        };
    }
  }

  return { isValid: true };
}

describe('Audio File Validation', () => {
  describe('validateAudioFile', () => {
    it('should accept valid WAV files', () => {
      const result = validateAudioFile(mockAudioFiles.validWav);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid MP3 files', () => {
      const result = validateAudioFile(mockAudioFiles.validMp3);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid M4A files', () => {
      const result = validateAudioFile(mockAudioFiles.validM4a);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid WebM files', () => {
      const result = validateAudioFile(mockAudioFiles.validWebm);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject files with invalid MIME types', () => {
      const result = validateAudioFile(mockAudioFiles.invalidType);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });

    it('should reject empty files', () => {
      const result = validateAudioFile(mockAudioFiles.emptyFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid or empty audio file');
    });

    it('should reject oversized files (>100MB)', () => {
      const result = validateAudioFile(mockAudioFiles.oversizedFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('File is too large. Maximum size is 100MB');
    });

    it('should handle null/undefined files', () => {
      const result = validateAudioFile(null as any);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid or empty audio file');
    });

    it('should determine content type from file extension when MIME type is missing', () => {
      // Create a file with no MIME type but valid extension
      const file = new File([new ArrayBuffer(1024)], 'test.wav', { type: '' });
      const result = validateAudioFile(file);
      expect(result.isValid).toBe(true);
    });
  });

  describe('File Extension Detection', () => {
    const testExtensions = [
      { ext: 'wav', expected: true },
      { ext: 'wave', expected: true },
      { ext: 'mp3', expected: true },
      { ext: 'mpeg', expected: true },
      { ext: 'm4a', expected: true },
      { ext: 'mp4', expected: true },
      { ext: 'webm', expected: true },
      { ext: 'txt', expected: false },
      { ext: 'pdf', expected: false },
      { ext: 'doc', expected: false },
      { ext: 'aac', expected: false },
      { ext: 'flac', expected: false },
    ];

    testExtensions.forEach(({ ext, expected }) => {
      it(`should ${expected ? 'accept' : 'reject'} .${ext} files`, () => {
        const file = new File([new ArrayBuffer(1024)], `test.${ext}`, { type: '' });
        const result = validateAudioFile(file);
        expect(result.isValid).toBe(expected);
      });
    });
  });

  describe('File Size Validation', () => {
    const testSizes = [
      { size: 0, expected: false, description: 'empty file' },
      { size: 1, expected: true, description: '1 byte file' },
      { size: 1024, expected: true, description: '1KB file' },
      { size: 1024 * 1024, expected: true, description: '1MB file' },
      { size: 50 * 1024 * 1024, expected: true, description: '50MB file' },
      { size: 100 * 1024 * 1024, expected: true, description: '100MB file (max size)' },
      { size: 101 * 1024 * 1024, expected: false, description: '101MB file (over limit)' },
      { size: 200 * 1024 * 1024, expected: false, description: '200MB file' },
    ];

    testSizes.forEach(({ size, expected, description }) => {
      it(`should ${expected ? 'accept' : 'reject'} ${description}`, () => {
        const file = new File([new ArrayBuffer(size)], 'test.wav', { type: 'audio/wav' });
        const result = validateAudioFile(file);
        expect(result.isValid).toBe(expected);
        if (!expected && size > 100 * 1024 * 1024) {
          expect(result.error).toContain('Maximum size is 100MB');
        }
      });
    });
  });

  describe('MIME Type Validation', () => {
    const testMimeTypes = [
      { type: 'audio/wav', expected: true },
      { type: 'audio/mp3', expected: true },
      { type: 'audio/mpeg', expected: true },
      { type: 'audio/mp4', expected: true },
      { type: 'audio/x-m4a', expected: true },
      { type: 'audio/webm', expected: true },
      { type: 'audio/ogg', expected: false },
      { type: 'audio/aac', expected: false },
      { type: 'audio/flac', expected: false },
      { type: 'video/mp4', expected: false },
      { type: 'application/octet-stream', expected: false },
      { type: 'text/plain', expected: false },
    ];

    testMimeTypes.forEach(({ type, expected }) => {
      it(`should ${expected ? 'accept' : 'reject'} MIME type: ${type}`, () => {
        const file = new File([new ArrayBuffer(1024)], 'test.file', { type });
        const result = validateAudioFile(file);
        expect(result.isValid).toBe(expected);
      });
    });
  });
});