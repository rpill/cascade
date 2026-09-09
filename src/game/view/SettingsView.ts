import { getLanguage, setLanguage, t } from '../../localization/Localization.ts';
import { preferences } from '../../settings/Preferences.ts';

export class SettingsView {
  private readonly root: HTMLDialogElement;
  private readonly title: HTMLHeadingElement;
  private readonly soundLabel: HTMLSpanElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly languageLabel: HTMLSpanElement;
  private readonly languageSelect: HTMLSelectElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly unsubscribe: () => void;
  private previousFocus: HTMLElement | null = null;

  constructor(host: HTMLElement) {
    this.root=document.createElement('dialog');
    this.root.className='settings-dialog';
    this.root.setAttribute('aria-labelledby','settings-title');
    this.title=document.createElement('h2');
    this.title.id='settings-title';
    this.title.className='settings-title';
    const soundRow=document.createElement('div');
    soundRow.className='settings-row';
    this.soundLabel=document.createElement('span');
    this.soundLabel.id='settings-sound-label';
    this.soundButton=document.createElement('button');
    this.soundButton.type='button';
    this.soundButton.className='settings-sound';
    this.soundButton.setAttribute('role','switch');
    this.soundButton.setAttribute('aria-labelledby',this.soundLabel.id);
    this.soundButton.addEventListener('click',()=>preferences.setSoundEnabled(!preferences.soundEnabled));
    soundRow.append(this.soundLabel,this.soundButton);
    const languageRow=document.createElement('label');
    languageRow.className='settings-row';
    this.languageLabel=document.createElement('span');
    this.languageSelect=document.createElement('select');
    this.languageSelect.className='settings-language';
    for (const [value,label] of [['ru','Русский'],['en','English']]) {
      const option=document.createElement('option');
      option.value=value!;option.textContent=label!;
      this.languageSelect.append(option);
    }
    this.languageSelect.addEventListener('change',()=>setLanguage(this.languageSelect.value==='ru'?'ru':'en'));
    languageRow.append(this.languageLabel,this.languageSelect);
    this.closeButton=document.createElement('button');
    this.closeButton.type='button';
    this.closeButton.className='settings-close';
    this.closeButton.addEventListener('click',()=>this.hide());
    this.root.append(this.title,soundRow,languageRow,this.closeButton);
    this.root.addEventListener('cancel',event=>{event.preventDefault();this.hide();});
    this.root.addEventListener('pointerdown',event=>event.stopPropagation());
    this.root.addEventListener('pointerup',event=>event.stopPropagation());
    this.root.addEventListener('keydown',event=>{
      // Keep Escape and game shortcuts from reaching Phaser behind the dialog.
      event.stopPropagation();
      if(event.key==='Escape'){event.preventDefault();this.hide();}
    });
    this.root.addEventListener('click',event=>{
      event.stopPropagation();
      if(event.target===this.root){
        const bounds=this.root.getBoundingClientRect();
        if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)this.hide();
      }
    });
    host.append(this.root);
    this.unsubscribe=preferences.subscribe(()=>this.refreshLocalization());
    this.refreshLocalization();
  }
  get isOpen(): boolean { return this.root.open; }
  show(): void {
    if(this.root.open)return;
    this.previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    this.refreshLocalization();
    this.root.showModal();
    this.soundButton.focus();
  }
  hide(): void {
    if(!this.root.open)return;
    this.root.close();
    this.previousFocus?.focus({preventScroll:true});
    this.previousFocus=null;
  }
  refreshLocalization(): void {
    this.title.textContent=t('Настройки');
    this.soundLabel.textContent=t('Звук');
    this.soundButton.textContent=preferences.soundEnabled?t('Включён'):t('Выключен');
    this.soundButton.setAttribute('aria-checked',String(preferences.soundEnabled));
    this.languageLabel.textContent=t('Язык');
    this.languageSelect.value=getLanguage();
    this.closeButton.textContent=t('Готово');
  }
  destroy(): void {this.hide();this.unsubscribe();this.root.remove();}
}
