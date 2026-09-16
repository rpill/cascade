import type * as Phaser from 'phaser';
import { getThemeAssets } from './ThemeAssets.ts';
import type { ThemeDefinition } from './ThemeDefinition.ts';
import { prepareCardBack } from './CardBackTexture.ts';

/** A failed download keeps the previous theme visible; partial bundles never apply. */
export async function loadTheme(scene: Phaser.Scene, theme: ThemeDefinition): Promise<boolean> {
  const missing = getThemeAssets(theme).filter(asset => !scene.textures.exists(asset.key));
  if (missing.length === 0) return prepareCardBack(scene, theme);

  return new Promise(resolve => {
    const finish = () => {
      scene.events.off('shutdown', cancel);
      resolve(missing.every(asset => scene.textures.exists(asset.key)) && prepareCardBack(scene, theme));
    };
    const cancel = () => {
      scene.load.off('complete', finish);
      resolve(false);
    };
    scene.events.once('shutdown', cancel);
    scene.load.once('complete', finish);
    missing.forEach(asset => scene.load.image(asset.key, asset.url));
    if (!scene.load.isLoading()) scene.load.start();
  });
}
