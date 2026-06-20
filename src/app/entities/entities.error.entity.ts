export enum ErrorCode {
  UNKNOWN = "UNKNOWN",
  NETWORK_ERROR = "NETWORK_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  TIMEOUT = "TIMEOUT",
  CONNECTION_FAILED = "CONNECTION_FAILED",
  QUERY_FAILED = "QUERY_FAILED",
  PARSE_ERROR = "PARSE_ERROR",
  OFFLINE = "OFFLINE",
}
export interface AppError {
  code: ErrorCode;
  message: string;
  userMessage: string;
  details?: string;
  originalError?: unknown;
  timestamp: Date;
  retryable: boolean;
}
export interface ErrorResponse {
  error?: {
    code?: string;
    message?: string;
    details?: string;
  };
  message?: string;
  status?: number;
}
export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
}
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
};
export interface ErrorLogEntry {
  id: string;
  error: AppError;
  context?: string;
  timestamp: Date;
}
