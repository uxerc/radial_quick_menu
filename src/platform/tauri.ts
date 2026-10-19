import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const isTauri = '__TAURI_INTERNALS__' in window;

export interface OpenPayload {
  x: number;
  y: number;
  shift: boolean;
}

export function onWheelOpen(handler: (payload: OpenPayload) => void): void {
  void listen<OpenPayload>('wheel-open', (event) => handler(event.payload));
}

export function closeOverlay(): void {
  void invoke('close_wheel');
}
