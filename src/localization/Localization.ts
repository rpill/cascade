import { preferences, type Language } from '../settings/Preferences.ts';
import { ENGLISH } from './English.ts';

export type { Language } from '../settings/Preferences.ts';
export const getLanguage = (): Language => preferences.language;
export const setLanguage = (language: Language): void => preferences.setLanguage(language);
export function subscribeLanguage(listener: () => void): () => void {
  let previous=getLanguage();
  return preferences.subscribe(()=>{
    const current=getLanguage();
    if (current !== previous) { previous=current; listener(); }
  });
}
export function t(sourceRussian: string, params: Record<string,string|number> = {}): string {
  const template=getLanguage()==='en' ? ENGLISH[sourceRussian] ?? sourceRussian : sourceRussian;
  return template.replace(/\{(\w+)\}/g,(placeholder,key:string)=>String(params[key] ?? placeholder));
}

/** Explicit view-owned bindings; refreshes registered properties without replacing DOM or game state. */
export class LocalizationBindings {
  private readonly bindings=new Map<Element,Map<string,()=>void>>();
  private cleanupQueued=false;
  text(element: HTMLElement, render: () => string): void {
    this.bind(element,'text',()=>{element.textContent=render();});
  }
  attribute(element: Element, name: string, render: () => string): void {
    this.bind(element,name,()=>{element.setAttribute(name,render());});
  }
  refresh(): void {
    for (const [element,properties] of this.bindings) {
      if (!element.isConnected) { this.bindings.delete(element); continue; }
      for (const update of properties.values()) update();
    }
  }
  private bind(element: Element, property: string, update: () => void): void {
    let properties=this.bindings.get(element);
    if (!properties) { properties=new Map(); this.bindings.set(element,properties); }
    properties.set(property,update);
    update();
    if (!this.cleanupQueued) {
      this.cleanupQueued=true;
      // Views attach new nodes synchronously. Retire replaced rows at the end of
      // that render, even if the player never changes language again.
      queueMicrotask(()=>{
        this.cleanupQueued=false;
        for (const element of this.bindings.keys()) {
          if (!element.isConnected) this.bindings.delete(element);
        }
      });
    }
  }
}
