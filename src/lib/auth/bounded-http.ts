/** HTTP-only cancellation race. Database transactions must instead be awaited
 * through commit/rollback, and never passed through this helper. */
export async function authAwait<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
    let abort = () => { };
    void work.catch(() => { });
    signal.throwIfAborted();
    try {
        return await Promise.race([work, new Promise<never>((_, reject) => { abort = () => reject(Error('auth_cancelled')); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted)
                abort(); })]);
    }
    finally {
        signal.removeEventListener('abort', abort);
        signal.throwIfAborted();
    }
}
export function strictAuthJson(text: string): unknown {
    const value: unknown = JSON.parse(text), objects: (Set<string> | null)[] = [];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '{')
            objects.push(new Set());
        else if (text[i] === '[')
            objects.push(null);
        else if (text[i] === '}' || text[i] === ']')
            objects.pop();
        else if (text[i] === '"') {
            const start = i;
            for (i++; i < text.length; i++) {
                if (text[i] === '\\') {
                    i++;
                    continue;
                }
                if (text[i] === '"')
                    break;
            }
            let next = i + 1;
            while (/\s/.test(text[next] ?? '') && next < text.length)
                next++;
            if (text[next] === ':') {
                const key = JSON.parse(text.slice(start, i + 1)) as string, keys = objects.at(-1);
                if (!keys || keys.has(key))
                    throw Error('invalid_auth_contract');
                keys.add(key);
            }
        }
    }
    return value;
}
export async function readAuthJson(message: Pick<Response, 'body' | 'headers'>, signal: AbortSignal, max = 8192, check = () => signal.throwIfAborted()): Promise<unknown> {
    const length = message.headers.get('content-length');
    if (length && (!/^\d+$/.test(length) || Number(length) > max)) {
        void message.body?.cancel().catch(() => {});
        throw Error('invalid_auth_contract');
    }
    const reader = message.body?.getReader();
    if (!reader)
        throw Error('invalid_auth_contract');
    let bytes = 0;
    const parts: Uint8Array[] = [];
    const cancel = () => { void reader.cancel().catch(() => { }); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
        for (;;) {
            check();
            const p = await authAwait(reader.read(), signal);
            check();
            if (p.done)
                break;
            bytes += p.value.byteLength;
            if (bytes > max)
                throw Error('invalid_auth_contract');
            parts.push(p.value);
        }
        check();
        return strictAuthJson(new TextDecoder('utf8', { fatal: true }).decode(Buffer.concat(parts)));
    }
    finally {
        signal.removeEventListener('abort', cancel);
        cancel();
        reader.releaseLock();
    }
}

/** One inclusive HTTP budget. Register cancellation before invoking any dependency.
 * Both clocks are checked so delayed timers and wall-clock rollback cannot extend it.
 * This helper is never used to race database transactions. */
export function authDeadline(milliseconds: number, parent: AbortSignal) {
    const wallEnd = Date.now() + milliseconds, monotonicEnd = performance.now() + milliseconds;
    const controller = new AbortController();
    const abort = () => controller.abort();
    parent.addEventListener('abort', abort, { once: true });
    if (parent.aborted) abort();
    const timer = setTimeout(() => controller.abort(), milliseconds);
    const check = () => {
        if (Date.now() >= wallEnd || performance.now() >= monotonicEnd) controller.abort();
        controller.signal.throwIfAborted();
    };
    return {
        signal: controller.signal,
        check,
        async wait<T>(operation: () => Promise<T>): Promise<T> {
            check();
            let abort = () => {};
            // Subscribe before invoking dependencies, including synchronous work.
            const stopped = new Promise<never>((_, reject) => {
                abort = () => reject(Error('auth_cancelled'));
                controller.signal.addEventListener('abort', abort, { once: true });
            });
            // A synchronous dependency may throw after cancellation; observe both.
            void stopped.catch(() => {});
            try {
                check();
                const work = operation();
                void work.catch(() => {});
                check();
                const value = await Promise.race([work, stopped]);
                check();
                return value;
            } finally {
                controller.signal.removeEventListener('abort', abort);
            }
        },
        close() { clearTimeout(timer); parent.removeEventListener('abort', abort); controller.abort(); },
    };
}
