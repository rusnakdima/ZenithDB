import { invokeWithAbortHandling, invokeWithAbortHandlingOrDefault } from "./invoke-wrapper.util";
import { ErrorHandlerService } from "../services/error-handler.service";

describe("invoke-wrapper utilities", () => {
  let mockErrorHandler: { handleError: jest.Mock };

  beforeEach(() => {
    mockErrorHandler = { handleError: jest.fn() };
  });

  describe("invokeWithAbortHandling", () => {
    it("should return result on success", async () => {
      const invokeFn = jest.fn().mockResolvedValue("success");

      const result = await invokeWithAbortHandling(invokeFn, "context", mockErrorHandler as any);

      expect(result).toBe("success");
      expect(invokeFn).toHaveBeenCalled();
      expect(mockErrorHandler.handleError).not.toHaveBeenCalled();
    });

    it("should throw on AbortError with generic message", async () => {
      const abortError = new Error("timeout");
      abortError.name = "AbortError";
      const invokeFn = jest.fn().mockRejectedValue(abortError);

      await expect(
        invokeWithAbortHandling(invokeFn, "context", mockErrorHandler as any)
      ).rejects.toThrow("Operation cancelled");
    });

    it("should call errorHandler and rethrow on other errors", async () => {
      const error = new Error("network error");
      const invokeFn = jest.fn().mockRejectedValue(error);

      await expect(
        invokeWithAbortHandling(invokeFn, "context", mockErrorHandler as any)
      ).rejects.toThrow("network error");
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, "context");
    });
  });

  describe("invokeWithAbortHandlingOrDefault", () => {
    it("should return result on success", async () => {
      const invokeFn = jest.fn().mockResolvedValue("success");

      const result = await invokeWithAbortHandlingOrDefault(
        invokeFn,
        "context",
        mockErrorHandler as any,
        "default"
      );

      expect(result).toBe("success");
      expect(invokeFn).toHaveBeenCalled();
    });

    it("should return default on AbortError", async () => {
      const abortError = new Error("timeout");
      abortError.name = "AbortError";
      const invokeFn = jest.fn().mockRejectedValue(abortError);

      const result = await invokeWithAbortHandlingOrDefault(
        invokeFn,
        "context",
        mockErrorHandler as any,
        "default"
      );

      expect(result).toBe("default");
    });

    it("should call errorHandler and rethrow on other errors", async () => {
      const error = new Error("network error");
      const invokeFn = jest.fn().mockRejectedValue(error);

      await expect(
        invokeWithAbortHandlingOrDefault(invokeFn, "context", mockErrorHandler as any, "default")
      ).rejects.toThrow("network error");
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });
});
