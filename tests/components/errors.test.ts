import { describe, it, expect } from "vitest";
import { AppError, isAppError, getUserMessage } from "@/lib/errors";

describe("AppError", () => {
  it("creates an error with correct type and status code", () => {
    const error = new AppError("VALIDATION", "Field X is required");
    expect(error.type).toBe("VALIDATION");
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("Field X is required");
  });

  it("uses default user message when none provided", () => {
    const error = new AppError("AUTHENTICATION", "Token expired");
    expect(error.userMessage).toBe("Please log in to continue.");
  });

  it("uses custom user message when provided", () => {
    const error = new AppError("VALIDATION", "tech detail", "Please enter your name.");
    expect(error.userMessage).toBe("Please enter your name.");
  });

  it("maps error types to correct HTTP status codes", () => {
    expect(new AppError("VALIDATION", "").statusCode).toBe(400);
    expect(new AppError("AUTHENTICATION", "").statusCode).toBe(401);
    expect(new AppError("AUTHORIZATION", "").statusCode).toBe(403);
    expect(new AppError("NOT_FOUND", "").statusCode).toBe(404);
    expect(new AppError("NETWORK", "").statusCode).toBe(502);
    expect(new AppError("INTERNAL", "").statusCode).toBe(500);
  });
});

describe("isAppError", () => {
  it("returns true for AppError instances", () => {
    expect(isAppError(new AppError("INTERNAL", "test"))).toBe(true);
  });

  it("returns false for plain errors", () => {
    expect(isAppError(new Error("test"))).toBe(false);
  });

  it("returns false for non-error values", () => {
    expect(isAppError("string")).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe("getUserMessage", () => {
  it("returns userMessage from AppError", () => {
    const error = new AppError("NOT_FOUND", "DB record missing");
    expect(getUserMessage(error)).toBe("The requested item was not found.");
  });

  it("returns generic message for unknown errors", () => {
    expect(getUserMessage(new Error("random"))).toBe(
      "Something went wrong. Please try again later."
    );
  });
});
