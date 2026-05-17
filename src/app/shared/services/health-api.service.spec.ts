import { mockConnectionHealth } from '../test-utils/mock-data';

describe('HealthApiService', () => {
  let service: any;
  let mockTauriBridge: any;
  let mockInvoke: jest.Mock;
  let mockCacheService: any;

  beforeEach(() => {
    mockInvoke = jest.fn();
    mockTauriBridge = { invoke: mockInvoke };

    mockCacheService = {
      inFlightRequests: new Map(),
      getOrFetch: jest.fn(),
    };

    service = {
      healthSignal: { set: jest.fn(), get: () => new Map(), update: jest.fn() },
      healthTimestamps: { set: jest.fn(), get: () => new Map(), update: jest.fn() },
      refreshCallbacks: new Map(),
      inFlightHealth: new Map(),
      HEALTH_TTL_MS: 30000,
      tauriBridge: mockTauriBridge,
      getHealth: (connId: string) => service.healthSignal.get().get(connId) ?? null,
      checkHealth: jest.fn().mockImplementation(async (connId, timeoutMs = 10000) => {
        const cached = service.getHealth(connId);
        const timestamp = service.healthTimestamps.get().get(connId) ?? 0;
        if (cached && !service.isStale(timestamp, service.HEALTH_TTL_MS)) {
          return cached;
        }
        const existing = service.inFlightHealth.get(connId);
        if (existing) {
          return existing.catch(() => null);
        }
        const promise = service.checkHealthWithTimeout(connId, timeoutMs).finally(() => {
          service.inFlightHealth.delete(connId);
        });
        service.inFlightHealth.set(connId, promise);
        return promise;
      }),
      checkHealthWithTimeout: jest.fn().mockImplementation((connId, timeoutMs) => {
        return Promise.race([
          service.fetchHealth(connId),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Health check timed out after ${timeoutMs}ms`)), timeoutMs)),
        ]);
      }),
      checkHealthWithRefresh: jest.fn().mockImplementation(async (connId) => {
        const result = await service.fetchHealth(connId);
        service.notifyRefresh(connId);
        return result;
      }),
      onHealthRefreshed: jest.fn().mockImplementation((connId, cb) => {
        if (!service.refreshCallbacks.has(connId)) {
          service.refreshCallbacks.set(connId, new Set());
        }
        service.refreshCallbacks.get(connId).add(cb);
        return () => service.refreshCallbacks.get(connId)?.delete(cb);
      }),
      invalidateHealth: jest.fn().mockImplementation((connId) => {
        if (connId) {
          service.healthSignal.update((map: Map<string, any>) => {
            const newMap = new Map(map);
            newMap.delete(connId);
            return newMap;
          });
          service.healthTimestamps.update((map: Map<string, any>) => {
            const newMap = new Map(map);
            newMap.delete(connId);
            return newMap;
          });
        }
      }),
      fetchHealth: jest.fn().mockImplementation(async (connId) => {
        const health = await mockTauriBridge.invoke('check_health', { connectionId: connId });
        service.healthSignal.update((map: Map<string, any>) => {
          const newMap = new Map(map);
          newMap.set(connId, health);
          return newMap;
        });
        service.healthTimestamps.update((map: Map<string, any>) => {
          const newMap = new Map(map);
          newMap.set(connId, Date.now());
          return newMap;
        });
        return health;
      }),
      notifyRefresh: (connId: string) => service.refreshCallbacks.get(connId)?.forEach((cb: Function) => cb()),
      isStale: (timestamp: number, ttlMs: number) => Date.now() - timestamp > ttlMs,
    };
  });

  describe('getHealth', () => {
    it('should return cached health', () => {
      const healthMap = new Map([['conn-1', mockConnectionHealth]]);
      service.healthSignal.get = () => healthMap;

      expect(service.getHealth('conn-1')).toEqual(mockConnectionHealth);
    });

    it('should return null if not cached', () => {
      service.healthSignal.get = () => new Map();

      expect(service.getHealth('unknown')).toBeNull();
    });
  });

  describe('checkHealth', () => {
    it('should return cached health if fresh', async () => {
      const healthMap = new Map([['conn-1', mockConnectionHealth]]);
      const timestampMap = new Map([['conn-1', Date.now()]]);
      service.healthSignal.get = () => healthMap;
      service.healthTimestamps.get = () => timestampMap;

      const result = await service.checkHealth('conn-1');

      expect(result).toEqual(mockConnectionHealth);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should fetch fresh health if stale', async () => {
      const staleTimestamp = Date.now() - 60000;
      const healthMap = new Map([['conn-1', mockConnectionHealth]]);
      const timestampMap = new Map([['conn-1', staleTimestamp]]);
      service.healthSignal.get = () => healthMap;
      service.healthTimestamps.get = () => timestampMap;
      mockInvoke.mockResolvedValue(mockConnectionHealth);

      const result = await service.checkHealth('conn-1');

      expect(mockInvoke).toHaveBeenCalledWith('check_health', { connectionId: 'conn-1' });
    });
  });

  describe('checkHealthWithRefresh', () => {
    it('should fetch health and notify listeners', async () => {
      const callback = jest.fn();
      service.refreshCallbacks.set('conn-1', new Set([callback]));
      mockInvoke.mockResolvedValue(mockConnectionHealth);
      service.healthSignal.get = () => new Map();
      service.healthTimestamps.get = () => new Map();

      const result = await service.checkHealthWithRefresh('conn-1');

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('invalidateHealth', () => {
    it('should remove health for connection', () => {
      const healthMap = new Map([['conn-1', mockConnectionHealth]]);
      service.healthSignal.update = jest.fn().mockImplementation((fn) => {
        const newMap = fn(healthMap);
        service.healthSignal.get = () => newMap;
      });

      service.invalidateHealth('conn-1');

      expect(service.healthSignal.update).toHaveBeenCalled();
    });
  });
});