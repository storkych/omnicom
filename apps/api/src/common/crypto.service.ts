import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'crypto';

/**
 * AES-256-GCM helper for encrypting Telegram session strings at rest.
 * The key comes from SESSION_ENC_KEY (64 hex chars = 32 bytes).
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly key: Buffer;
  private static readonly IV_LENGTH = 12;
  private static readonly ALGORITHM = 'aes-256-gcm';

  constructor(config: ConfigService) {
    const hexKey = config.get<string>('SESSION_ENC_KEY') ?? '';
    if (hexKey.length !== 64) {
      this.logger.warn(
        'SESSION_ENC_KEY is not 64 hex chars; falling back to a derived key. Set a proper key in production.',
      );
    }
    this.key =
      hexKey.length === 64
        ? Buffer.from(hexKey, 'hex')
        : Buffer.from(hexKey.padEnd(64, '0').slice(0, 64), 'hex');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(CryptoService.IV_LENGTH);
    const cipher = createCipheriv(CryptoService.ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = createDecipheriv(CryptoService.ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
