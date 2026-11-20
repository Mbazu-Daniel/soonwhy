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

