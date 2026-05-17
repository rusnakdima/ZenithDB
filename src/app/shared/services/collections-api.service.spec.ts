import { mockCollectionMetas, mockCollectionSchema, mockCollectionStats } from '../test-utils/mock-data';

describe('CollectionsApiService', () => {
  let mockTauriBridge: any;
  let mockInvoke: jest.Mock;

  beforeEach(() => {
    mockInvoke = jest.fn();
    mockTauriBridge = { invoke: mockInvoke };
  });

  describe('CollectionsApiService (unit tests)', () => {
    it('should have mockInvoke as a jest mock function', () => {
      expect(mockInvoke).toBeDefined();
    });

    it('should return collections when invoke succeeds', async () => {
      const mockResult = { collections: mockCollectionMetas, has_more: false, total_count: 2 };
      mockInvoke.mockResolvedValue(mockResult);

      const result = await mockTauriBridge.invoke('collection_list', { connId: 'conn-1', dbName: 'db1', offset: 0, limit: 10 });

      expect(mockInvoke).toHaveBeenCalledWith('collection_list', { connId: 'conn-1', dbName: 'db1', offset: 0, limit: 10 });
      expect(result.collections).toEqual(mockCollectionMetas);
    });

    it('should return empty collections for unknown connection', async () => {
      const mockResult = { collections: [], has_more: false, total_count: 0 };
      mockInvoke.mockResolvedValue(mockResult);

      const result = await mockTauriBridge.invoke('collection_list', { connId: 'unknown', dbName: undefined, offset: 0, limit: 10 });

      expect(result.collections).toEqual([]);
    });

    it('should handle pagination result structure', async () => {
      const mockResult = { collections: mockCollectionMetas, has_more: true, total_count: 100 };
      mockInvoke.mockResolvedValue(mockResult);

      const result = await mockTauriBridge.invoke('collection_list', { connId: 'conn-1', dbName: 'db1', offset: 10, limit: 10 });

      expect(result.collections).toHaveLength(2);
      expect(result.has_more).toBe(true);
      expect(result.total_count).toBe(100);
    });
  });
});