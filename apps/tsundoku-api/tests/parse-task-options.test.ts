import { describe, expect, it } from "bun:test";
import { parseTaskOptions } from "../src/services/tasks/task-runner-service";

describe("parseTaskOptions", () => {
  it("returns empty object for null input", () => {
    const result = parseTaskOptions(null);
    expect(result).toEqual({});
  });

  it("returns empty object for empty string", () => {
    const result = parseTaskOptions("");
    expect(result).toEqual({});
  });

  it("parses valid JSON with all fields", () => {
    const result = parseTaskOptions(
      JSON.stringify({
        libraryId: "lib-123",
        libraryPathId: "path-456",
        forceRefresh: true,
        seriesName: "Harry Potter",
      }),
    );

    expect(result).toEqual({
      libraryId: "lib-123",
      libraryPathId: "path-456",
      forceRefresh: true,
      seriesName: "Harry Potter",
    });
  });

  it("filters out invalid field types", () => {
    const result = parseTaskOptions(
      JSON.stringify({
        libraryId: 123,
        libraryPathId: true,
        forceRefresh: "yes",
        seriesName: ["array"],
        unknownField: "should be ignored",
      }),
    );

    expect(result).toEqual({});
  });

  it("parses partial valid fields", () => {
    const result = parseTaskOptions(JSON.stringify({ libraryId: "lib-123" }));

    expect(result).toEqual({ libraryId: "lib-123" });
  });

  it("returns empty object for invalid JSON", () => {
    const result = parseTaskOptions("not valid json");
    expect(result).toEqual({});
  });
});
