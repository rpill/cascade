import * as Phaser from 'phaser';
import { SfxController } from '../../settings/SfxController.ts';

/** Shared product-UI click cue. The Phaser sound manager is global, so mute/lock state still applies. */
export function playUiButtonSound(scene: Phaser.Scene): void {
  new SfxController(scene.sound).play('button');
}
