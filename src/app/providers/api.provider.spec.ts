import { mockConnectionSummaries, mockConnectionConfigResult, mockConnectionHealth, mockCollectionSchema, mockCollectionStats, mockQueryResult, mockRawResult, mockSystemMetrics } from '../shared/test-utils/mock-data';

describe('ApiProvider', () => {
  let mockInvoke: jest.Mock;
  let mockTauriBridge: any;
  let mockCancellation: any;
  let mockResponseSizeGuard: any;
  let mockDataStore: any;
  let mockConnectionsApi: any;
  let mockToastService: any;
  let mockErrorHandler: any;
  let apiProvider: any;

  beforeEach(() => {
    mockInvoke = jest.fn();
    mockTauriBridge = { invoke: mockInvoke };
    mockCancellation = { getFastAbortSignal: jest.fn(), createAbortSignal: jest.fn(), cancelPendingRequests: jest.fn() };
    mockResponseSizeGuard = { checkResponseSize: jest.fn().mockReturnValue({ truncated: false }) };
    mockDataStore = { updateConnections: jest.fn(), updateCollections: jest.fn(), updateSystemMetrics: jest.fn(), removeConnection: jest.fn() };
    mockConnectionsApi = { listConnectionsWithRefresh: jest.fn() };
    mockToastService = { error: jest.fn(), warning: jest.fn() };
    mockErrorHandler = { handleError: jest.fn() };

    apiProvider = {
      tauriBridge: mockTauriBridge,
      cancellation: mockCancellation,
      responseSizeGuard: mockResponseSizeGuard,
      dataStore: mockDataStore,
      connectionsApi: mockConnectionsApi,
      toastService: mockToastService,
      errorHandler: mockErrorHandler,
      getFastAbortSignal: () => mockCancellation.getFastAbortSignal(),
      createAbortSignal: () => mockCancellation.createAbortSignal(),
      getToastService: () => mockToastService,
      checkResponseSize: (data: any) => mockResponseSizeGuard.checkResponseSize(data),
      cancelPendingRequests: () => mockCancellation.cancelPendingRequests(),
      listConnections: async () => {
        const connections = await mockInvoke('list_connections', { options: { signal: mockCancellation.createAbortSignal() } });
        mockDataStore.updateConnections(connections);
        return connections;
      },
      getConnection: async (id: string) => mockInvoke('get_connection', { id, options: { signal: mockCancellation.getFastAbortSignal() } }),
      testConnectionStatus: async (id: string) => {
        try {
          return await mockInvoke('test_connection_status', { id, options: { signal: mockCancellation.createAbortSignal() } });
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') {
            mockToastService.error('Connection timed out');
            throw new Error('Connection timed out');
          }
          throw e;
        }
      },
      saveConnection: async (config: any) => {
        const id = await mockInvoke('save_connection', { config, options: { signal: mockCancellation.createAbortSignal() } });
        await mockConnectionsApi.listConnectionsWithRefresh();
        return id;
      },
      deleteConnection: async (id: string) => {
        await mockInvoke('delete_connection', { id, options: { signal: mockCancellation.createAbortSignal() } });
        mockDataStore.removeConnection(id);
        await mockConnectionsApi.listConnectionsWithRefresh();
      },
      testConnection: async (config: any) => {
        try {
          return await mockInvoke('test_connection', { config, options: { signal: mockCancellation.createAbortSignal() } });
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') {
            mockToastService.error('Connection timed out');
            throw new Error('Connection timed out');
          }
          throw e;
        }
      },
      listCollections: async (connId: string, dbName?: string) => {
        const result = await mockInvoke('list_collections', { connId, dbName, options: { signal: mockCancellation.createAbortSignal() } });
        const collections = result.collections || result;
        mockDataStore.updateCollections(connId, collections);
        return collections;
      },
      createDatabase: async (connId: string, name: string) => {
        await mockInvoke('create_database', { connId, name, options: { signal: mockCancellation.createAbortSignal() } });
      },
      describeCollection: async (connId: string, collection: string) => {
        return mockInvoke('describe_collection', { connId, collection, options: { signal: mockCancellation.createAbortSignal() } });
      },
      getCollectionStats: async (connId: string, collection: string) => {
        return mockInvoke('get_collection_stats', { connId, collection, options: { signal: mockCancellation.createAbortSignal() } });
      },
      queryData: async (connId: string, collection: string, params: any) => {
        const result = await mockInvoke('query_data', { connId, collection, query: params, options: { signal: mockCancellation.createAbortSignal() } });
        return result;
      },
      saveRow: async (connId: string, collection: string, data: any) => {
        return mockInvoke('save_row', { connId, collection, data, options: { signal: mockCancellation.createAbortSignal() } });
      },
      deleteRow: async (connId: string, collection: string, id: string) => {
        await mockInvoke('delete_row', { connId, collection, id, options: { signal: mockCancellation.createAbortSignal() } });
      },
      createCollection: async (connId: string, name: string) => {
        await mockInvoke('create_collection', { connId, name, options: { signal: mockCancellation.createAbortSignal() } });
        await mockInvoke('list_collections', { connId, options: { signal: mockCancellation.createAbortSignal() } });
      },
      dropCollection: async (connId: string, name: string) => {
        await mockInvoke('drop_collection', { connId, name, options: { signal: mockCancellation.createAbortSignal() } });
        await mockInvoke('list_collections', { connId, options: { signal: mockCancellation.createAbortSignal() } });
      },
      executeRaw: async (connId: string, sql: string) => {
        return mockInvoke('execute_raw', { connId, sql, options: { signal: mockCancellation.createAbortSignal() } });
      },
      getServerVersion: async (connId: string) => {
        return mockInvoke('get_server_version', { connId, options: { signal: mockCancellation.createAbortSignal() } });
      },
      getSystemStatus: async () => {
        const metrics = await mockInvoke('get_system_status', { options: { signal: mockCancellation.createAbortSignal() } });
        mockDataStore.updateSystemMetrics(metrics);
        return metrics;
      },
      updateConnection: async (id: string, config: any) => {
        await mockInvoke('update_connection', { id, config, options: { signal: mockCancellation.createAbortSignal() } });
        await mockConnectionsApi.listConnectionsWithRefresh();
      },
      renameCollection: async (connId: string, oldName: string, newName: string) => {
        await mockInvoke('rename_collection', { connId, oldName, newName, options: { signal: mockCancellation.createAbortSignal() } });
      },
      renameDatabase: async (connId: string, oldName: string, newName: string) => {
        await mockInvoke('rename_database', { connId, oldName, newName, options: { signal: mockCancellation.createAbortSignal() } });
      },
      deleteDatabase: async (connId: string, name: string) => {
        await mockInvoke('delete_database', { connId, name, options: { signal: mockCancellation.createAbortSignal() } });
      },
    };
  });

  describe('listConnections', () => {
    it('should return list of connections', async () => {
      mockInvoke.mockResolvedValue(mockConnectionSummaries);

      const result = await apiProvider.listConnections();

      expect(mockInvoke).toHaveBeenCalledWith('list_connections', expect.any(Object));
      expect(result).toEqual(mockConnectionSummaries);
      expect(mockDataStore.updateConnections).toHaveBeenCalledWith(mockConnectionSummaries);
    });

    it('should handle errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Connection failed'));

      await expect(apiProvider.listConnections()).rejects.toThrow();
    });
  });

  describe('getConnection', () => {
    it('should return connection config', async () => {
      mockInvoke.mockResolvedValue(mockConnectionConfigResult);

      const result = await apiProvider.getConnection('12345678-1234-1234-1234-123456789012');

      expect(mockInvoke).toHaveBeenCalledWith('get_connection', expect.any(Object));
      expect(result).toEqual(mockConnectionConfigResult);
    });
  });

  describe('testConnectionStatus', () => {
    it('should return connection status', async () => {
      mockInvoke.mockResolvedValue(mockConnectionSummaries[0]);

      const result = await apiProvider.testConnectionStatus('12345678-1234-1234-1234-123456789012');

      expect(mockInvoke).toHaveBeenCalledWith('test_connection_status', expect.any(Object));
      expect(result).toEqual(mockConnectionSummaries[0]);
    });

    it('should handle abort errors', async () => {
      const abortError = new Error('timeout');
      abortError.name = 'AbortError';
      mockInvoke.mockRejectedValue(abortError);

      await expect(apiProvider.testConnectionStatus('12345678-1234-1234-1234-123456789012')).rejects.toThrow('Connection timed out');
    });
  });

  describe('saveConnection', () => {
    it('should save connection and return id', async () => {
      const config = { name: 'Test', config: { type: 'Json', name: 'Test', path: '/tmp' } };
      mockInvoke.mockResolvedValue('new-connection-id');

      const result = await apiProvider.saveConnection(config);

      expect(mockInvoke).toHaveBeenCalledWith('save_connection', { config, options: expect.any(Object) });
      expect(result).toBe('new-connection-id');
    });
  });

  describe('deleteConnection', () => {
    it('should delete connection and refresh list', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await apiProvider.deleteConnection('12345678-1234-1234-1234-123456789012');

      expect(mockInvoke).toHaveBeenCalledWith('delete_connection', { id: '12345678-1234-1234-1234-123456789012', options: expect.any(Object) });
      expect(mockDataStore.removeConnection).toHaveBeenCalled();
      expect(mockConnectionsApi.listConnectionsWithRefresh).toHaveBeenCalled();
    });
  });

  describe('testConnection', () => {
    it('should test json connection', async () => {
      const config = { name: 'Test', config: { type: 'Json', name: 'Test', path: '/tmp' } };
      mockInvoke.mockResolvedValue(mockConnectionHealth);

      const result = await apiProvider.testConnection(config);

      expect(result).toEqual(mockConnectionHealth);
    });
  });

  describe('listCollections', () => {
    it('should return collections list', async () => {
      const mockResult = { collections: [{ name: 'users', count: 10 }], has_more: false, total_count: 1 };
      mockInvoke.mockResolvedValue(mockResult);

      const result = await apiProvider.listCollections('conn-id');

      expect(mockInvoke).toHaveBeenCalledWith('list_collections', expect.any(Object));
      expect(result).toEqual(mockResult.collections);
    });
  });

  describe('createDatabase', () => {
    it('should create database', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await apiProvider.createDatabase('conn-id', 'newdb');

      expect(mockInvoke).toHaveBeenCalledWith('create_database', expect.any(Object));
    });
  });

  describe('describeCollection', () => {
    it('should return collection schema', async () => {
      mockInvoke.mockResolvedValue(mockCollectionSchema);

      const result = await apiProvider.describeCollection('conn-id', 'users');

      expect(mockInvoke).toHaveBeenCalledWith('describe_collection', expect.any(Object));
    });
  });

  describe('getCollectionStats', () => {
    it('should return collection stats', async () => {
      mockInvoke.mockResolvedValue(mockCollectionStats);

      const result = await apiProvider.getCollectionStats('conn-id', 'users');

      expect(mockInvoke).toHaveBeenCalledWith('get_collection_stats', expect.any(Object));
    });
  });

  describe('queryData', () => {
    it('should return query results', async () => {
      mockInvoke.mockResolvedValue(mockQueryResult);

      const result = await apiProvider.queryData('conn-id', 'users', { limit: 10 });

      expect(mockInvoke).toHaveBeenCalledWith('query_data', expect.any(Object));
    });
  });

  describe('saveRow', () => {
    it('should save row', async () => {
      const row = { id: '1', name: 'Alice' };
      mockInvoke.mockResolvedValue(row);

      const result = await apiProvider.saveRow('conn-id', 'users', row);

      expect(mockInvoke).toHaveBeenCalledWith('save_row', expect.any(Object));
    });
  });

  describe('deleteRow', () => {
    it('should delete row', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await apiProvider.deleteRow('conn-id', 'users', '1');

      expect(mockInvoke).toHaveBeenCalledWith('delete_row', expect.any(Object));
    });
  });

  describe('createCollection', () => {
    it('should create collection', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await apiProvider.createCollection('conn-id', 'newcol');

      expect(mockInvoke).toHaveBeenCalledWith('create_collection', expect.any(Object));
    });
  });

  describe('dropCollection', () => {
    it('should drop collection', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await apiProvider.dropCollection('conn-id', 'oldcol');

      expect(mockInvoke).toHaveBeenCalledWith('drop_collection', expect.any(Object));
    });
  });

  describe('executeRaw', () => {
    it('should execute raw sql', async () => {
      mockInvoke.mockResolvedValue(mockRawResult);

      const result = await apiProvider.executeRaw('conn-id', 'SELECT * FROM users');

      expect(mockInvoke).toHaveBeenCalledWith('execute_raw', expect.any(Object));
    });
  });

  describe('getServerVersion', () => {
    it('should return server version', async () => {
      mockInvoke.mockResolvedValue('1.0.0');

      const result = await apiProvider.getServerVersion('conn-id');

      expect(mockInvoke).toHaveBeenCalledWith('get_server_version', expect.any(Object));
    });
  });

  describe('getSystemStatus', () => {
    it('should return system metrics', async () => {
      mockInvoke.mockResolvedValue(mockSystemMetrics);

      const result = await apiProvider.getSystemStatus();

      expect(mockInvoke).toHaveBeenCalledWith('get_system_status', expect.any(Object));
      expect(mockDataStore.updateSystemMetrics).toHaveBeenCalledWith(mockSystemMetrics);
    });
  });

  describe('updateConnection', () => {
    it('should update connection', async () => {
      const config = { name: 'Updated', config: { type: 'Json', name: 'Updated', path: '/tmp' } };
      mockInvoke.mockResolvedValue(undefined);

      await apiProvider.updateConnection('12345678-1234-1234-1234-123456789012', config);

      expect(mockInvoke).toHaveBeenCalledWith('update_connection', expect.any(Object));
    });
  });

  describe('renameCollection', () => {
    it('should rename collection', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await apiProvider.renameCollection('conn-id', 'old', 'new');

      expect(mockInvoke).toHaveBeenCalledWith('rename_collection', expect.any(Object));
    });
  });

  describe('renameDatabase', () => {
    it('should rename database', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await apiProvider.renameDatabase('conn-id', 'old', 'new');

      expect(mockInvoke).toHaveBeenCalledWith('rename_database', expect.any(Object));
    });
  });

  describe('deleteDatabase', () => {
    it('should delete database', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await apiProvider.deleteDatabase('conn-id', 'db');

      expect(mockInvoke).toHaveBeenCalledWith('delete_database', expect.any(Object));
    });
  });
});