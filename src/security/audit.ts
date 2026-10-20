const REDACTED = '[REDACTED]';
const sensitiveKey = /password|passwd|passphrase|passkey|secret|token|authorization|cookie|credential|apikey|privatekey|connectionstring/i;

// Handles nested objects, arrays, serialized JSON and key/value setting records.
// Never invokes an object's toJSON hook, which could bypass field redaction.
export function redactAuditDetails(value: unknown, ancestors = new WeakSet<object>(), depth = 0): unknown {
  if (depth > 20) return '[TRUNCATED]';
  if (typeof value === 'string') {
    const text = value.trim();
    if (text.startsWith('{') || text.startsWith('[')) {
      try { return redactAuditDetails(JSON.parse(text), ancestors, depth + 1); } catch { /* ordinary text */ }
    }
    return value;
  }
  if (value === null || typeof value !== 'object') return value;
  if (ancestors.has(value)) return '[CIRCULAR]';
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => redactAuditDetails(item, ancestors, depth + 1));
    const result: Record<string, unknown> = Object.create(null);
    const record = value as Record<string, unknown>;
    const settingName = record.key ?? record.setting_key ?? record.settingKey;
    const secretSetting = typeof settingName === 'string' && sensitiveKey.test(settingName.replace(/[^a-z0-9]/gi, ''));
    for (const key of Object.keys(record)) {
      const normalized = key.replace(/[^a-z0-9]/gi, '');
      if (sensitiveKey.test(normalized) || (secretSetting && /^(value|settingvalue)$/i.test(normalized))) {
        result[key] = REDACTED;
      } else if (typeof record[key] !== 'function') {
        result[key] = redactAuditDetails(record[key], ancestors, depth + 1);
      }
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}
