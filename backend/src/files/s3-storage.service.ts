import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

@Injectable()
export class S3StorageService implements OnModuleInit {
  private client!: S3Client;
  private bucket!: string;
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const endpoint = this.config.get<string>('S3_ENDPOINT')?.trim();
    const region =
      this.config.get<string>('S3_REGION')?.trim() || 'us-east-1';
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY')?.trim();
    const secretAccessKey = this.config.get<string>('S3_SECRET_KEY')?.trim();
    const bucket = this.config.get<string>('S3_BUCKET')?.trim();
    const forcePathStyle =
      this.config.get<string>('S3_FORCE_PATH_STYLE') !== 'false';

    if (endpoint && accessKeyId && secretAccessKey && bucket) {
      this.client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle,
      });
      this.bucket = bucket;
      this.configured = true;
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getBucket(): string {
    return this.bucket;
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    if (!this.configured) {
      throw new Error('Almacenamiento S3/MinIO no configurado');
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType || 'application/octet-stream',
      }),
    );
  }

  async putObjectToBucket(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    if (!this.configured) {
      throw new Error('Almacenamiento S3/MinIO no configurado');
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType || 'application/octet-stream',
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.configured) {
      return;
    }
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async getObject(key: string): Promise<{ body: Readable; contentType: string } | null> {
    if (!this.configured) return null;
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!result.Body) return null;
      return {
        body: result.Body as Readable,
        contentType: result.ContentType || 'image/png',
      };
    } catch {
      return null;
    }
  }

  async getObjectFromBucket(
    bucket: string,
    key: string,
  ): Promise<{ body: Readable; contentType: string } | null> {
    if (!this.configured) return null;
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      if (!result.Body) return null;
      return {
        body: result.Body as Readable,
        contentType: result.ContentType || 'image/png',
      };
    } catch {
      return null;
    }
  }

  getClient(): S3Client {
    return this.client;
  }
}
