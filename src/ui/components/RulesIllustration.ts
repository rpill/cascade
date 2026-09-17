import * as Phaser from 'phaser';
import type { RuleSlideId } from '../../game/view/RulesSlides.ts';
import type { UiRect } from '../layout/HomeLayout.ts';

/** View-only examples. Never requests or changes the game's card textures. */
export class RulesIllustration {
  private readonly ink: Phaser.GameObjects.Graphics;
  private objects: (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] = [];
  constructor(private readonly scene: Phaser.Scene) { this.ink = scene.add.graphics().setDepth(1); }

  layout(bounds: UiRect, slide: RuleSlideId): void {
    this.objects.forEach(object => object.destroy()); this.objects = []; this.ink.clear();
    const scale = Math.min(bounds.width / 480, bounds.height / 320);
    const ox = bounds.x + (bounds.width - 480 * scale) / 2;
    const oy = bounds.y + (bounds.height - 320 * scale) / 2;
    const x = (value: number) => ox + value * scale;
    const y = (value: number) => oy + value * scale;
    const rect = (cx: number, cy: number, w: number, h: number, fill: number) => {
      this.ink.fillStyle(fill, 1).fillRoundedRect(x(cx - w / 2), y(cy - h / 2), w * scale, h * scale, 7 * scale);
    };
    const outline = (cx: number, cy: number, w: number, h: number) => {
      this.ink.lineStyle(1.5 * scale, 0xb69557, 0.72).strokeRoundedRect(x(cx - w / 2), y(cy - h / 2), w * scale, h * scale, 7 * scale);
    };
    const label = (value: string, cx: number, cy: number, size = 22, color = '#e6cc91') => {
      this.objects.push(this.scene.add.text(x(cx), y(cy), value, { fontFamily: 'Georgia, serif', fontSize: size * scale, color }).setOrigin(0.5).setDepth(5));
    };
    const card = (key: string, cx: number, cy: number, height = 144) => {
      const width = height * 0.75;
      if (this.scene.textures.exists(key)) {
        this.objects.push(this.scene.add.image(x(cx), y(cy), key).setDisplaySize(width * scale, height * scale).setDepth(3 + this.objects.length * 0.01));
      } else {
        // First-run loading does not guarantee foundation ranks. Use a labelled
        // diagram token until the original card face is available.
        rect(cx, cy, width, height, 0xf7efdc); outline(cx, cy, width, height);
        const [suit, rank] = key.split('-');
        const glyph = suit === 'clubs' ? '♣' : suit === 'spades' ? '♠' : suit === 'hearts' ? '♥' : '♦';
        label(`${rank === '1' ? 'A' : rank}\n${glyph}`, cx, cy, 30, suit === 'hearts' || suit === 'diamonds' ? '#9a493f' : '#24302e');
      }
    };
    const arrow = (from: number, to: number, cy: number) => {
      this.ink.lineStyle(2.5 * scale, 0xe6cc91, 0.95).beginPath().moveTo(x(from), y(cy)).lineTo(x(to), y(cy))
        .moveTo(x(to - 10), y(cy - 7)).lineTo(x(to), y(cy)).lineTo(x(to - 10), y(cy + 7)).strokePath();
    };
    this.ink.fillStyle(0x173c32, 1).fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 12 * scale)
      .lineStyle(scale, 0xb69557, 0.65).strokeRoundedRect(bounds.x + 6 * scale, bounds.y + 6 * scale, bounds.width - 12 * scale, bounds.height - 12 * scale, 9 * scale);
    if (slide === 'foundations') {
      card('clubs-1', 100, 150, 148); card('clubs-2', 240, 150, 148); card('clubs-3', 380, 150, 148);
      arrow(163, 177, 150); arrow(303, 317, 150); label('A → 2 → 3 ··· K', 240, 263, 24);
    } else if (slide === 'alternating-colors') {
      card('spades-9', 220, 99, 138); card('hearts-8', 220, 151, 138); card('clubs-7', 220, 203, 138);
      label('9 ♠', 335, 68, 23); label('8 ♥', 335, 122, 23); label('7 ♣', 335, 176, 23);
      this.ink.lineStyle(1.5 * scale, 0xb69557, 0.6).lineBetween(x(302), y(67), x(302), y(187));
    } else if (slide === 'free-spaces') {
      this.ink.lineStyle(1.2 * scale, 0xb69557, 0.28).lineBetween(x(240), y(58), x(240), y(262));
      card('spades-9', 78, 106, 116); card('hearts-8', 78, 142, 116); card('clubs-7', 78, 178, 116);
      outline(190, 142, 82, 166); label('＋', 190, 142, 31); arrow(126, 149, 142);
      card('hearts-8', 298, 145, 126); outline(412, 145, 92, 126); label('1', 412, 145, 34); arrow(346, 366, 145);
      label('↕', 190, 245, 23); label('•', 412, 245, 28);
    } else {
      rect(86, 166, 102, 144, 0xb69557); rect(81, 161, 102, 144, 0xf7efdc);
      rect(81, 161, 90, 132, 0x24302e); outline(81, 161, 78, 120); label('♣', 81, 160, 42);
      arrow(151, 210, 161); card('spades-9', 271, 140); card('hearts-8', 313, 160); card('clubs-7', 355, 180); label('× 3', 81, 267, 24);
    }
  }
  destroy(): void { this.objects.forEach(object => object.destroy()); this.objects = []; this.ink.destroy(); }
}
