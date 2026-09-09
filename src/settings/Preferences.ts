export type Language = 'ru' | 'en';
export interface PreferenceStorage { getItem(key:string):string|null; setItem(key:string,value:string):void }
export const PREFERENCES_KEY = 'cascadePreferences';

function browserStorage(): PreferenceStorage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Local development without SDK deliberately starts in Russian. */
export function mapPlatformLanguage(locale: string | undefined): Language {
  if (!locale) return 'ru';
  return ['ru','be','kk','uk','uz'].includes(locale.toLowerCase().split(/[-_]/)[0]!) ? 'ru' : 'en';
}

export class Preferences {
  private readonly storage: PreferenceStorage | null;
  private readonly listeners = new Set<() => void>();
  private manualLanguage = false;
  private currentLanguage: Language = 'ru';
  private currentSoundEnabled = true;

  constructor(storage: PreferenceStorage | null = browserStorage()) {
    this.storage=storage;
    try {
      const value=JSON.parse(storage?.getItem(PREFERENCES_KEY) ?? 'null');
      if (value?.language === 'ru' || value?.language === 'en') {
        this.currentLanguage=value.language;
        this.manualLanguage=true;
      }
      if (typeof value?.soundEnabled === 'boolean') this.currentSoundEnabled=value.soundEnabled;
    } catch { /* Invalid or blocked storage uses safe defaults. */ }
  }
  get language(): Language { return this.currentLanguage; }
  get soundEnabled(): boolean { return this.currentSoundEnabled; }
  initializeLanguage(locale: string | undefined): void {
    if (this.manualLanguage) return;
    this.currentLanguage=mapPlatformLanguage(locale);
    this.emit();
  }
  setLanguage(language: Language): void {
    this.manualLanguage=true;
    this.currentLanguage=language;
    this.save(); this.emit();
  }
  setSoundEnabled(enabled: boolean): void {
    this.currentSoundEnabled=enabled;
    this.save(); this.emit();
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private save(): void {
    try {
      this.storage?.setItem(PREFERENCES_KEY,JSON.stringify({
        ...(this.manualLanguage ? {language:this.currentLanguage} : {}),soundEnabled:this.currentSoundEnabled,
      }));
    } catch { /* Preferences still work for this page lifetime. */ }
  }
  private emit(): void { for (const listener of this.listeners) listener(); }
}

export const preferences = new Preferences();
