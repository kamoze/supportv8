/**
 * Platform Connection & Capability Resolution
 * Implements CON-01 & CON-02:
 * - A connection is only runnable when it is healthy AND assigned to an acquired specialist
 * - Operations enforce the 3-way intersection: Connection ∩ Assignment ∩ Role
 */

export interface ConnectorConnectionLike {
  id?: string;
  connectorKey?: string;
  status: string;
  capabilities?: string[];
  assignedEmployeeIds?: string[];
}

export function isConnectionRunnable(connection: ConnectorConnectionLike): boolean {
  if (connection.status !== "connected" && connection.status !== "active") {
    return false;
  }
  if (!connection.assignedEmployeeIds || connection.assignedEmployeeIds.length === 0) {
    return false;
  }
  return true;
}

export function resolveConnectionCapability(options: {
  connectionCapabilities: string[];
  assignmentCapabilities: string[];
  userRole: string;
  requestedCapability: string;
}): { allowed: boolean; status: number; error?: string } {
  const { connectionCapabilities, assignmentCapabilities, userRole, requestedCapability } = options;

  // 1. Connection check
  if (!connectionCapabilities.includes(requestedCapability)) {
    return {
      allowed: false,
      status: 403,
      error: `Capability '${requestedCapability}' is not provided by this connector connection.`,
    };
  }

  // 2. Assignment check
  if (!assignmentCapabilities.includes(requestedCapability)) {
    return {
      allowed: false,
      status: 403,
      error: `Capability '${requestedCapability}' is not granted to this employee assignment.`,
    };
  }

  // 3. Role check
  if (userRole === "support_observer" || userRole === "viewer") {
    return {
      allowed: false,
      status: 403,
      error: "Current role does not have execution permission for this connector capability.",
    };
  }

  return { allowed: true, status: 200 };
}
