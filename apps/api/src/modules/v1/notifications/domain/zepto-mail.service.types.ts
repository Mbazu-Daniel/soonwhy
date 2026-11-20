export interface ZeptoMailSendInput {
  from: { name: string; address: string };
  to: { email_address: string }[];
  subject: string;
  htmlbody?: string;
  textbody?: string;
}

export interface ZeptoMailSendResponse {
  status: string;
  message: string;
  data: {
    message_id: string;
    status: string;
    to: Array<{ email_address: string; message_id: string; status: string }>;
  };
}
