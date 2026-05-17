import { mockSystemMetrics } from '../test-utils/mock-data';

describe('MetricsApiService', () => {
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
      tauriBridge: mockTauriBridge,
      metricsSignal: { set: jest.fn(), get: () => null },
      metricsTimestamp: { set: jest.fn(), get: () => 0 },
      refreshCallbacks: new Set(),
      METRICS_TTL_MS: 10000,
      getMetrics: () => service.metricsSignal.get(),
      fetchMetrics: jest.fn().mockImplementation(async () => {
        const cached = service.metricsSignal.get();
        const timestamp = service.metricsTimestamp.get();
        if (cached && !service.isStale(timestamp, service.METRICS_TTL_MS)) {
          return cached;
        }
        return service.fetchMetricsInternal();
      }),
      fetchMetricsWithRefresh: jest.fn().mockImplementation(async () => {
        const result = await service.fetchMetricsInternal();
        service.notifyRefresh();
        return result;
      }),
      onMetricsRefreshed: jest.fn().mockImplementation((cb) => {
        service.refreshCallbacks.add(cb);
        return () => service.refreshCallbacks.delete(cb);
      }),
      invalidateMetrics: jest.fn().mockImplementation(() => {
        service.metricsSignal.set(null);
        service.metricsTimestamp.set(0);
      }),
      fetchMetricsInternal: jest.fn().mockImplementation(async () => {
        const metrics = await mockTauriBridge.invoke('get_system_status', {});
        service.metricsSignal.set(metrics);
        service.metricsTimestamp.set(Date.now());
        return metrics;
      }),
      notifyRefresh: () => service.refreshCallbacks.forEach((cb: Function) => cb()),
      isStale: (timestamp: number, ttlMs: number) => Date.now() - timestamp > ttlMs,
    };
  });

  describe('getMetrics', () => {
    it('should return cached metrics', () => {
      service.metricsSignal.get = () => mockSystemMetrics;

      expect(service.getMetrics()).toEqual(mockSystemMetrics);
    });

    it('should return null if not cached', () => {
      service.metricsSignal.get = () => null;

      expect(service.getMetrics()).toBeNull();
    });
  });

  describe('fetchMetrics', () => {
    it('should return cached metrics if fresh', async () => {
      service.metricsSignal.get = () => mockSystemMetrics;
      service.metricsTimestamp.get = () => Date.now();

      const result = await service.fetchMetrics();

      expect(result).toEqual(mockSystemMetrics);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should fetch fresh metrics if stale', async () => {
      service.metricsSignal.get = () => mockSystemMetrics;
      service.metricsTimestamp.get = () => Date.now() - 20000;
      mockInvoke.mockResolvedValue(mockSystemMetrics);

      const result = await service.fetchMetrics();

      expect(mockInvoke).toHaveBeenCalledWith('get_system_status', {});
    });
  });

  describe('fetchMetricsWithRefresh', () => {
    it('should fetch metrics and notify listeners', async () => {
      const callback = jest.fn();
      service.refreshCallbacks.add(callback);
      service.metricsSignal.get = () => null;
      service.metricsTimestamp.get = () => 0;
      mockInvoke.mockResolvedValue(mockSystemMetrics);

      const result = await service.fetchMetricsWithRefresh();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('onMetricsRefreshed', () => {
    it('should register callback and return unsubscribe function', () => {
      const callback = jest.fn();
      service.refreshCallbacks = new Set();

      const unsubscribe = service.onMetricsRefreshed(callback);

      expect(service.refreshCallbacks.has(callback)).toBe(true);
      unsubscribe();
      expect(service.refreshCallbacks.has(callback)).toBe(false);
    });
  });

  describe('invalidateMetrics', () => {
    it('should clear metrics and timestamp', () => {
      service.invalidateMetrics();

      expect(service.metricsSignal.set).toHaveBeenCalledWith(null);
      expect(service.metricsTimestamp.set).toHaveBeenCalledWith(0);
    });
  });
});