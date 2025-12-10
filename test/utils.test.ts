import anyTest, { TestFn } from 'ava';
import { createTextResponse, handleToolError } from '../src/utils.js';

const test = anyTest as TestFn;

test('createTextResponse creates valid MCP text response', (t) => {
  const result = createTextResponse('test message');

  t.deepEqual(result, {
    content: [
      {
        type: 'text',
        text: 'test message',
      },
    ],
  });
});

test('handleToolError formats Error instances correctly', (t) => {
  const error = new Error('test error message');
  const result = handleToolError(error, 'Operation failed');

  t.is(result.content[0].type, 'text');
  t.regex(result.content[0].text, /Operation failed: test error message/);
});

test('handleToolError formats unknown errors as strings', (t) => {
  const result = handleToolError('string error', 'Context');

  t.is(result.content[0].type, 'text');
  t.regex(result.content[0].text, /Context: string error/);
});

test('handleToolError formats non-Error objects', (t) => {
  const result = handleToolError({ code: 500 }, 'Request failed');

  t.is(result.content[0].type, 'text');
  t.true(result.content[0].text.includes('Request failed'));
});
