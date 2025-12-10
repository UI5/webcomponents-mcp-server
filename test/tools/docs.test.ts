import anyTest, { TestFn } from 'ava';
import { listDocsTool } from '../../src/tools/get_docs/list_docs.js';
import { getDocTool } from '../../src/tools/get_docs/get_doc.js';

const test = anyTest as TestFn;

test('listDocsTool returns llms.txt content', async (t) => {
  const result = await listDocsTool.handler();

  t.is(result.content[0].type, 'text');
  t.true(result.content[0].text.includes('UI5 Web Components Documentation Index'));
  t.true(result.content[0].text.includes('docs/'));
});

test('listDocsTool includes framework reminder', async (t) => {
  const result = await listDocsTool.handler();

  t.true(result.content[0].text.includes('get_doc'));
});

test('getDocTool returns file content', async (t) => {
  const result = await getDocTool.handler({ docs: [{ path: 'docs/09-FAQ.md' }] });

  t.is(result.content[0].type, 'text');
  t.true(result.content[0].text.length > 0);
});

test('getDocTool handles non-existent file', async (t) => {
  const result = await getDocTool.handler({ docs: [{ path: 'docs/nonexistent.md' }] });

  t.is(result.content[0].type, 'text');
  t.true(result.content[0].text.includes('not found'));
});

test('getDocTool normalizes paths', async (t) => {
  const result = await getDocTool.handler({ docs: [{ path: 'docs/09-FAQ.md' }] });

  t.is(result.content[0].type, 'text');
  t.true(result.content[0].text.length > 0);
});

test('getDocTool supports line ranges', async (t) => {
  const result = await getDocTool.handler({ 
    docs: [{ path: 'docs/09-FAQ.md', lines: '1-10' }] 
  });

  t.is(result.content[0].type, 'text');
  t.true(result.content[0].text.includes('[lines 1-10]'));
});

test('getDocTool supports multiple documents', async (t) => {
  const result = await getDocTool.handler({ 
    docs: [
      { path: 'docs/09-FAQ.md' },
      { path: 'docs/08-Releases.md' }
    ] 
  });

  t.is(result.content[0].type, 'text');
  t.true(result.content[0].text.includes('docs/09-FAQ.md'));
  t.true(result.content[0].text.includes('docs/08-Releases.md'));
});

