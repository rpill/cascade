import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';
import { ENGLISH } from '../src/localization/English.ts';
import { LocalizationBindings, setLanguage, subscribeLanguage, t } from '../src/localization/Localization.ts';
import { preferences } from '../src/settings/Preferences.ts';

test('all Russian UI source strings have English translations with matching placeholders', () => {
  const missing = new Set<string>();
  function visitDirectory(directory: URL): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'localization') continue;
      const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) { visitDirectory(file); continue; }
      if (!entry.name.endsWith('.ts')) continue;
      const source = ts.createSourceFile(entry.name, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node): void {
        // The language picker deliberately names Russian in its native language.
        if (ts.isStringLiteral(node) && /[А-Яа-яЁё]/.test(node.text) && node.text !== 'Русский') {
          if (!ENGLISH[node.text]) missing.add(node.text);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  visitDirectory(new URL('../src/', import.meta.url));
  assert.deepEqual([...missing], []);
  for (const [source, translation] of Object.entries(ENGLISH)) {
    const placeholders = (value: string) => [...value.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
    assert.deepEqual(placeholders(translation), placeholders(source), source);
    assert.doesNotMatch(translation, /[А-Яа-яЁё]/, source);
  }
});

test('language changes refresh bound labels and attributes both ways without replacing elements', () => {
  const element = {
    isConnected: true, textContent: '', attributes: new Map<string, string>(),
    setAttribute(key: string, value: string) { this.attributes.set(key, value); },
  };
  const bindings = new LocalizationBindings();
  setLanguage('en');
  bindings.text(element as unknown as HTMLElement, () => t('Настройки'));
  bindings.attribute(element as unknown as Element, 'aria-label', () => t('Лидеры'));
  assert.equal(element.textContent, 'Settings');
  setLanguage('ru'); bindings.refresh();
  assert.equal(element.textContent, 'Настройки');
  assert.equal(element.attributes.get('aria-label'), 'Лидеры');
  setLanguage('en'); bindings.refresh();
  assert.equal(element.textContent, 'Settings');
  assert.equal(element.attributes.get('aria-label'), 'Leaders');
  setLanguage('ru');
});

test('language subscribers ignore sound toggles and stop after unsubscribe', () => {
  setLanguage('ru');
  let changes = 0;
  const unsubscribe = subscribeLanguage(() => { changes += 1; });
  preferences.setSoundEnabled(false);
  assert.equal(changes, 0);
  setLanguage('en');
  assert.equal(changes, 1);
  setLanguage('en');
  assert.equal(changes, 1);
  unsubscribe(); setLanguage('ru');
  assert.equal(changes, 1);
  preferences.setSoundEnabled(true);
});

