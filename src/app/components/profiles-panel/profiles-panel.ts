import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import Sortable from 'sortablejs';
import { EMOJIS_DISPONIBLES } from '../../data/emojis.data';
import { EmojiRain } from '../../services/emoji-rain';
import { NutritionStore } from '../../services/nutrition-store';
import { UiOverlay } from '../../services/ui-overlay';
import { soloLetras } from '../../utils/nutrition.utils';
import { ProfileEditor } from '../profile-editor/profile-editor';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-profiles-panel',
  imports: [ProfileEditor],
  template: `
    <div id="panel1" [class.abierto]="ui.activePanel() === 'panel1'">
      <div class="barra">
        <button type="button" class="cerrar" (click)="cerrar()">×</button>
        <h3 class="titulo-calculadora">{{ store.tituloCalculadora() }}</h3>
        <button type="button" (click)="abrirDistribucion()">VDR%</button>
      </div>

      <div class="menu-izquierdo">
        <div
          #listaUsuarios
          id="lista-usuarios"
          [class.con-perfiles]="store.perfilesHumanos().length > 0"
        >
          @for (perfil of store.perfilesHumanos(); track perfil.nombre; let idx = $index) {
            <div
              class="perfil-card"
              [class.active]="perfil.nombre === store.usuarioActivo()"
              [attr.data-nombre]="perfil.nombre"
              tabindex="0"
              role="button"
              (click)="seleccionarUsuario(perfil.nombre)"
              (keydown.enter)="seleccionarUsuario(perfil.nombre)"
              (keydown.space)="$event.preventDefault(); seleccionarUsuario(perfil.nombre)"
            >
              <div class="perfil-avatar">
                <span class="emoji">
                  {{ perfil.emoji || emojisDisponibles[idx % emojisDisponibles.length] }}
                </span>
                <p>{{ limpiarNombre(perfil.nombreVisual) }}</p>
              </div>
            </div>
          }

          <div
            class="perfil-card add"
            tabindex="0"
            role="button"
            (click)="abrirNuevoUsuario()"
            (keydown.enter)="abrirNuevoUsuario()"
            (keydown.space)="$event.preventDefault(); abrirNuevoUsuario()"
          >
            <div class="perfil-avatar add">
              <span class="emoji">+</span>
              <p>Crear perfil</p>
            </div>
          </div>
        </div>
      </div>

      <div style="text-align:center;">
        <button
          #btnEditar
          type="button"
          id="btn-editar-perfiles"
          [class.hidden]="store.perfilesHumanos().length === 0"
          [style.display]="store.editorUsuario().abierto ? 'none' : 'inline-block'"
          style="margin-top:2rem; padding:14px 14px; font-weight:bold; font-size:1rem; border-radius:3rem; background:#000000; color:white; border: 1px solid #000000;"
          (click)="editarPerfilActivo()"
        >
          Editar perfiles
        </button>
      </div>

      <app-profile-editor />

      <div class="menu-izquierdo"></div>
    </div>
  `,
})
export class ProfilesPanel {
  readonly store = inject(NutritionStore);
  readonly ui = inject(UiOverlay);
  private readonly rain = inject(EmojiRain);
  private readonly doc = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private readonly listaUsuariosRef = viewChild<ElementRef<HTMLDivElement>>('listaUsuarios');
  private readonly btnEditarRef = viewChild<ElementRef<HTMLButtonElement>>('btnEditar');

  readonly emojisDisponibles = EMOJIS_DISPONIBLES;

  private sortableInstance: Sortable | null = null;
  private trashBin: HTMLDivElement | null = null;
  private dragCard: HTMLElement | null = null;
  private dragNombre: string | null = null;
  private isDragging = false;
  private isOverTrash = false;
  private lastScrollTime = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private currentScrollFrame: number | null = null;
  private scrollCheckFrame: number | null = null;

  private readonly onPointerMoveBound = (e: MouseEvent | TouchEvent) => this.onPointerMove(e);

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      this.crearTrashBin();
      this.inicializarSortable();
    });

    afterRenderEffect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      if (this.ui.activePanel() === 'panel1') {
        const lista = this.listaUsuariosRef()?.nativeElement;
        if (lista) {
          lista.scrollLeft = 0;
        }
      }
    });

    this.destroyRef.onDestroy(() => {
      this.limpiarDragListeners();
      if (this.sortableInstance) {
        this.sortableInstance.destroy();
        this.sortableInstance = null;
      }
      if (this.trashBin) {
        this.trashBin.remove();
        this.trashBin = null;
      }
    });
  }

  limpiarNombre(nombreVisual: string): string {
    return soloLetras(nombreVisual);
  }

  cerrar(): void {
    this.ui.closePanel('panel1');
    this.store.cerrarEditorUsuario();
    this.store.verificarLluvia();
  }

  abrirDistribucion(): void {
    this.ui.openPanel('panel2');
    this.rain.detenerLluvia();
  }

  seleccionarUsuario(clave: string): void {
    this.store.seleccionarUsuario(clave);
  }

  abrirNuevoUsuario(): void {
    this.store.abrirMenuNuevoUsuario();
  }

  editarPerfilActivo(): void {
    this.store.abrirEditorPerfilActivo();
  }

  private crearTrashBin(): void {
    if (this.trashBin) return;
    const tb = this.doc.createElement('div');
    tb.id = 'trash-bin';
    tb.textContent = '🗑️';
    Object.assign(tb.style, {
      display: 'none',
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      fontSize: '4rem',
      zIndex: '100',
      pointerEvents: 'none',
      filter: 'drop-shadow(0 0 1px rgba(0, 0, 0, 0.5))',
      transition: 'transform .12s ease, filter .12s ease',
    });
    this.doc.body.appendChild(tb);
    this.trashBin = tb;
  }

  private toggleAvatarYBtn(opacity: string): void {
    const avatar = this.doc.getElementById('avatar-preview');
    const btnEditar = this.btnEditarRef()?.nativeElement || null;

    [avatar, btnEditar].forEach((el) => {
      if (!el) return;
      el.style.transition = 'opacity 0s ease';
      el.style.opacity = opacity;
    });
  }

  private posicionarTrashBin(): void {
    if (!this.trashBin) return;
    const avatar = this.doc.getElementById('avatar-preview');
    const btnEditar = this.btnEditarRef()?.nativeElement || null;
    let targetEl: HTMLElement | null = null;

    if (avatar && avatar.offsetParent !== null) {
      targetEl = avatar;
    } else if (btnEditar && btnEditar.offsetParent !== null) {
      targetEl = btnEditar;
    }

    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      Object.assign(this.trashBin.style, {
        position: 'fixed',
        top: `${rect.top + rect.height / 2}px`,
        left: `${rect.left + rect.width / 2}px`,
        transform: 'translate(-50%, -50%)',
        display: 'block',
      });
      this.toggleAvatarYBtn('0');
    }
  }

  private inicializarSortable(): void {
    const container = this.listaUsuariosRef()?.nativeElement;
    if (!container || this.sortableInstance) return;

    this.sortableInstance = Sortable.create(container, {
      group: 'usuarios',
      animation: 300,
      draggable: '.perfil-card:not(.add)',
      handle: '.perfil-avatar .emoji',
      filter: '.add',
      forceFallback: true,
      ghostClass: 'drag-ghost',
      fallbackClass: 'drag-fallback',
      delay: 100,
      swapThreshold: 0.4,
      delayOnTouchOnly: true,
      scroll: false,

      onStart: (evt) => {
        this.dragCard = evt.item;
        this.dragNombre = this.dragCard.getAttribute('data-nombre');
        this.posicionarTrashBin();
        this.isOverTrash = false;
        this.isDragging = true;

        window.addEventListener('mousemove', this.onPointerMoveBound);
        window.addEventListener('touchmove', this.onPointerMoveBound, { passive: true });
        this.scrollCheckFrame = requestAnimationFrame(() => this.checkScroll());
      },

      onEnd: (evt) => {
        this.isDragging = false;
        this.limpiarDragListeners();

        this.lastScrollTime = 0;
        this.lastPointerX = 0;
        this.lastPointerY = 0;

        if (this.trashBin) this.trashBin.style.display = 'none';
        this.toggleAvatarYBtn('1');

        const nuevoOrden = Array.from(container.children)
          .filter((el) => el.classList.contains('perfil-card') && !el.classList.contains('add'))
          .map((el) => el.getAttribute('data-nombre'))
          .filter((n): n is string => !!n);

        this.store.actualizarOrdenUsuarios(nuevoOrden);

        if (this.isOverTrash) {
          const nombreArrastrado =
            this.dragNombre || evt.item?.getAttribute('data-nombre') || undefined;
          if (nombreArrastrado) {
            this.store.eliminarUsuario(nombreArrastrado);
          }
        }

        this.dragCard = null;
        this.dragNombre = null;
        this.isOverTrash = false;
      },
    });
  }

  private limpiarDragListeners(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    window.removeEventListener('mousemove', this.onPointerMoveBound);
    window.removeEventListener('touchmove', this.onPointerMoveBound);
    if (this.scrollCheckFrame !== null) {
      cancelAnimationFrame(this.scrollCheckFrame);
      this.scrollCheckFrame = null;
    }
    if (this.currentScrollFrame !== null) {
      cancelAnimationFrame(this.currentScrollFrame);
      this.currentScrollFrame = null;
    }
  }

  private animateScroll(container: HTMLElement, distance: number, duration = 300): void {
    if (this.currentScrollFrame !== null) cancelAnimationFrame(this.currentScrollFrame);

    const start = container.scrollLeft;
    const startTime = performance.now();

    const step = (time: number) => {
      const t = Math.min(1, (time - startTime) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      container.scrollLeft = start + distance * eased;
      if (t < 1) {
        this.currentScrollFrame = requestAnimationFrame(step);
      } else {
        this.currentScrollFrame = null;
      }
    };

    this.currentScrollFrame = requestAnimationFrame(step);
  }

  private checkScroll(): void {
    if (!this.isDragging || !this.dragCard) return;

    const container = this.listaUsuariosRef()?.nativeElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const now = Date.now();

    const insideContainer =
      this.lastPointerX >= rect.left &&
      this.lastPointerX <= rect.right &&
      this.lastPointerY >= rect.top &&
      this.lastPointerY <= rect.bottom;

    const nearEdge = this.lastPointerX - rect.left < 25 || rect.right - this.lastPointerX < 25;
    if (this.sortableInstance) {
      this.sortableInstance.option('swapThreshold', nearEdge ? 1 : 0.4);
    }

    if (insideContainer && now - this.lastScrollTime >= 310) {
      this.lastScrollTime = now;
      const card = container.querySelector<HTMLElement>('.perfil-card');
      if (card) {
        const cardWidth = card.offsetWidth;
        if (this.lastPointerX - rect.left < 25) {
          this.animateScroll(container, -cardWidth);
        } else if (rect.right - this.lastPointerX < 25) {
          this.animateScroll(container, cardWidth);
        }
      }
    }

    this.scrollCheckFrame = requestAnimationFrame(() => this.checkScroll());
  }

  private onPointerMove(e: MouseEvent | TouchEvent): void {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    this.lastPointerX = clientX;
    this.lastPointerY = clientY;

    if (!this.trashBin) return;
    const rect = this.trashBin.getBoundingClientRect();
    const nowOver =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;

    if (nowOver !== this.isOverTrash) {
      this.isOverTrash = nowOver;
      if (this.isOverTrash) {
        this.trashBin.style.transform = 'translate(-50%, -50%) scale(1.05)';
        this.trashBin.style.filter = 'drop-shadow(0 0 1px rgba(0, 0, 0, 0.5))';
      } else {
        this.trashBin.style.transform = 'translate(-50%, -50%) scale(1)';
      }
    }
  }
}
