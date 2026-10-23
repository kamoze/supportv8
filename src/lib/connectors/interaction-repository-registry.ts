import {
  supportIntelligenceRepository,
} from "@/lib/db/support-intelligence-repository";
import type { SupportIntelligenceRepository } from "@/lib/types";

let repositoryOverride: SupportIntelligenceRepository | null = null;

export function setInteractionRepositoryForTesting(
  repo: SupportIntelligenceRepository | null
): void {
  repositoryOverride = repo;
}

export function getInteractionRepository(): SupportIntelligenceRepository {
  return repositoryOverride ?? supportIntelligenceRepository;
}
