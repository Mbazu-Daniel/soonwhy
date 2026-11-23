import type { CanaryStore } from "../../src/pipeline/visibility-canary";

export class FakeCanaryStore implements CanaryStore {
  private readonly sets = new Map<string, Map<string, number>>();
  failing = false;

  private set(key: string) {
    if (this.failing) throw new Error("redis is down");
    if (!this.sets.has(key)) this.sets.set(key, new Map());
    return this.sets.get(key)!;
  }

  async zadd(key: string, score: number, member: string) {
    this.set(key).set(member, score);
  }

  async zremrangebyrank(key: string, start: number, stop: number) {
    const sorted = [...this.set(key)].sort((a, b) => a[1] - b[1]);
    const last = stop < 0 ? sorted.length + stop : stop;
    if (last < 0) return;
    for (const [member] of sorted.slice(start, last + 1)) this.set(key).delete(member);
  }

  async zrangebyscore(key: string, min: string | number, max: string | number, _withScores: "WITHSCORES") {
    const lo = min === "-inf" ? Number.NEGATIVE_INFINITY : Number(min);
    const hi = max === "+inf" ? Number.POSITIVE_INFINITY : Number(max);
    return [...this.set(key)]
      .filter(([, score]) => score >= lo && score <= hi)
      .sort((a, b) => a[1] - b[1])
      .flatMap(([member, score]) => [member, String(score)]);
  }

  async zremrangebyscore(key: string, min: string | number, max: string | number) {
    const lo = min === "-inf" ? Number.NEGATIVE_INFINITY : Number(min);
    const hi = Number(max);
    for (const [member, score] of this.set(key)) if (score >= lo && score <= hi) this.set(key).delete(member);
  }

  async expire() {
    return 1;
  }

  async quit() {
    return "OK";
  }
}
