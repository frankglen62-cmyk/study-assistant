// Vitest mock for next/headers — provides a stub cookies() function
export function cookies() {
  const store = new Map<string, string>();
  return {
    getAll: () => [] as { name: string; value: string }[],
    get: (name: string) => store.get(name) ?? null,
    set: (_name: string, _value: string, _options?: unknown) => {},
  };
}

export function headers() {
  return new Headers();
}
