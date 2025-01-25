import { beforeAll, afterAll, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window as any;

// Mock DOMParser for tests
class MockDOMParser {
  parseFromString(str: string, type: string) {
    const dom = new JSDOM(str);
    return dom.window.document;
  }
}

beforeAll(() => {
  // @ts-ignore
  global.DOMParser = MockDOMParser;
  global.fetch = vi.fn();
});

afterAll(() => {
  vi.clearAllMocks();
}); 