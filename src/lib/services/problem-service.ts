/**
 * supportV8 Problem Correlation Service
 * Basis: EP07 (SV8-060 to SV8-066)
 */

import { db } from "../db/mock-data";
import type { Problem, ProblemStatus, Issue, SourceType } from "../types";
import { businessImpactEngine } from "./business-impact-engine";

export class ProblemService {
  public getAll(): Problem[] {
    return [...db.problems];
  }

  public getById(id: string): Problem | undefined {
    return db.problems.find((p) => p.id === id);
  }

  public correlateIssues(issueIds: string[], title: string, suspectedCause: string): Problem {
    const linked = db.issues.filter((i) => issueIds.includes(i.id));
    const impactCalc = businessImpactEngine.calculate(linked);
    const problemId = `PRB-${220 + db.problems.length + 1}`;
    const timestamp = new Date().toISOString();

    const uniqueSources = Array.from(new Set(linked.map((i) => i.source))) as SourceType[];

    const newProblem: Problem = {
      id: problemId,
      tenantId: db.tenant.tenantId,
      title,
      summary: `Automated correlation of ${linked.length} customer issues with common pattern: ${title}`,
      suspectedCause,
      status: "active",
      confidence: 0.93,
      impact: impactCalc.impact,
      affectedCustomerCount: linked.length,
      affectedEnterpriseCount: impactCalc.affectedEnterpriseCount,
      linkedIssueIds: issueIds,
      estimatedRevenueExposure: impactCalc.estimatedRevenueExposure,
      firstSeen: timestamp,
      lastSeen: timestamp,
      trend: "increasing",
      owner: "Support Intelligence Engine",
      recommendedActions: [
        "Investigate root cause and apply infrastructure mitigation",
        "Broadcast proactive status notification to affected customers",
      ],
      communicationsCount: 0,
      verificationState: "unverified",
      sourceSystems: uniqueSources.length > 0 ? uniqueSources : ["zendesk"],
    };

    // Update issues to point to this problem
    for (const issue of linked) {
      issue.problemId = problemId;
    }

    db.problems.unshift(newProblem);
    return newProblem;
  }

  public linkIssue(problemId: string, issueId: string): Problem | undefined {
    const problem = db.problems.find((p) => p.id === problemId);
    const issue = db.issues.find((i) => i.id === issueId);
    if (!problem || !issue) return undefined;

    if (!problem.linkedIssueIds.includes(issueId)) {
      problem.linkedIssueIds.push(issueId);
      issue.problemId = problemId;
      problem.affectedCustomerCount = problem.linkedIssueIds.length;

      // Recalculate impact
      const linked = db.issues.filter((i) => problem.linkedIssueIds.includes(i.id));
      const calc = businessImpactEngine.calculate(linked);
      problem.impact = calc.impact;
      problem.estimatedRevenueExposure = calc.estimatedRevenueExposure;
      problem.affectedEnterpriseCount = calc.affectedEnterpriseCount;
    }
    return problem;
  }

  public unlinkIssue(problemId: string, issueId: string): Problem | undefined {
    const problem = db.problems.find((p) => p.id === problemId);
    const issue = db.issues.find((i) => i.id === issueId);
    if (!problem) return undefined;

    problem.linkedIssueIds = problem.linkedIssueIds.filter((id) => id !== issueId);
    if (issue && issue.problemId === problemId) {
      delete issue.problemId;
    }
    problem.affectedCustomerCount = problem.linkedIssueIds.length;

    const linked = db.issues.filter((i) => problem.linkedIssueIds.includes(i.id));
    const calc = businessImpactEngine.calculate(linked);
    problem.impact = calc.impact;
    problem.estimatedRevenueExposure = calc.estimatedRevenueExposure;
    problem.affectedEnterpriseCount = calc.affectedEnterpriseCount;

    return problem;
  }

  public updateStatus(problemId: string, status: ProblemStatus): Problem | undefined {
    const problem = db.problems.find((p) => p.id === problemId);
    if (!problem) return undefined;
    problem.status = status;
    if (status === "resolved") {
      problem.verificationState = "verified";
      problem.trend = "decreasing";
    }
    return problem;
  }
}

export const problemService = new ProblemService();
