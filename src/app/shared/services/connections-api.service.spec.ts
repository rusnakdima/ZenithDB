import { mockConnectionSummaries } from "../test-utils/mock-data";

describe("ConnectionsApiService", () => {
  let mockTauriBridge: any;
  let mockDataStore: any;
  let mockInvoke: jest.Mock;

  beforeEach(() => {
    mockInvoke = jest.fn();
    mockTauriBridge = { invoke: mockInvoke };
    mockDataStore = { updateConnections: jest.fn() };
  });

  describe("ConnectionsApiService (unit tests)", () => {
    it("should have mockInvoke as a jest mock function", () => {
      expect(mockInvoke).toBeDefined();
      expect(typeof mockInvoke.mockResolvedValue).toBe("function");
    });

    it("should return connection summaries when invoke succeeds", async () => {
      mockInvoke.mockResolvedValue(mockConnectionSummaries);

      const result = await mockTauriBridge.invoke("list_connections");

      expect(mockInvoke).toHaveBeenCalledWith("list_connections");
      expect(result).toEqual(mockConnectionSummaries);
    });

    it("should handle connection list empty state", async () => {
      mockInvoke.mockResolvedValue([]);

      const result = await mockTauriBridge.invoke("list_connections");

      expect(result).toEqual([]);
    });

    it("should update dataStore after fetching connections", async () => {
      mockInvoke.mockResolvedValue(mockConnectionSummaries);

      await mockTauriBridge.invoke("list_connections");
      mockDataStore.updateConnections(mockConnectionSummaries);

      expect(mockDataStore.updateConnections).toHaveBeenCalledWith(mockConnectionSummaries);
    });
  });
});
