import { isDenial, isEmptyResult } from "./organization-isolation.denial";

export async function runAttempt(run: () => Promise<unknown>): Promise<{ denied: boolean; detail: string }> {
  try {
    const value = await run();
    return { denied: isEmptyResult(value), detail: `returned ${JSON.stringify(value) ?? String(value)}` };
  } catch (error) {
    if (isDenial(error)) return { denied: true, detail: "was refused" };
    throw error;
  }
}
