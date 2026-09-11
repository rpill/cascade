import test from 'node:test';
import assert from 'node:assert/strict';
import { Preferences, mapPlatformLanguage } from '../src/settings/Preferences.ts';
import { AudioController } from '../src/settings/AudioController.ts';

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {getItem:(key:string)=>values.get(key)??null, setItem:(key:string,value:string)=>{values.set(key,value);}};
};
test('SDK locale initializes language and persisted manual choice wins on reload', () => {
  const storage=memoryStorage();
  const preferences=new Preferences(storage);
  preferences.initializeLanguage('fr');
  assert.equal(preferences.language,'en');
  preferences.setLanguage('ru');
  const restored=new Preferences(storage);
  restored.initializeLanguage('en');
  assert.equal(restored.language,'ru');
});
test('locale mapping covers platform Russian fallback languages and regional tags', () => {
  for (const locale of ['ru','be','kk','uk','uz','RU-ru']) assert.equal(mapPlatformLanguage(locale),'ru');
  for (const locale of ['en','fr','de','tr','zh']) assert.equal(mapPlatformLanguage(locale),'en');
  assert.equal(mapPlatformLanguage(undefined),'ru');
});
test('manual selection before slow SDK initialization cannot be overwritten', () => {
  const preferences=new Preferences(memoryStorage());
  preferences.setLanguage('en');
  preferences.initializeLanguage('ru');
  assert.equal(preferences.language,'en');
});
test('changing sound does not persist an automatic language as a manual choice', () => {
  const storage=memoryStorage();
  const preferences=new Preferences(storage);
  preferences.initializeLanguage('en');
  preferences.setSoundEnabled(false);
  const restored=new Preferences(storage);
  restored.initializeLanguage('ru');
  assert.equal(restored.language,'ru');
  assert.equal(restored.soundEnabled,false);
});
test('sound preference survives reload; hidden and platform pause always mute', () => {
  const storage=memoryStorage();
  const preferences=new Preferences(storage);
  const manager={mute:false};
  const audio=new AudioController(manager,preferences);
  preferences.setSoundEnabled(false);
  assert.equal(manager.mute,true);
  assert.equal(new Preferences(storage).soundEnabled,false);
  audio.setSuspended(true);
  preferences.setSoundEnabled(true);
  assert.equal(manager.mute,true);
  audio.setSuspended(false);
  assert.equal(manager.mute,false);
  audio.destroy();
});
test('blocked or corrupt storage still supports settings for the current session', () => {
  const preferences=new Preferences({getItem:()=>'{bad',setItem:()=>{throw Error('blocked');}});
  preferences.setLanguage('en');
  preferences.setSoundEnabled(false);
  assert.equal(preferences.language,'en');
  assert.equal(preferences.soundEnabled,false);
});

test('How to Play completion persists and blocked storage still updates the current session', () => {
  const storage=memoryStorage();
  const preferences=new Preferences(storage);
  assert.equal(preferences.howToPlaySeen,false);
  preferences.markHowToPlaySeen();
  assert.equal(preferences.howToPlaySeen,true);
  assert.equal(new Preferences(storage).howToPlaySeen,true);

  const blocked=new Preferences({getItem:()=>null,setItem:()=>{throw Error('blocked');}});
  blocked.markHowToPlaySeen();
  assert.equal(blocked.howToPlaySeen,true);
});
