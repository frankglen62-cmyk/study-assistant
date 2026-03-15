import type { ExtensionState } from '@study-assistant/shared-types';

import type { ExtensionMessage, ExtensionResponse } from './messages';
import { STORAGE_KEY } from './state';
import { extensionStateSchema } from './validators';

export async function sendExtensionMessage<TData = unknown, TPayload = undefined>(
  message: ExtensionMessage<TPayload>,
): Promise<ExtensionResponse<TData>> {
  return (await chrome.runtime.sendMessage(message)) as ExtensionResponse<TData>;
}

export async function getStoredExtensionState(): Promise<ExtensionState | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const parsed = extensionStateSchema.safeParse(stored[STORAGE_KEY]);
  return parsed.success ? parsed.data : null;
}

export function subscribeToExtensionState(onChange: (state: ExtensionState) => void): () => void {
  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEY]?.newValue) {
      return;
    }

    const parsed = extensionStateSchema.safeParse(changes[STORAGE_KEY].newValue);
    if (parsed.success) {
      onChange(parsed.data);
    }
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
