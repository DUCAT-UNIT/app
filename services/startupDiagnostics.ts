import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { STARTUP_EVENTS } from '../constants/analyticsEvents';
import { logger } from '../utils/logger';
import { analytics } from './analyticsService';

const STORAGE_KEY = 'startup_diagnostics_state_v1';
const MAX_ATTEMPTS = 5;
const MAX_EVENTS_PER_ATTEMPT = 30;
const SENSITIVE_KEYS = new Set([
  'mnemonic', 'privatekey', 'secret', 'seed', 'password', 'pin', 'passphrase',
]);

type StartupAttemptStatus = 'running' | 'completed' | 'failed' | 'timed_out' | 'abandoned';
type StartupEventKind = 'checkpoint' | 'warning' | 'failure' | 'timeout';

interface StartupAttemptEvent {
  kind: StartupEventKind;
  name: string;
  at: string;
  elapsed_ms: number;
  details: Record<string, unknown>;
}

interface StartupAttemptRecord {
  id: string;
  status: StartupAttemptStatus;
  started_at: string;
  started_at_ms: number;
  completed_at?: string;
  completed_at_ms?: number;
  app_version: string;
  build_number: string;
  platform: string;
  os_version: string;
  device_model: string;
  is_device: boolean;
  events: StartupAttemptEvent[];
}

interface StartupDiagnosticsState {
  attempts: StartupAttemptRecord[];
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > 200 ? `${value.slice(0, 200)}...[truncated]` : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeValue(item));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 20)
        .map(([key, nestedValue]) => {
          if (SENSITIVE_KEYS.has(key.toLowerCase())) {
            return [key, '[REDACTED]'];
          }
          return [key, sanitizeValue(nestedValue)];
        }),
    );
  }

  return String(value);
}

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(details)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, sanitizeValue(value)]),
  );
}

function buildTrail(events: StartupAttemptEvent[]): string[] {
  return events.slice(-8).map((event) => `${event.kind}:${event.name}`);
}

function summarizeAttempt(attempt: StartupAttemptRecord): Record<string, unknown> {
  const lastEvent = attempt.events[attempt.events.length - 1] ?? null;
  const trail = buildTrail(attempt.events);

  return {
    startup_attempt_id: attempt.id,
    startup_status: attempt.status,
    startup_event_count: attempt.events.length,
    startup_last_event: lastEvent?.name ?? null,
    startup_last_event_kind: lastEvent?.kind ?? null,
    startup_trail: trail,
    startup_started_at: attempt.started_at,
    startup_completed_at: attempt.completed_at ?? null,
    app_version: attempt.app_version,
    build_number: attempt.build_number,
    platform: attempt.platform,
    os_version: attempt.os_version,
    device_model: attempt.device_model,
    is_device: attempt.is_device,
  };
}

function createAttemptId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createAttempt(nowMs: number): StartupAttemptRecord {
  return {
    id: createAttemptId(),
    status: 'running',
    started_at: new Date(nowMs).toISOString(),
    started_at_ms: nowMs,
    app_version: Constants.expoConfig?.version ?? 'unknown',
    build_number: Application.nativeBuildVersion ?? 'unknown',
    platform: Platform.OS,
    os_version: Platform.Version?.toString() ?? 'unknown',
    device_model: Device.modelName ?? 'unknown',
    is_device: Device.isDevice ?? false,
    events: [],
  };
}

async function readState(): Promise<StartupDiagnosticsState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        attempts: [],
      };
    }

    const parsed = JSON.parse(raw) as StartupDiagnosticsState;
    if (!parsed || !Array.isArray(parsed.attempts)) {
      return {
        attempts: [],
      };
    }

    return {
      attempts: parsed.attempts.slice(-MAX_ATTEMPTS),
    };
  } catch (error: unknown) {
    logger.warn('[StartupDiagnostics] Failed to read startup state', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      attempts: [],
    };
  }
}

class StartupDiagnosticsService {
  private currentAttemptId: string | null = null;

  private currentStartedAtMs = 0;

  private currentStatus: StartupAttemptStatus = 'completed';

  private currentEvents: StartupAttemptEvent[] = [];

  private persistQueue: Promise<void> = Promise.resolve();

  getCurrentAttemptId(): string | null {
    return this.currentStatus === 'running' ? this.currentAttemptId : null;
  }

  isActive(): boolean {
    return this.currentStatus === 'running' && this.currentAttemptId !== null;
  }

  async beginAttempt(): Promise<void> {
    if (this.currentAttemptId !== null) {
      return;
    }

    const nowMs = Date.now();
    const attempt = createAttempt(nowMs);
    this.currentAttemptId = attempt.id;
    this.currentStartedAtMs = nowMs;
    this.currentStatus = 'running';
    this.currentEvents = [];
    let recoveredAttemptSummary: Record<string, unknown> | null = null;

    this.schedulePersist((state) => {
      const previousRunningAttempt = [...state.attempts].reverse().find((entry) => entry.status === 'running');

      if (previousRunningAttempt) {
        previousRunningAttempt.status = 'abandoned';
        previousRunningAttempt.completed_at = new Date(nowMs).toISOString();
        previousRunningAttempt.completed_at_ms = nowMs;
        previousRunningAttempt.events = [
          ...previousRunningAttempt.events,
          {
            kind: 'failure' as const,
            name: 'app_terminated_before_startup_completed',
            at: new Date(nowMs).toISOString(),
            elapsed_ms: Math.max(0, nowMs - previousRunningAttempt.started_at_ms),
            details: {},
          },
        ].slice(-MAX_EVENTS_PER_ATTEMPT);
        recoveredAttemptSummary = summarizeAttempt(previousRunningAttempt);
      }

      state.attempts = [...state.attempts.filter((entry) => entry.id !== attempt.id), attempt].slice(-MAX_ATTEMPTS);
    });
    this.recordCheckpoint('attempt_started', summarizeAttempt(attempt), { flush: true });

    await this.persistQueue;

    if (recoveredAttemptSummary) {
      analytics.track(
        STARTUP_EVENTS.STARTUP_PREVIOUS_ATTEMPT_RECOVERED,
        recoveredAttemptSummary,
      );
      analytics.flush();
    }
  }

  recordCheckpoint(
    gate: string,
    details: Record<string, unknown> = {},
    options: { flush?: boolean } = {},
  ): void {
    this.appendEvent('checkpoint', gate, details, {
      analyticsEvent: STARTUP_EVENTS.STARTUP_CHECKPOINT,
      flush: options.flush ?? false,
      propertyKey: 'gate',
    });
  }

  recordWarning(
    code: string,
    details: Record<string, unknown> = {},
    options: { flush?: boolean } = {},
  ): void {
    this.appendEvent('warning', code, details, {
      analyticsEvent: STARTUP_EVENTS.STARTUP_WARNING,
      flush: options.flush ?? true,
      propertyKey: 'code',
    });
  }

  recordFailure(
    code: string,
    details: Record<string, unknown> = {},
    options: { flush?: boolean; timeout?: boolean } = {},
  ): void {
    this.appendEvent(options.timeout ? 'timeout' : 'failure', code, details, {
      analyticsEvent: options.timeout ? STARTUP_EVENTS.STARTUP_TIMEOUT : STARTUP_EVENTS.STARTUP_FAILURE,
      flush: options.flush ?? true,
      propertyKey: 'code',
      nextStatus: options.timeout ? 'timed_out' : 'failed',
    });
  }

  markComplete(details: Record<string, unknown> = {}, options: { flush?: boolean } = {}): void {
    this.appendEvent('checkpoint', 'startup_complete', details, {
      analyticsEvent: STARTUP_EVENTS.STARTUP_COMPLETE,
      flush: options.flush ?? true,
      nextStatus: 'completed',
      includeNameProperty: false,
    });
  }

  private appendEvent(
    kind: StartupEventKind,
    name: string,
    details: Record<string, unknown>,
    options: {
      analyticsEvent: string;
      flush: boolean;
      propertyKey?: 'gate' | 'code';
      nextStatus?: StartupAttemptStatus;
      includeNameProperty?: boolean;
    },
  ): void {
    if (!this.currentAttemptId || this.currentStatus !== 'running') {
      return;
    }

    const sanitizedDetails = sanitizeDetails(details);
    const event: StartupAttemptEvent = {
      kind,
      name,
      at: new Date().toISOString(),
      elapsed_ms: Math.max(0, Date.now() - this.currentStartedAtMs),
      details: sanitizedDetails,
    };

    this.currentEvents = [...this.currentEvents, event].slice(-MAX_EVENTS_PER_ATTEMPT);

    if (options.nextStatus) {
      this.currentStatus = options.nextStatus;
    }

    const payload: Record<string, unknown> = {
      startup_attempt_id: this.currentAttemptId,
      startup_status: this.currentStatus,
      startup_event_count: this.currentEvents.length,
      startup_trail: buildTrail(this.currentEvents),
      elapsed_ms: event.elapsed_ms,
      ...sanitizedDetails,
    };

    if (options.includeNameProperty !== false && options.propertyKey) {
      payload[options.propertyKey] = name;
    }

    analytics.track(options.analyticsEvent, payload);
    if (options.flush) {
      analytics.flush();
    }

    const attemptId = this.currentAttemptId;
    const status = this.currentStatus;
    const eventSnapshot = [...this.currentEvents];

    this.schedulePersist((state) => {
      let foundCurrentAttempt = false;
      const nextAttempts = state.attempts.map((attempt) => {
        if (attempt.id !== attemptId) {
          return attempt;
        }

        foundCurrentAttempt = true;

        return {
          ...attempt,
          status,
          completed_at: status === 'running' ? attempt.completed_at : new Date().toISOString(),
          completed_at_ms: status === 'running' ? attempt.completed_at_ms : Date.now(),
          events: eventSnapshot,
        };
      });

      if (!foundCurrentAttempt) {
        nextAttempts.push({
          id: attemptId,
          status,
          started_at: new Date(this.currentStartedAtMs).toISOString(),
          started_at_ms: this.currentStartedAtMs,
          completed_at: status === 'running' ? undefined : event.at,
          completed_at_ms: status === 'running' ? undefined : this.currentStartedAtMs + event.elapsed_ms,
          app_version: Constants.expoConfig?.version ?? 'unknown',
          build_number: Application.nativeBuildVersion ?? 'unknown',
          platform: Platform.OS,
          os_version: Platform.Version?.toString() ?? 'unknown',
          device_model: Device.modelName ?? 'unknown',
          is_device: Device.isDevice ?? false,
          events: eventSnapshot,
        });
      }

      state.attempts = nextAttempts.slice(-MAX_ATTEMPTS);
    });
  }

  private schedulePersist(
    updater: (state: StartupDiagnosticsState) => void,
  ): void {
    this.persistQueue = this.persistQueue
      .catch(() => undefined)
      .then(async () => {
        const state = await readState();
        updater(state);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      })
      .catch((error: unknown) => {
        logger.warn('[StartupDiagnostics] Failed to persist startup event', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }
}

export const startupDiagnostics = new StartupDiagnosticsService();
