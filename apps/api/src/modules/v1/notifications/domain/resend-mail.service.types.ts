export interface ResendSendInput {
  to: string[];
  subject: string;
  html?: string;
  text?: string;
}

export interface ResendSendResponse {
  id: string | null;
}
