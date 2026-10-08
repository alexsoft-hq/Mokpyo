import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { decodeMultipartFilename, generateFileName, createStorageAdapter, LocalStorageAdapter, S3StorageAdapter } from './storage';

describe('decodeMultipartFilename', () => {
  it('should decode latin1-encoded UTF-8 bytes back to UTF-8 string', () => {
    // Simulate what busboy does: UTF-8 bytes interpreted as latin1
    const utf8Name = '한글파일.pdf';
    const latin1Encoded = Buffer.from(utf8Name, 'utf8').toString('latin1');
    expect(decodeMultipartFilename(latin1Encoded)).toBe(utf8Name);
  });

  it('should normalize to NFC', () => {
    // NFD decomposed Korean character
    const nfdName = '\u1100\u1161'; // ㄱ + ㅏ (decomposed 가)
    const latin1Encoded = Buffer.from(nfdName, 'utf8').toString('latin1');
    const result = decodeMultipartFilename(latin1Encoded);
    expect(result).toBe(result.normalize('NFC'));
  });

  it('should handle ASCII filenames unchanged', () => {
    expect(decodeMultipartFilename('test.pdf')).toBe('test.pdf');
  });
});

describe('generateFileName', () => {
  it('should produce timestamp-random-originalname format', () => {
    const result = generateFileName('test.pdf');
    const parts = result.split('-');
    // At least 3 parts: timestamp, random, filename
    expect(parts.length).toBeGreaterThanOrEqual(3);
    // First part should be a timestamp (numeric)
    expect(Number(parts[0])).toBeGreaterThan(0);
    // Should end with decoded original name
    expect(result).toContain('test.pdf');
  });

  it('should generate unique names for same input', () => {
    const a = generateFileName('file.txt');
    const b = generateFileName('file.txt');
    expect(a).not.toBe(b);
  });
});

describe('createStorageAdapter', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset relevant env vars
    delete process.env.STORAGE_TYPE;
    delete process.env.AWS_S3_BUCKET;
    delete process.env.AWS_REGION;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should return LocalStorageAdapter by default', () => {
    const adapter = createStorageAdapter('/tmp/test-uploads');
    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
  });

  it('should return LocalStorageAdapter when STORAGE_TYPE=local', () => {
    process.env.STORAGE_TYPE = 'local';
    const adapter = createStorageAdapter('/tmp/test-uploads');
    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
  });

  it('should return S3StorageAdapter when STORAGE_TYPE=s3 with valid config', () => {
    process.env.STORAGE_TYPE = 's3';
    process.env.AWS_S3_BUCKET = 'test-bucket';
    process.env.AWS_REGION = 'ap-northeast-2';
    const adapter = createStorageAdapter('/tmp/test-uploads');
    expect(adapter).toBeInstanceOf(S3StorageAdapter);
  });

  it('should throw error when STORAGE_TYPE=s3 but missing AWS_S3_BUCKET', () => {
    process.env.STORAGE_TYPE = 's3';
    process.env.AWS_REGION = 'ap-northeast-2';
    expect(() => createStorageAdapter('/tmp/test-uploads')).toThrow(
      'AWS_S3_BUCKET and AWS_REGION are required'
    );
  });

  it('should throw error when STORAGE_TYPE=s3 but missing AWS_REGION', () => {
    process.env.STORAGE_TYPE = 's3';
    process.env.AWS_S3_BUCKET = 'test-bucket';
    expect(() => createStorageAdapter('/tmp/test-uploads')).toThrow(
      'AWS_S3_BUCKET and AWS_REGION are required'
    );
  });
});
