import { Injectable } from "@nestjs/common";

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
}

export interface SlackSendMessageInput {
  channel: string;
  text?: string;
  blocks?: SlackBlock[];
}

export interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  user_id?: string;
  team_id?: string;
  scope?: string;
  bot_user_id?: string;
  error?: string;
}

export interface SlackConnectedChannel {
  channelId: string;
  channelName: string;
  isBotMember: boolean;
}

@Injectable()
export class SlackService {
  getAuthorizeUrl(
    clientId: string,
    redirectUri: string,
    scopes: string,
  ): string {
    const params = new URLSearchParams({
      client_id: clientId,
      scope: scopes,
      redirect_uri: redirectUri,
      user_scope: "",
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async exchangeCode(
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string,
  ): Promise<SlackOAuthResponse> {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const res = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    return (await res.json()) as SlackOAuthResponse;
  }

  async sendMessage(
    botToken: string,
    input: SlackSendMessageInput,
  ): Promise<{ ok: boolean; channel?: string; ts?: string; error?: string }> {
    try {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: input.channel,
          ...(input.text ? { text: input.text } : {}),
          ...(input.blocks ? { blocks: input.blocks } : {}),
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        channel?: string;
        ts?: string;
        error?: string;
      };
      return {
        ok: data.ok === true,
        channel: data.channel,
        ts: data.ts,
        error: data.error,
      };
    } catch (error) {
      return { ok: false, error: (error as { message?: string }).message };
    }
  }
}
