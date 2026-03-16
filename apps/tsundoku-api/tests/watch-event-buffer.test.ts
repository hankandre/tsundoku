import { describe, expect, it, beforeEach, vi } from "bun:test";
import { WatchEventBuffer } from "../src/services/tasks/watch-event-buffer";

describe("WatchEventBuffer", () => {
  let buffer: WatchEventBuffer;

  beforeEach(() => {
    buffer = new WatchEventBuffer();
  });

  it("schedules a callback after delay", async () => {
    const callback = vi.fn();
    buffer.schedule("key1", 100, callback);

    expect(callback).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("debounces multiple schedules for the same key", async () => {
    const callback = vi.fn();
    buffer.schedule("key1", 100, callback);
    buffer.schedule("key1", 100, callback);
    buffer.schedule("key1", 100, callback);

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("handles different keys independently", async () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    buffer.schedule("key1", 50, callback1);
    buffer.schedule("key2", 100, callback2);

    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it("clears pending timers on dispose", async () => {
    const callback = vi.fn();
    buffer.schedule("key1", 10000, callback);

    buffer.dispose();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(callback).not.toHaveBeenCalled();
  });

  it("reschedules after dispose", async () => {
    const callback = vi.fn();
    buffer.schedule("key1", 10000, callback);
    buffer.dispose();

    buffer.schedule("key1", 50, callback);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
