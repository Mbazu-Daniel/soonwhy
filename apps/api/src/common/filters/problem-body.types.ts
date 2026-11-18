export type ProblemBody = {
  type: string;
  title: string;
  status: number;
  detail: string;
  [key: string]: unknown;
};
