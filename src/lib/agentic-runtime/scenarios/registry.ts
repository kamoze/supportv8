/**
 * In-memory registry and query index for packaged declarative scenarios.
 */

import type { DeclarativeScenario } from "./schema";
import { parseDeclarativeScenario } from "./parser";

export type ScenarioFilter = {
  vertical?: string;
  category?: string;
  tier?: "free" | "starter" | "pro" | "enterprise";
  tag?: string;
};

export class ScenarioRegistry {
  private readonly scenarios = new Map<string, DeclarativeScenario>();

  public register(scenario: DeclarativeScenario): void {
    this.scenarios.set(scenario.id, scenario);
  }

  public registerYaml(yamlContent: string): DeclarativeScenario {
    const scenario = parseDeclarativeScenario(yamlContent);
    this.register(scenario);
    return scenario;
  }

  public get(id: string): DeclarativeScenario | undefined {
    return this.scenarios.get(id);
  }

  public has(id: string): boolean {
    return this.scenarios.has(id);
  }

  public list(filter?: ScenarioFilter): DeclarativeScenario[] {
    const all = Array.from(this.scenarios.values());
    if (!filter) return all;

    return all.filter((s) => {
      if (filter.vertical && !s.marketplace.verticals.includes(filter.vertical)) {
        return false;
      }
      if (filter.category && s.category !== filter.category) {
        return false;
      }
      if (filter.tier && s.marketplace.tier !== filter.tier) {
        return false;
      }
      if (filter.tag && (!s.marketplace.tags || !s.marketplace.tags.includes(filter.tag))) {
        return false;
      }
      return true;
    });
  }

  public size(): number {
    return this.scenarios.size;
  }

  public clear(): void {
    this.scenarios.clear();
  }
}
