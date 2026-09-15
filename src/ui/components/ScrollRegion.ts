import Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';

const DRAG_START_THRESHOLD = 8;

export class ScrollRegion {
  private readonly scene: Phaser.Scene;
  private readonly content: Phaser.GameObjects.Container;
  private readonly maskGraphics: Phaser.GameObjects.Graphics;
  private bounds: UiRect = { x: 0, y: 0, width: 1, height: 1 };
  private contentHeight = 1;
  private offsetY = 0;
  private dragStartPointerY: number | null = null;
  private dragStartOffsetY = 0;
  private dragging = false;

  constructor(scene: Phaser.Scene, depth = 0) {
    this.scene = scene;
    this.content = scene.add.container(0, 0).setDepth(depth);
    this.maskGraphics = scene.add.graphics().setVisible(false);
    scene.input.on('pointerdown', this.handlePointerDown, this);
    scene.input.on('pointermove', this.handlePointerMove, this);
    scene.input.on('pointerup', this.handlePointerUp, this);
    scene.input.on('gameout', this.handlePointerUp, this);
    scene.input.on('wheel', this.handleWheel, this);
  }

  add<T extends Phaser.GameObjects.GameObject>(child: T): T {
    this.content.add(child);
    return child;
  }

  setContentHeight(height: number): void {
    this.contentHeight = Math.max(0, height);
    this.setOffset(this.offsetY);
  }

  layout(bounds: UiRect): void {
    this.bounds = bounds;
    this.maskGraphics.clear().fillStyle(0xffffff).fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    const mask = this.maskGraphics.createGeometryMask();
    this.content.setMask(mask);
    this.setOffset(this.offsetY);
  }

  containsPointer(x: number, y: number): boolean {
    return x >= this.bounds.x
      && x <= this.bounds.x + this.bounds.width
      && y >= this.bounds.y
      && y <= this.bounds.y + this.bounds.height;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.containsPointer(pointer.x, pointer.y)) return;
    this.dragStartPointerY = pointer.y;
    this.dragStartOffsetY = this.offsetY;
    this.dragging = false;
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.dragStartPointerY === null || !pointer.isDown) return;
    const deltaY = pointer.y - this.dragStartPointerY;
    if (!this.dragging && Math.abs(deltaY) < DRAG_START_THRESHOLD) return;
    this.dragging = true;
    this.setOffset(this.dragStartOffsetY + deltaY);
  }

  private handlePointerUp(): void {
    this.dragStartPointerY = null;
    this.dragging = false;
  }

  private handleWheel(
    pointer: Phaser.Input.Pointer,
    _objects: readonly Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    if (!this.containsPointer(pointer.x, pointer.y)) return;
    this.setOffset(this.offsetY - deltaY * 0.5);
  }

  private setOffset(offset: number): void {
    const minimum = Math.min(0, this.bounds.height - this.contentHeight);
    this.offsetY = Phaser.Math.Clamp(offset, minimum, 0);
    this.content.setPosition(this.bounds.x, this.bounds.y + this.offsetY);
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    this.scene.input.off('pointerup', this.handlePointerUp, this);
    this.scene.input.off('gameout', this.handlePointerUp, this);
    this.scene.input.off('wheel', this.handleWheel, this);
    this.content.destroy(true);
    this.maskGraphics.destroy();
  }
}
