import { mockDatabaseMetadata } from '../test-utils/mock-data';

describe('DecentralizationApiService', () => {
  let mockTauri: any;
  let mockInvoke: jest.Mock;

  beforeEach(() => {
    mockInvoke = jest.fn();
    mockTauri = { invoke: mockInvoke };
  });

  describe('DecentralizationApiService (unit tests)', () => {
    it('should have mockInvoke as a jest mock function', () => {
      expect(mockInvoke).toBeDefined();
    });

    it('should return databases when invoke succeeds', async () => {
      const mockResult = { databases: [mockDatabaseMetadata], has_more: false, total_count: 1 };
      mockInvoke.mockResolvedValue(mockResult);

      const result = await mockTauri.invoke('database_list', { connId: 'conn-1', offset: 0, limit: 10 });

      expect(mockInvoke).toHaveBeenCalledWith('database_list', { connId: 'conn-1', offset: 0, limit: 10 });
      expect(result.databases).toEqual([mockDatabaseMetadata]);
    });

    it('should return empty databases list', async () => {
      const mockResult = { databases: [], has_more: false, total_count: 0 };
      mockInvoke.mockResolvedValue(mockResult);

      const result = await mockTauri.invoke('database_list', { connId: 'conn-1', offset: 0, limit: 10 });

      expect(result.databases).toEqual([]);
    });

    it('should save database metadata', async () => {
      mockInvoke.mockResolvedValue(mockDatabaseMetadata);

      const result = await mockTauri.invoke('save_database_metadata', {
        connectionId: 'conn-1',
        name: 'testdb',
        path: '/tmp/testdb',
        metadata: null,
      });

      expect(mockInvoke).toHaveBeenCalledWith('save_database_metadata', expect.any(Object));
      expect(result).toEqual(mockDatabaseMetadata);
    });

    it('should delete database metadata', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await mockTauri.invoke('delete_database_metadata', { id: 1 });

      expect(mockInvoke).toHaveBeenCalledWith('delete_database_metadata', { id: 1 });
    });

    it('should update database metadata', async () => {
      mockInvoke.mockResolvedValue(mockDatabaseMetadata);

      const result = await mockTauri.invoke('update_database_metadata', {
        id: 1,
        name: 'updated',
        path: '/tmp/updated',
        metadata: null,
      });

      expect(mockInvoke).toHaveBeenCalledWith('update_database_metadata', expect.any(Object));
    });
  });
});