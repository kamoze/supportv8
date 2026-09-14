import { validateRuntimeBatchSize, validateRuntimeDeliveryEvent, type RuntimeDeliveryStore } from "./runtime-outbox-store";
import type { RuntimeEventPublisher } from "./runtime-realtime";
import type { RelayBatchResult } from "./relay-runner";

export async function processRuntimeDeliveryBatch(store: RuntimeDeliveryStore, publisher: RuntimeEventPublisher, limit = 25): Promise<RelayBatchResult> {
  validateRuntimeBatchSize(limit);
  const events = await store.claim(limit);
  let delivered = 0;
  let failed = 0;
  for (const event of events) {
    try {
      validateRuntimeDeliveryEvent(event);
      await publisher.publish(event);
      if (await store.complete(event.eventId, event.leaseId)) delivered += 1;
      else failed += 1; // An expired/replaced lease cannot acknowledge this attempt.
    } catch {
      failed += 1;
      try { await store.fail(event.eventId, event.leaseId); }
      catch { /* A lease will expire even when its guarded failure cannot be saved. */ }
    }
  }
  return { claimed: events.length, delivered, failed };
}
