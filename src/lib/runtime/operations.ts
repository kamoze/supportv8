/**
 * supportV8 Operation Registry & Definitions
 * Integrated with @servicev8/agentic-runtime
 */

import {
  OperationRegistry as Registry,
  type OperationDefinition,
  type OperationRegistry,
} from "@servicev8/agentic-runtime";

export const VERTICAL = "supportv8";

// Operation IDs
export const OP_ZD_ADD_TAG = "zendesk.ticket.add_tag";
export const OP_ZD_UPDATE_PRIORITY = "zendesk.ticket.update_priority";
export const OP_ZD_ADD_NOTE = "zendesk.ticket.add_internal_note";
export const OP_ZD_CLOSE = "zendesk.ticket.close";
export const OP_TICKET_CREATE = "ticket.create";
export const OP_TICKET_ROUTE = "ticket.route";
export const OP_TICKET_COMMENT = "ticket.comment";
export const OP_TICKET_CLOSE = "ticket.close";
export const OP_CUSTOMER_REFUND = "customer.refund";
export const OP_ACCOUNT_UNLOCK = "account.unlock";
export const OP_PROBLEM_NOTIFY = "problem.notify_customers";
export const OP_KNOWLEDGE_PUBLISH = "knowledge.publish";

// Validators
function validateZendeskTag(input: Readonly<Record<string, unknown>>): string | null {
  if (typeof input.ticket_id !== "string" || !input.ticket_id.trim()) {
    return "ticket_id must be a non-empty string";
  }
  if (!Array.isArray(input.tags) || input.tags.length === 0) {
    return "tags must be a non-empty array of strings";
  }
  return null;
}

function validateZendeskPriority(input: Readonly<Record<string, unknown>>): string | null {
  if (typeof input.ticket_id !== "string" || !input.ticket_id.trim()) {
    return "ticket_id must be a non-empty string";
  }
  const allowed = ["low", "normal", "high", "urgent"];
  if (typeof input.priority !== "string" || !allowed.includes(input.priority)) {
    return `priority must be one of: ${allowed.join(", ")}`;
  }
  return null;
}

function validateZendeskNote(input: Readonly<Record<string, unknown>>): string | null {
  if (typeof input.ticket_id !== "string" || !input.ticket_id.trim()) {
    return "ticket_id must be a non-empty string";
  }
  if (typeof input.note !== "string" || !input.note.trim()) {
    return "note must be a non-empty string";
  }
  return null;
}

function validateTicketClose(input: Readonly<Record<string, unknown>>): string | null {
  if (typeof input.ticket_id !== "string" || !input.ticket_id.trim()) {
    return "ticket_id must be a non-empty string";
  }
  return null;
}

function validateTicketCreate(input: Readonly<Record<string, unknown>>): string | null {
  if (typeof input.title !== "string" || !input.title.trim()) {
    return "title must be a non-empty string";
  }
  if (typeof input.description !== "string" || !input.description.trim()) {
    return "description must be a non-empty string";
  }
  return null;
}

function validateTicketRoute(input: Readonly<Record<string, unknown>>): string | null {
  if (typeof input.ticket_id !== "string" || !input.ticket_id.trim()) {
    return "ticket_id must be a non-empty string";
  }
  if (typeof input.target_queue !== "string" || !input.target_queue.trim()) {
    return "target_queue must be a non-empty string";
  }
  return null;
}

function validateCustomerRefund(input: Readonly<Record<string, unknown>>): string | null {
  if (typeof input.customer_id !== "string" || !input.customer_id.trim()) {
    return "customer_id must be a non-empty string";
  }
  if (typeof input.amount_cents !== "number" || input.amount_cents <= 0) {
    return "amount_cents must be a positive integer";
  }
  if (typeof input.reason !== "string" || !input.reason.trim()) {
    return "reason must be a non-empty string";
  }
  return null;
}

function validateAccountUnlock(input: Readonly<Record<string, unknown>>): string | null {
  if (typeof input.account_id !== "string" || !input.account_id.trim()) {
    return "account_id must be a non-empty string";
  }
  if (typeof input.reason !== "string" || !input.reason.trim()) {
    return "reason must be a non-empty string";
  }
  return null;
}

function validateProblemNotify(input: Readonly<Record<string, unknown>>): string | null {
  if (typeof input.problem_id !== "string" || !input.problem_id.trim()) {
    return "problem_id must be a non-empty string";
  }
  if (typeof input.message !== "string" || !input.message.trim()) {
    return "message must be a non-empty string";
  }
  return null;
}

function validateKnowledgePublish(input: Readonly<Record<string, unknown>>): string | null {
  if (typeof input.title !== "string" || !input.title.trim()) {
    return "title must be a non-empty string";
  }
  if (typeof input.content !== "string" || !input.content.trim()) {
    return "content must be a non-empty string";
  }
  return null;
}

// Declarations
export const OP_DEF_ZD_ADD_TAG: OperationDefinition = Object.freeze({
  id: OP_ZD_ADD_TAG,
  summary: "Add tags to a Zendesk ticket",
  vertical: VERTICAL,
  risk: "low",
  requiredScope: "ticket:write",
  validate: validateZendeskTag,
  auditEvent: "zendesk.ticket.tag_added",
});

export const OP_DEF_ZD_UPDATE_PRIORITY: OperationDefinition = Object.freeze({
  id: OP_ZD_UPDATE_PRIORITY,
  summary: "Update priority of a Zendesk ticket",
  vertical: VERTICAL,
  risk: "low",
  requiredScope: "ticket:write",
  validate: validateZendeskPriority,
  auditEvent: "zendesk.ticket.priority_updated",
});

export const OP_DEF_ZD_ADD_NOTE: OperationDefinition = Object.freeze({
  id: OP_ZD_ADD_NOTE,
  summary: "Add an internal note to a Zendesk ticket",
  vertical: VERTICAL,
  risk: "low",
  requiredScope: "ticket:write",
  validate: validateZendeskNote,
  auditEvent: "zendesk.ticket.note_added",
});

export const OP_DEF_ZD_CLOSE: OperationDefinition = Object.freeze({
  id: OP_ZD_CLOSE,
  summary: "Close a Zendesk ticket",
  vertical: VERTICAL,
  risk: "medium",
  requiredScope: "ticket:write",
  validate: validateTicketClose,
  auditEvent: "zendesk.ticket.closed",
});

export const OP_DEF_TICKET_CREATE: OperationDefinition = Object.freeze({
  id: OP_TICKET_CREATE,
  summary: "Create a support ticket in system of record",
  vertical: VERTICAL,
  risk: "medium",
  requiredScope: "ticket:write",
  validate: validateTicketCreate,
  auditEvent: "ticket.created",
});

export const OP_DEF_TICKET_ROUTE: OperationDefinition = Object.freeze({
  id: OP_TICKET_ROUTE,
  summary: "Route ticket to appropriate queue or agent group",
  vertical: VERTICAL,
  risk: "low",
  requiredScope: "ticket:write",
  validate: validateTicketRoute,
  auditEvent: "ticket.routed",
});

export const OP_DEF_TICKET_CLOSE: OperationDefinition = Object.freeze({
  id: OP_TICKET_CLOSE,
  summary: "Close an external support ticket",
  vertical: VERTICAL,
  risk: "medium",
  requiredScope: "ticket:write",
  validate: validateTicketClose,
  auditEvent: "ticket.closed",
});

export const OP_DEF_REFUND: OperationDefinition = Object.freeze({
  id: OP_CUSTOMER_REFUND,
  summary: "Issue customer financial refund",
  vertical: VERTICAL,
  risk: "critical", // Critical risk: NEVER auto-executes, strictly requires human approval
  requiredScope: "billing:refund",
  validate: validateCustomerRefund,
  auditEvent: "customer.refund_issued",
});

export const OP_DEF_ACCOUNT_UNLOCK: OperationDefinition = Object.freeze({
  id: OP_ACCOUNT_UNLOCK,
  summary: "Unlock suspended customer account or reset security lock",
  vertical: VERTICAL,
  risk: "high",
  requiredScope: "account:admin",
  validate: validateAccountUnlock,
  auditEvent: "account.unlocked",
});

export const OP_DEF_PROBLEM_NOTIFY: OperationDefinition = Object.freeze({
  id: OP_PROBLEM_NOTIFY,
  summary: "Broadcast proactive problem notification to affected customer population",
  vertical: VERTICAL,
  risk: "high",
  requiredScope: "comms:broadcast",
  validate: validateProblemNotify,
  auditEvent: "problem.customers_notified",
});

export const OP_DEF_KNOWLEDGE_PUBLISH: OperationDefinition = Object.freeze({
  id: OP_KNOWLEDGE_PUBLISH,
  summary: "Publish new or updated article to connected Knowledge Base",
  vertical: VERTICAL,
  risk: "medium",
  requiredScope: "knowledge:write",
  validate: validateKnowledgePublish,
  auditEvent: "knowledge.published",
});

export const ALL_SUPPORT_OPERATIONS: readonly OperationDefinition[] = [
  OP_DEF_ZD_ADD_TAG,
  OP_DEF_ZD_UPDATE_PRIORITY,
  OP_DEF_ZD_ADD_NOTE,
  OP_DEF_ZD_CLOSE,
  OP_DEF_TICKET_CREATE,
  OP_DEF_TICKET_ROUTE,
  OP_DEF_TICKET_CLOSE,
  OP_DEF_REFUND,
  OP_DEF_ACCOUNT_UNLOCK,
  OP_DEF_PROBLEM_NOTIFY,
  OP_DEF_KNOWLEDGE_PUBLISH,
];

export function buildSupportRegistry(): OperationRegistry {
  return new Registry(ALL_SUPPORT_OPERATIONS);
}
