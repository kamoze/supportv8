/**
 * supportV8 Knowledge Intelligence Service
 * Basis: EP15 (SV8-140 to SV8-145) & EP23 (Knowledge Refresh Employee)
 */

import { db } from "../db/mock-data";
import type { KnowledgeArticle, KnowledgeGap, KnowledgeProposal } from "../types";
import { globalActionGateway } from "../runtime/action-gateway-client";
import { OP_KNOWLEDGE_PUBLISH } from "../runtime/operations";

export class KnowledgeService {
  public getArticles(): KnowledgeArticle[] {
    return [...db.articles];
  }

  public getGaps(): KnowledgeGap[] {
    return [...db.gaps];
  }

  public getProposals(): KnowledgeProposal[] {
    return [...db.proposals];
  }

  public async publishProposal(proposalId: string, approverId = "admin_1"): Promise<{ success: boolean; message: string; auditId?: string }> {
    const proposal = db.proposals.find((p) => p.id === proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    // Execute publication through Action Gateway
    const result = await globalActionGateway.requestAction({
      tenantId: db.tenant.tenantId,
      actor: {
        id: approverId,
        type: "human",
        name: "Knowledge Base Admin",
      },
      operationId: OP_KNOWLEDGE_PUBLISH,
      input: {
        title: proposal.title,
        content: proposal.proposedContent,
        target_source: proposal.targetSource,
      },
    });

    if (result.success) {
      proposal.status = "published";
      // Also update or add to articles list
      const newArticle: KnowledgeArticle = {
        id: `KB-${100 + db.articles.length + 1}`,
        source: "zendesk_guide",
        title: proposal.title,
        url: `https://support.acme.com/hc/articles/${proposal.id.toLowerCase()}`,
        category: "Authentication & Security",
        usageCount: 1,
        csatScore: 5.0,
        status: "active",
        lastUpdated: new Date().toISOString().split("T")[0],
        summary: proposal.rationale,
      };
      db.articles.unshift(newArticle);

      if (proposal.gapId) {
        const gap = db.gaps.find((g) => g.id === proposal.gapId);
        if (gap) gap.status = "published";
      }

      return {
        success: true,
        message: `Knowledge proposal '${proposal.title}' successfully published to ${proposal.targetSource} via Action Gateway.`,
        auditId: result.auditId,
      };
    } else {
      return {
        success: false,
        message: `Failed to publish knowledge proposal: ${result.error}`,
        auditId: result.auditId,
      };
    }
  }
}

export const knowledgeService = new KnowledgeService();
