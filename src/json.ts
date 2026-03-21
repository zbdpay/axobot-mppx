function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nestedValue]) => nestedValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of entries) {
      result[key] = sortValue(nestedValue);
    }
    return result;
  }

  return value;
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}
