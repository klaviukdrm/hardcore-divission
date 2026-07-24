const memory = new Map();

function cleanup(now) {
    for (const [key, entry] of memory.entries()) {
        if (entry.resetAt <= now) {
            memory.delete(key);
        }
    }
}

export function checkRateLimit(key, limit, windowMs) {
    const now = Date.now();
    cleanup(now);

    const current = memory.get(key);
    if (!current || current.resetAt <= now) {
        const resetAt = now + windowMs;
        memory.set(key, { count: 1, resetAt });
        return {
            allowed: true,
            remaining: limit - 1,
            resetAt
        };
    }

    if (current.count >= limit) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: current.resetAt
        };
    }

    current.count += 1;
    memory.set(key, current);

    return {
        allowed: true,
        remaining: Math.max(0, limit - current.count),
        resetAt: current.resetAt
    };
}
