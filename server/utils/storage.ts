import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// --- Utility functions ---

/** Decode multipart filename from latin1 to UTF-8 and normalize to NFC */
export function decodeMultipartFilename(name: string): string {
  return Buffer.from(name, 'latin1').toString('utf8').normalize('NFC');
}

/** Generate a unique filename: timestamp-random-decodedOriginalName */
export function generateFileName(originalname: string): string {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const decodedName = decodeMultipartFilename(originalname);
  return uniqueSuffix + '-' + decodedName;
}

// --- StorageAdapter interface ---

export interface StorageAdapter {
  getMulterStorage(): multer.StorageEngine;
  upload(file: Express.Multer.File): Promise<string>;
  download(fileName: string, originalName: string, mimeType: string, res: Response): Promise<void>;
  delete(fileName: string): Promise<void>;
}

// --- LocalStorageAdapter ---

export class LocalStorageAdapter implements StorageAdapter {
  private uploadsDir: string;

  constructor(uploadsDir: string) {
    this.uploadsDir = uploadsDir;
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  getMulterStorage(): multer.StorageEngine {
    const uploadsDir = this.uploadsDir;
    return multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, uploadsDir);
      },
      filename: (_req, file, cb) => {
        cb(null, generateFileName(file.originalname));
      },
    });
  }

  async upload(file: Express.Multer.File): Promise<string> {
    // diskStorage already saved the file; just return the filename
    return file.filename;
  }

  async download(fileName: string, originalName: string, mimeType: string, res: Response): Promise<void> {
    const filePath = path.join(this.uploadsDir, fileName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on disk' });
      return;
    }
    const encodedFilename = encodeURIComponent(originalName);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.sendFile(filePath);
  }

  async delete(fileName: string): Promise<void> {
    const filePath = path.join(this.uploadsDir, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

// --- S3StorageAdapter ---

export class S3StorageAdapter implements StorageAdapter {
  private s3: S3Client;
  private bucket: string;

  constructor(bucket: string, region: string) {
    this.bucket = bucket;
    this.s3 = new S3Client({ region });
  }

  getMulterStorage(): multer.StorageEngine {
    return multer.memoryStorage();
  }

  async upload(file: Express.Multer.File): Promise<string> {
    const fileName = generateFileName(file.originalname);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );
    return fileName;
  }

  async download(fileName: string, originalName: string, _mimeType: string, res: Response): Promise<void> {
    const encodedFilename = encodeURIComponent(originalName);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileName,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodedFilename}`,
    });
    const signedUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    res.redirect(signedUrl);
  }

  async delete(fileName: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
      })
    );
  }
}

// --- Factory ---

export function createStorageAdapter(uploadsDir: string): StorageAdapter {
  const storageType = (process.env.STORAGE_TYPE || 'local').toLowerCase();

  if (storageType === 's3') {
    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION;
    if (!bucket || !region) {
      throw new Error('AWS_S3_BUCKET and AWS_REGION are required when STORAGE_TYPE=s3');
    }
    return new S3StorageAdapter(bucket, region);
  }

  return new LocalStorageAdapter(uploadsDir);
}
