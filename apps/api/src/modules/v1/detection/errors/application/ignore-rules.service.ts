import { Injectable } from "@nestjs/common";
import { createIgnoreRule, deleteIgnoreRule, listIgnoreRules, updateIgnoreRule } from "../infrastructure/ignore-rules.store";

@Injectable()
export class ErrorIgnoreRulesService {
  list(scope: Parameters<typeof listIgnoreRules>[0]) {
    return listIgnoreRules(scope);
  }

  create(scope: Parameters<typeof createIgnoreRule>[0], input: Parameters<typeof createIgnoreRule>[1]) {
    return createIgnoreRule(scope, input);
  }

  update(scope: Parameters<typeof updateIgnoreRule>[0], ruleId: string, input: Parameters<typeof updateIgnoreRule>[2]) {
    return updateIgnoreRule(scope, ruleId, input);
  }

  remove(scope: Parameters<typeof deleteIgnoreRule>[0], ruleId: string) {
    return deleteIgnoreRule(scope, ruleId);
  }
}
