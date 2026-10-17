import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { JSDOM } from 'jsdom';
import { NotFoundView } from '../src/components/NotFoundView';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/nonexistent-page',
});
global.window = dom.window as any;
global.document = dom.window.document as any;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
Object.defineProperty(global, 'navigator', {
  value: dom.window.navigator,
  writable: true,
});

afterEach(() => cleanup());

describe('NotFoundView Component', () => {
  test('renders an accessible not-found view with a homepage link', () => {
    const { getByRole } = render(<NotFoundView />);
    assert.ok(getByRole('heading', { level: 1 }));
    assert.ok(getByRole('link', { name: /return to homepage/i }));
    assert.strictEqual(getByRole('link').getAttribute('href'), '/');
  });
});
