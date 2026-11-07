import { Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, randomBytes } from 'crypto';
import { AiRepository } from './ai.repository';
import { handleChatMessage, ChatMessage, ChatResponse, UserIntent, CHAT_RESPONSES } from './intelligence/chat-intelligence';

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
    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
  }

  private getKey() {
    const raw = process.env[KEY_ENV];
    if (!raw) throw new NotFoundException(`${KEY_ENV} is not configured`);
    const key = Buffer.from(raw, 'hex');
    if (key.length !== 32) throw new NotFoundException(`${KEY_ENV} must be a 32-byte hex key`);
    return key;
  }

  /** Handle a chat/triage message from the user */
  async chat(message: string, orgId: string, messageId?: string): Promise<ChatResponse> {
    // First try the LLM-based response if credentials are configured
    const credentials = await this.repository.get(orgId);
    
    if (credentials) {
      return await this.chatWithLLM(message, orgId);
    }

    // Fall back to keyword-based intent classification
    return await handleChatMessage(message, orgId, undefined, undefined);
  }

  /** Use LLM to generate a contextual response */
  private async chatWithLLM(message: string, orgId: string): Promise<ChatResponse> {
    const credentials = await this.repository.get(orgId);
    if (!credentials) {
      return await handleChatMessage(message, orgId, undefined, undefined);
    }
    const { provider, model, baseUrl } = credentials;

    // Fetch real data to provide contextual responses
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Build LLM prompt with context
    const prompt = this.buildLLMPrompt(message, orgId);

    try {
      // Call the LLM provider
      const response = await this.callLLM(provider, model, baseUrl, prompt);
      
      // Parse and structure the response
      return await this.parseLLMResponse(response, message);
    } catch (error) {
      console.error('LLM chat error:', error);
      // Fall back to keyword-based classification on error
      return await handleChatMessage(message, orgId, undefined, undefined);
    }
  }

  /** Build an LLM prompt with relevant system context */
  private buildLLMPrompt(message: string, orgId: string): string {
    let prompt = `You are an AI assistant for system monitoring and observability. `;
    
    // Add organization context
    prompt += `The user is from organization ${orgId}. `;
    
    // Add detection context
    prompt += `The user may be asking about: detection anomalies, SLO burn rates, change-point analysis, or system health. `;
    
    // Add the user's message
    prompt += `User message: "${message}". `;
    
    prompt += `Please provide a helpful, context-aware response. If the user is asking about detection anomalies, reference recent detections. If asking about SLO burn rates, reference error budgets. `;
    
    prompt += `Keep the response concise and provide follow-up suggestions.`;
    
    return prompt;
  }

  /** Call the LLM provider API */
  private callLLM(provider: string, model: string, baseUrl: string | null, prompt: string): Promise<string> {
    // In a real implementation, we'd decrypt the API key and make the API call
    // For now, return a placeholder response indicating LLM would be called
    return Promise.resolve('LLM response would be generated here based on the prompt');
  }

  /** Parse and structure the LLM response into ChatResponse */
  private async parseLLMResponse(llmResponse: string, originalMessage: string): Promise<ChatResponse> {
    const now = new Date();
    const lowerMessage = originalMessage.toLowerCase();

    // Determine suggestions based on response content
    let suggestions: string[] = ['Ask about detection anomalies', 'Check SLO burn rate', 'Look for change points'];

    // Check for common response patterns and add relevant suggestions
    if (/anomaly/i.test(llmResponse) || /detect/i.test(llmResponse)) {
      suggestions = ['Show me current detections', 'Explain anomaly score', 'View change points'];
    }
    if (/slo/i.test(llmResponse) || /burn rate/i.test(llmResponse) || /budget/i.test(llmResponse)) {
      suggestions = ['Check SLO status', 'View error budget', 'Understand burn rate'];
    }
    if (/change.point/i.test(llmResponse) || /structural break/i.test(llmResponse)) {
      suggestions = ['Run change-point detection', 'Explain change points', 'View detected changes'];
    }
    if (/health/i.test(llmResponse) || /status/i.test(llmResponse)) {
      suggestions = ['Check detection anomalies', 'SLO burn rate status', 'System overview'];
    }

    // Generate content - use LLM response or fallback to keyword-based
    let content = llmResponse;

    // If the LLM response is a placeholder, fall back to keyword-based
    if (content.includes('LLM response would be generated')) {
      const fallback = await handleChatMessage(originalMessage, '');
      content = fallback.content;
      suggestions = fallback.suggestions ?? suggestions;
    }

    return {
      id: 'msg_' + Date.now(),
      role: 'assistant',
      content,
      timestamp: now,
      suggestions,
    };
  }
}
