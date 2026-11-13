import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import {
  aplicarTono,
  CATEGORIAS_EMOJIS,
  EmojiItem,
  ORDEN_CATEGORIAS_EMOJIS,
  soportaTonos,
  stripSkinTones,
  TONOS_PIEL,
} from '../../data/emojis.data';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-emoji-picker',
  template: `
    <div
      #listaEmojis
      id="lista-emojis"
      style="display:flex; justify-content:center; flex-wrap:wrap; margin-top:1rem;"
    ></div>
  `,
})
export class EmojiPicker {
  private readonly doc = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  readonly activo = input.required<boolean>();
  readonly emojiSeleccionado = output<string>();

  private readonly listaRef = viewChild<ElementRef<HTMLDivElement>>('listaEmojis');

  private tonePickerEl: HTMLDivElement | null = null;
  private tonePickerOpenTarget: HTMLElement | null = null;
  private outsideHandler: ((ev: PointerEvent) => void) | null = null;
  private escapeHandler: ((ev: KeyboardEvent) => void) | null = null;

  private emojiActivo: HTMLSpanElement | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private haMovido = false;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;
  private spanTimers = new WeakMap<HTMLSpanElement, ReturnType<typeof setTimeout>>();

  private docClickEffectHandler = (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('.fila-emoji span')) return;
    this.quitarEfectoEmojis();
  };

  private docScrollEffectHandler = () => {
    this.quitarEfectoEmojis();
  };

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.doc.addEventListener('click', this.docClickEffectHandler);
      this.doc.addEventListener('scroll', this.docScrollEffectHandler, { passive: true });
      this.doc.addEventListener('touchmove', this.docScrollEffectHandler, { passive: true });
    }

    effect(() => {
      const isActivo = this.activo();
      if (!isPlatformBrowser(this.platformId)) return;

      if (isActivo) {
        if (this.renderTimer !== null) clearTimeout(this.renderTimer);
        this.renderTimer = setTimeout(() => this.renderizarEmojis(), 0);
      } else {
        if (this.renderTimer !== null) {
          clearTimeout(this.renderTimer);
          this.renderTimer = null;
        }
        const lista = this.listaRef()?.nativeElement;
        if (lista) lista.innerHTML = '';
        this.cerrarTonePicker();
        this.quitarEfectoEmojis();
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.renderTimer !== null) clearTimeout(this.renderTimer);
      if (this.longPressTimer !== null) clearTimeout(this.longPressTimer);
      this.cerrarTonePicker();
      if (this.tonePickerEl) {
        this.tonePickerEl.remove();
        this.tonePickerEl = null;
      }
      if (isPlatformBrowser(this.platformId)) {
        this.doc.removeEventListener('click', this.docClickEffectHandler);
        this.doc.removeEventListener('scroll', this.docScrollEffectHandler);
        this.doc.removeEventListener('touchmove', this.docScrollEffectHandler);
        if (this.escapeHandler) {
          window.removeEventListener('keydown', this.escapeHandler);
        }
      }
    });
  }

  private renderizarEmojis(): void {
    const lista = this.listaRef()?.nativeElement;
    if (!lista) return;
    lista.innerHTML = '';

    ORDEN_CATEGORIAS_EMOJIS.forEach((categoria) => {
      const dataSource: EmojiItem[] = [];

      Object.keys(CATEGORIAS_EMOJIS).forEach((key) => {
        if (key.startsWith(categoria)) {
          dataSource.push(...CATEGORIAS_EMOJIS[key]);
        }
      });

      if (!dataSource.length) return;

      const titulo = this.doc.createElement('p');
      titulo.textContent = categoria;
      titulo.style.fontWeight = 'bold';
      titulo.style.margin = '0rem';
      titulo.style.padding = '0';
      titulo.style.fontSize = '1rem';
      lista.appendChild(titulo);

      const fila = this.doc.createElement('div');
      fila.className = 'fila-emoji';
      fila.style.height = '65px';
      fila.style.display = 'flex';
      fila.style.marginBottom = '1rem';
      fila.style.padding = '0';
      fila.style.alignItems = 'center';
      fila.style.overflowX = 'auto';
      fila.style.overflowY = 'hidden';
      fila.style.setProperty('-ms-overflow-style', 'none');
      fila.style.setProperty('scrollbar-width', 'none');

      let renderizados = Math.min(dataSource.length, 30);

      dataSource.slice(0, 30).forEach((item) => {
        if (Array.isArray(item)) {
          fila.appendChild(this.crearSpanEmoji(item[0], item));
        } else {
          fila.appendChild(this.crearSpanEmoji(item, null));
        }
      });

      const onScroll = () => {
        if (renderizados < dataSource.length) {
          dataSource.slice(renderizados).forEach((item) => {
            if (Array.isArray(item)) {
              fila.appendChild(this.crearSpanEmoji(item[0], item));
            } else {
              fila.appendChild(this.crearSpanEmoji(item, null));
            }
          });
          renderizados = dataSource.length;
        }
      };

      fila.addEventListener('scroll', onScroll, { once: true });
      lista.appendChild(fila);
    });
  }

  private crearSpanEmoji(e: string, grupoEspecial: string[] | null): HTMLSpanElement {
    const span = this.doc.createElement('span');
    span.textContent = e;
    span.style.fontSize = '3rem';
    span.style.userSelect = 'none';
    span.tabIndex = 0;
    span.setAttribute('role', 'button');
    span.setAttribute('aria-label', `Emoji ${e}`);
    span.style.position = 'relative';
    span.style.transition = 'transform 0.15s ease, filter 0.15s ease';

    span.addEventListener('click', () => {
      const seleccionado = (span.textContent || '').replace(/\uFE0F/g, '');
      this.emojiSeleccionado.emit(seleccionado);
      this.cerrarTonePicker();
    });

    const permitePicker = !!grupoEspecial || soportaTonos(e);

    if (permitePicker) {
      span.appendChild(this.crearTriangulo());
    }

    const abrirPicker = () => {
      if (grupoEspecial) this.mostrarTonePickerEspecial(grupoEspecial, span);
      else if (permitePicker) this.mostrarTonePicker(e, span);
    };

    span.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      abrirPicker();
    });

    span.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'touch') {
        const timer = setTimeout(abrirPicker, 450);
        this.spanTimers.set(span, timer);
      }
    });

    const clearSpanTimer = () => {
      const t = this.spanTimers.get(span);
      if (t !== undefined) {
        clearTimeout(t);
        this.spanTimers.delete(span);
      }
    };

    span.addEventListener('pointerup', clearSpanTimer);
    span.addEventListener('pointercancel', clearSpanTimer);
    span.addEventListener('pointerleave', clearSpanTimer);

    span.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        abrirPicker();
      }
    });

    span.addEventListener(
      'touchstart',
      (ev) => {
        const t = ev.touches[0];
        this.touchStartX = t.clientX;
        this.touchStartY = t.clientY;
        this.haMovido = false;

        this.longPressTimer = setTimeout(() => {
          if (!this.haMovido) this.aplicarEfectoEmoji(span);
        }, 150);
      },
      { passive: true },
    );

    span.addEventListener(
      'touchmove',
      (ev) => {
        const t = ev.touches[0];
        const dx = Math.abs(t.clientX - this.touchStartX);
        const dy = Math.abs(t.clientY - this.touchStartY);
        if (dx > 10 || dy > 10) this.haMovido = true;
      },
      { passive: true },
    );

    span.addEventListener('touchend', () => {
      if (this.longPressTimer !== null) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    });

    span.addEventListener('touchcancel', () => {
      if (this.longPressTimer !== null) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    });

    span.addEventListener('mousedown', () => this.aplicarEfectoEmoji(span));

    return span;
  }

  private crearTriangulo(): HTMLSpanElement {
    const tri = this.doc.createElement('span');
    tri.style.position = 'relative';
    tri.style.width = '0';
    tri.style.height = '0';
    tri.style.borderLeft = '5px solid transparent';
    tri.style.borderRight = '5px solid transparent';
    tri.style.borderTop = '5px solid rgba(0,0,0,0.1)';
    tri.style.bottom = '2px';
    tri.style.left = '29px';
    tri.style.transform = 'rotate(-45deg)';
    return tri;
  }

  private aplicarEfectoEmoji(span: HTMLSpanElement): void {
    if (this.emojiActivo && this.emojiActivo !== span) {
      this.emojiActivo.style.transform = '';
      this.emojiActivo.style.filter = '';
    }
    span.style.transform = 'scale(1.05)';
    span.style.filter = 'drop-shadow(0 0 2px rgba(0, 0, 0, 0.7))';
    span.style.transition = 'transform 0.15s ease, filter 0.15s ease';
    this.emojiActivo = span;
  }

  private quitarEfectoEmojis(): void {
    if (this.emojiActivo) {
      this.emojiActivo.style.transform = '';
      this.emojiActivo.style.filter = '';
      this.emojiActivo = null;
    }
  }

  private crearTonePicker(): void {
    if (this.tonePickerEl) return;
    const el = this.doc.createElement('div');
    el.className = 'tone-picker';
    el.style.position = 'fixed';
    el.style.display = 'none';
    el.style.background = '#f9f9f9';
    el.style.border = '1px solid #ccc';
    el.style.borderRadius = '10px';
    el.style.padding = '6px';
    el.style.zIndex = '2000';
    el.style.gap = '6px';
    el.style.alignItems = 'center';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-hidden', 'true');
    this.doc.body.appendChild(el);

    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.cerrarTonePicker();
    };
    window.addEventListener('keydown', this.escapeHandler);

    this.tonePickerEl = el;
  }

  private mostrarTonePicker(baseEmoji: string, targetEl: HTMLElement): void {
    this.crearTonePicker();
    if (!this.tonePickerEl) return;
    this.tonePickerEl.innerHTML = '';
    const baseClean = stripSkinTones(baseEmoji);
    const variantes = [baseClean, ...TONOS_PIEL.map((t) => aplicarTono(baseClean, t))];

    variantes.forEach((v) => {
      const btn = this.doc.createElement('button');
      btn.type = 'button';
      btn.className = 'tone-btn';
      btn.style.fontSize = '2rem';
      btn.style.padding = '1px';
      btn.style.border = 'none';
      btn.style.background = 'transparent';
      btn.textContent = v;

      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.emojiSeleccionado.emit(v);

        this.doc.querySelectorAll('.fila-emoji span').forEach((s) => {
          const base = stripSkinTones(s.textContent || '');
          if (base === baseClean) {
            s.textContent = v;
            if (soportaTonos(baseClean)) {
              s.appendChild(this.crearTriangulo());
            }
          }
        });

        this.cerrarTonePicker();
      });

      this.tonePickerEl!.appendChild(btn);
    });

    this.posicionarTonePicker(targetEl);
  }

  private mostrarTonePickerEspecial(group: string[], targetEl: HTMLElement): void {
    this.crearTonePicker();
    if (!this.tonePickerEl) return;
    this.tonePickerEl.innerHTML = '';

    group.forEach((e) => {
      const btn = this.doc.createElement('button');
      btn.type = 'button';
      btn.textContent = e;
      btn.style.fontSize = '2rem';
      btn.style.padding = '1px';
      btn.style.border = 'none';
      btn.style.background = 'transparent';

      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.emojiSeleccionado.emit(e);

        const baseClean = stripSkinTones(e);
        this.doc.querySelectorAll('.fila-emoji span').forEach((s) => {
          const base = stripSkinTones(s.textContent || '');
          if (base === baseClean) {
            s.textContent = e;
            if (soportaTonos(baseClean)) {
              s.appendChild(this.crearTriangulo());
            }
          }
        });

        this.cerrarTonePicker();
      });

      this.tonePickerEl!.appendChild(btn);
    });

    this.posicionarTonePicker(targetEl);
  }

  private posicionarTonePicker(targetEl: HTMLElement): void {
    if (!this.tonePickerEl) return;
    const picker = this.tonePickerEl;
    picker.style.display = 'flex';
    picker.setAttribute('aria-hidden', 'false');
    picker.style.left = '0px';
    picker.style.top = '0px';

    requestAnimationFrame(() => {
      const rect = targetEl.getBoundingClientRect();
      const pickerRect = picker.getBoundingClientRect();
      let left = rect.left + (rect.width - pickerRect.width) / 2;
      let top = rect.top - pickerRect.height - 8;
      if (top < 8) top = rect.bottom + 8;
      if (left < 8) left = 8;
      if (left + pickerRect.width > window.innerWidth - 8) {
        left = window.innerWidth - pickerRect.width - 8;
      }
      picker.style.left = `${Math.round(left)}px`;
      picker.style.top = `${Math.round(top)}px`;
    });

    if (this.outsideHandler) {
      this.doc.removeEventListener('pointerdown', this.outsideHandler, true);
      window.removeEventListener('scroll', this.cerrarTonePickerBound, true);
      window.removeEventListener('wheel', this.cerrarTonePickerBound, true);
      window.removeEventListener('touchmove', this.cerrarTonePickerBound, true);
    }

    this.tonePickerOpenTarget = targetEl;
    this.outsideHandler = (ev: PointerEvent) => {
      const path = ev.composedPath ? ev.composedPath() : [];
      if (
        (this.tonePickerEl && path.includes(this.tonePickerEl)) ||
        (this.tonePickerOpenTarget && path.includes(this.tonePickerOpenTarget))
      ) {
        return;
      }
      this.cerrarTonePicker();
    };

    setTimeout(() => {
      if (this.outsideHandler) {
        this.doc.addEventListener('pointerdown', this.outsideHandler, true);
      }
      window.addEventListener('scroll', this.cerrarTonePickerBound, true);
      window.addEventListener('wheel', this.cerrarTonePickerBound, true);
      window.addEventListener('touchmove', this.cerrarTonePickerBound, true);
    }, 0);
  }

  private cerrarTonePickerBound = () => {
    this.cerrarTonePicker();
  };

  private cerrarTonePicker(): void {
    if (!this.tonePickerEl) return;
    this.tonePickerEl.style.display = 'none';
    this.tonePickerEl.setAttribute('aria-hidden', 'true');
    this.tonePickerOpenTarget = null;

    if (this.outsideHandler) {
      this.doc.removeEventListener('pointerdown', this.outsideHandler, true);
      window.removeEventListener('scroll', this.cerrarTonePickerBound, true);
      window.removeEventListener('wheel', this.cerrarTonePickerBound, true);
      window.removeEventListener('touchmove', this.cerrarTonePickerBound, true);
      this.outsideHandler = null;
    }
  }
}
