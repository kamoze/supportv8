import { type Tasksv8Store, getTasksv8Store } from "./store";
import { Tasksv8Client } from "./client";

export interface Tasksv8OutboxWorkerOptions {
  store?: Tasksv8Store;
  client?: Tasksv8Client;
  batchSize?: number;
  leaseMs?: number;
  pollIntervalMs?: number;
}

export class Tasksv8OutboxWorker {
  private readonly store: Tasksv8Store;
  private readonly client: Tasksv8Client;
  private readonly batchSize: number;
  private readonly leaseMs: number;
  private readonly pollIntervalMs: number;
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(options: Tasksv8OutboxWorkerOptions = {}) {
    this.store = options.store ?? getTasksv8Store();
    this.client = options.client ?? new Tasksv8Client();
    this.batchSize = options.batchSize ?? 10;
    this.leaseMs = options.leaseMs ?? 30000;
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
  }

  async deliverOnce(tenantId?: string): Promise<number> {
    const items = await this.store.claimOutbox(this.batchSize, this.leaseMs, tenantId);
    let delivered = 0;

    for (const item of items) {
      try {
        const receipt = await this.client.publishIntakeEvent(item.payload, {
          tenantId: item.tenantId,
          accountId: item.accountId,
        });

        const taskUri =
          receipt.taskUri ??
          (receipt.workId ? `${this.client.getBaseUrl()}/app/work/${receipt.workId}` : undefined);

        await this.store.ackOutbox(
          { tenantId: item.tenantId, accountId: item.accountId },
          item.eventId,
          receipt.receiptId,
          receipt.workId ?? undefined,
          taskUri
        );
        delivered++;
      } catch (err) {
        console.error(`[Tasksv8OutboxWorker] Failed to deliver event ${item.eventId}:`, err);
      }
    }

    return delivered;
  }

  start(tenantId?: string): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const tick = async () => {
      if (!this.isRunning) return;
      try {
        await this.deliverOnce(tenantId);
      } catch (err) {
        console.error("[Tasksv8OutboxWorker] Error during poll cycle:", err);
      }
      if (this.isRunning) {
        this.timer = setTimeout(tick, this.pollIntervalMs);
      }
    };

    void tick();
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
