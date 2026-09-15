import Phaser from 'phaser';
import { SceneBackdrop } from '../components/SceneBackdrop.ts';
import { resolveUiViewport, scaleUiViewportForBacking, type ResolvedUiViewport } from '../layout/UiViewport.ts';

export abstract class BaseUiScene extends Phaser.Scene {
  private responsiveBound = false;
  private viewport: ResolvedUiViewport | null = null;
  private backdrop: SceneBackdrop | null = null;

  protected bindResponsiveLayout(): ResolvedUiViewport {
    if (!this.responsiveBound) {
      this.backdrop = new SceneBackdrop(this, this.sys.settings.key === 'HomeScene' ? 'home' : 'menu');
      this.scale.on('resize', this.handleUiResize, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scale.off('resize', this.handleUiResize, this);
        this.responsiveBound = false;
        this.viewport = null;
        this.backdrop?.destroy();
        this.backdrop = null;
      });
      this.responsiveBound = true;
    }
    return this.refreshUiLayout();
  }

  protected currentUiViewport(): ResolvedUiViewport {
    return this.viewport ?? this.resolveCurrentUiViewport();
  }

  protected isUiSceneActive(): boolean {
    return this.responsiveBound && this.sys.isActive();
  }

  protected requestUiLayout(): ResolvedUiViewport | null {
    if (!this.isUiSceneActive()) return null;
    return this.refreshUiLayout();
  }

  protected abstract layout(viewport: ResolvedUiViewport): void;

  private handleUiResize(): void {
    this.requestUiLayout();
  }

  private refreshUiLayout(): ResolvedUiViewport {
    const viewport = this.resolveCurrentUiViewport();
    this.backdrop?.layout(viewport.width, viewport.height);
    this.layout(viewport);
    return viewport;
  }

  private resolveCurrentUiViewport(): ResolvedUiViewport {
    const cssZoom = this.scale.zoom > 0 ? this.scale.zoom : 1;
    const renderScale = 1 / cssZoom;
    const logicalWidth = this.scale.width / renderScale;
    const logicalHeight = this.scale.height / renderScale;
    this.cameras.main
      .setSize(this.scale.width, this.scale.height)
      .setZoom(1)
      .setScroll(0, 0);
    const logicalViewport = resolveUiViewport({
      width: logicalWidth,
      height: logicalHeight,
      touchPrimary: this.hasPrimaryTouchPointer(),
    });
    const viewport = scaleUiViewportForBacking(logicalViewport, renderScale);
    this.viewport = viewport;
    return viewport;
  }

  private hasPrimaryTouchPointer(): boolean {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) return true;
    return navigator.maxTouchPoints > 0;
  }
}
