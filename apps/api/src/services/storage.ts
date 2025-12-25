import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class StorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'pulseworks-media';

    this.client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
    });
  }

  async uploadImage(
    buffer: Buffer,
    path: string,
    contentType = 'image/png'
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: path,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read', // or 'private' if using signed URLs
    });

    await this.client.send(command);

    // Return public URL
    return `${process.env.S3_ENDPOINT}/${this.bucket}/${path}`;
  }

  async getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: path,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }

  getPublicUrl(path: string): string {
    return `${process.env.S3_ENDPOINT}/${this.bucket}/${path}`;
  }
}

export const storageService = new StorageService();
