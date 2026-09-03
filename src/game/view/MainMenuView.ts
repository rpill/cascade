import Phaser from 'phaser';

import type { GameMode } from '../model/types.ts';
import { GAME_HEIGHT, GAME_WIDTH } from './layout.ts';

interface MainMenuActions {
  readonly select: (mode: GameMode) => void;
  readonly play: () => void;
  readonly cancel: () => void;
}

interface MainMenuShowOptions {
  readonly canCancel: boolean;
  readonly selectedMode: GameMode | null;
}

const MENU_DEPTH = 5000;
type MenuObject = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text;

export class MainMenuView {
  private readonly actions: MainMenuActions;
  private readonly objects: MenuObject[] = [];
  private readonly blocker: Phaser.GameObjects.Rectangle;
  private readonly cancelHint: Phaser.GameObjects.Text;
  private readonly playButton: Phaser.GameObjects.Rectangle;
  private readonly playLabel: Phaser.GameObjects.Text;
  private readonly modeButtons = new Map<GameMode, Phaser.GameObjects.Rectangle>();

  private selectedMode: GameMode | null = null;

  constructor(scene: Phaser.Scene, actions: MainMenuActions) {
    this.actions = actions;
    this.blocker = scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x111514,
      0.78,
    ).setDepth(MENU_DEPTH).setInteractive();

    const panel = scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      660,
      510,
      0x303534,
      1,
    ).setStrokeStyle(2, 0x798785, 0.95).setDepth(MENU_DEPTH + 1);

    const title = scene.add.text(GAME_WIDTH / 2, 166, 'ГЛАВНОЕ МЕНЮ', {
      color: '#fff4df',
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(MENU_DEPTH + 2);

    const intro = scene.add.text(
      GAME_WIDTH / 2,
      214,
      'Выберите принцип раздачи',
      {
        color: '#c9d0cc',
        fontFamily: 'Arial, sans-serif',
        fontSize: '17px',
      },
    ).setOrigin(0.5).setDepth(MENU_DEPTH + 2);

    const original = this.createModeButton(
      scene,
      292,
      'original',
      'ОРИГИНАЛЬНЫЙ',
      'Точный алгоритм Zachtronics.\nРедкие нерешаемые партии возможны.',
    );
    const winnable = this.createModeButton(
      scene,
      402,
      'winnable',
      'ГАРАНТИРОВАННО РЕШАЕМЫЙ',
      'Только раздачи, для которых офлайн-решатель\nнашёл полный путь до победы.',
    );

    this.playButton = scene.add.rectangle(
      GAME_WIDTH / 2,
      506,
      220,
      46,
      0x4f5755,
      1,
    ).setStrokeStyle(1, 0x6e7774, 0.9).setDepth(MENU_DEPTH + 2);
    this.playButton.on('pointerover', () => {
      if (this.selectedMode !== null) {
        this.playButton.setFillStyle(0xd05a4e);
      }
    });
    this.playButton.on('pointerout', () => this.updatePlayState());
    this.playButton.on('pointerdown', () => {
      if (this.selectedMode !== null) {
        this.actions.play();
      }
    });

    this.playLabel = scene.add.text(GAME_WIDTH / 2, 506, 'ИГРАТЬ', {
      color: '#fff4df',
      fontFamily: 'Arial, sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(MENU_DEPTH + 3);

    this.cancelHint = scene.add.text(
      GAME_WIDTH / 2,
      558,
      'ESC — вернуться к текущей игре',
      {
        color: '#aeb8b4',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
      },
    ).setOrigin(0.5).setDepth(MENU_DEPTH + 2).setInteractive({ useHandCursor: true });
    this.cancelHint.on('pointerdown', actions.cancel);

    this.objects.push(
      this.blocker,
      panel,
      title,
      intro,
      ...original,
      ...winnable,
      this.playButton,
      this.playLabel,
      this.cancelHint,
    );
    this.hide();
  }

  show({ canCancel, selectedMode }: MainMenuShowOptions): void {
    this.selectedMode = selectedMode;
    this.objects.forEach((object) => object.setVisible(true));
    this.blocker.setInteractive();
    this.modeButtons.forEach((button) => button.setInteractive({ useHandCursor: true }));
    this.updateModeVisuals();
    this.updatePlayState();

    this.cancelHint.setVisible(canCancel);
    if (canCancel) {
      this.cancelHint.setInteractive({ useHandCursor: true });
    } else {
      this.cancelHint.disableInteractive();
    }
  }

  hide(): void {
    this.objects.forEach((object) => object.setVisible(false));
    this.blocker.disableInteractive();
    this.modeButtons.forEach((button) => button.disableInteractive());
    this.playButton.disableInteractive();
    this.cancelHint.disableInteractive();
  }

  destroy(): void {
    this.objects.forEach((object) => object.destroy());
  }

  private createModeButton(
    scene: Phaser.Scene,
    y: number,
    mode: GameMode,
    title: string,
    description: string,
  ): MenuObject[] {
    const button = scene.add.rectangle(
      GAME_WIDTH / 2,
      y,
      560,
      92,
      0x454c4a,
      1,
    ).setStrokeStyle(1, 0x8b9995, 0.9)
      .setDepth(MENU_DEPTH + 2)
      .setInteractive({ useHandCursor: true });

    const heading = scene.add.text(GAME_WIDTH / 2, y - 20, title, {
      color: '#fff4df',
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(MENU_DEPTH + 3);

    const copy = scene.add.text(GAME_WIDTH / 2, y + 18, description, {
      align: 'center',
      color: '#cad2ce',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      lineSpacing: 3,
    }).setOrigin(0.5).setDepth(MENU_DEPTH + 3);

    button.on('pointerover', () => {
      if (this.selectedMode !== mode) {
        button.setFillStyle(0x59625f);
      }
    });
    button.on('pointerout', () => this.updateModeVisuals());
    button.on('pointerdown', () => {
      this.selectedMode = mode;
      this.actions.select(mode);
      this.updateModeVisuals();
      this.updatePlayState();
    });

    this.modeButtons.set(mode, button);
    return [button, heading, copy];
  }

  private updateModeVisuals(): void {
    this.modeButtons.forEach((button, mode) => {
      if (mode === this.selectedMode) {
        button
          .setFillStyle(0x5d4944)
          .setStrokeStyle(2, 0xe07a6d, 1);
      } else {
        button
          .setFillStyle(0x454c4a)
          .setStrokeStyle(1, 0x8b9995, 0.9);
      }
    });
  }

  private updatePlayState(): void {
    if (this.selectedMode === null) {
      this.playButton
        .setFillStyle(0x4f5755)
        .setStrokeStyle(1, 0x6e7774, 0.9)
        .disableInteractive();
      this.playLabel.setAlpha(0.48);
      return;
    }

    this.playButton
      .setFillStyle(0xb8473e)
      .setStrokeStyle(1, 0xe07a6d, 0.9)
      .setInteractive({ useHandCursor: true });
    this.playLabel.setAlpha(1);
  }
}
