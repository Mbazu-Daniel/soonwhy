import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, randomBytes } from 'crypto';
import { AiRepository } from './ai.repository';

const KEY_ENV = 'SOONWHY_CREDENTIAL_ENCRYPTION_KEY';

@Injectable()
export class AiService {
  constructor(private readonly repository: AiRepository) {}
  async get(orgId: string) {
    const row = await this.repository.get(orgId);
    if (!row) return { configured: false };
    return { configured: true, provider: row.provider, model: row.model, baseUrl: row.baseUrl, keyHint: row.keyHint, createdAt: row.createdAt, updatedAt: row.updatedAt };
  }
  async save(orgId: string, input: { provider: string; model: string; apiKey: string; baseUrl?: string | null }) {
    if (!input.apiKey.trim()) throw new Error('API key is required');
    if (!input.model.trim()) throw new Error('Model is required');
    const baseUrl = input.baseUrl?.trim() || null;
    if (baseUrl) {
      const url = new URL(baseUrl);
      if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Provider base URL must use HTTPS');
    }
    const row = await this.repository.upsert({ orgId, provider: input.provider.trim().toLowerCase(), model: input.model.trim(), baseUrl, encryptedApiKey: this.encrypt(input.apiKey), keyHint: input.apiKey.slice(-4) });
    return { configured: true, provider: row?.provider, model: row?.model, baseUrl: row?.baseUrl, keyHint: row?.keyHint, updatedAt: row?.updatedAt };
  }
  async remove(orgId: string) { await this.repository.remove(orgId); return { configured: false }; }
  private encrypt(value: string) {
    const key = this.getKey(); const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
  }
  private getKey() {
    const raw = process.env[KEY_ENV]; if (!raw) throw new ServiceUnavailableException(`${KEY_ENV} is not configured`);
    const key = Buffer.from(raw, 'hex'); if (key.length !== 32) throw new ServiceUnavailableException(`${KEY_ENV} must be a 32-byte hex key`);
    return key;
  }
}
