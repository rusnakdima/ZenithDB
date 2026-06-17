import { invoke } from '@tauri-apps/api/core';

export type LogLevel = 'debug' | 'warn' | 'error' | 'info';

export interface LogEntry {
  level: string;
  component: string;
  message: string;
  timestamp: string;
}

export const logger = {
  debug(component: string, message: string, metadata?: object): void {
    console.debug(`[${component}]`, message, metadata ?? '');
    invoke('log_message', { level: 'debug', component, message, metadata }).catch(console.error);
  },
  warn(component: string, message: string, metadata?: object): void {
    console.warn(`[${component}]`, message, metadata ?? '');
    invoke('log_message', { level: 'warn', component, message, metadata }).catch(console.error);
  },
  error(component: string, message: string, metadata?: object): void {
    console.error(`[${component}]`, message, metadata ?? '');
    invoke('log_message', { level: 'error', component, message, metadata }).catch(console.error);
  },
  info(component: string, message: string, metadata?: object): void {
    console.info(`[${component}]`, message, metadata ?? '');
    invoke('log_message', { level: 'info', component, message, metadata }).catch(console.error);
  },
  log(component: string, message: string, metadata?: object): void {
    console.log(`[${component}]`, message, metadata ?? '');
    invoke('log_message', { level: 'info', component, message, metadata }).catch(console.error);
  },
};