import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { EditableInput } from '../../directives/editable-input';
import { NutritionStore } from '../../services/nutrition-store';
import { UiOverlay } from '../../services/ui-overlay';
import { calcularEdadDesdeTexto } from '../../utils/nutrition.utils';
import { EmojiPicker } from '../emoji-picker/emoji-picker';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-profile-editor',
  imports: [EditableInput, EmojiPicker],
  template: `
    <div
      #editorRoot
      id="editor-usuario"
      [class.hidden]="!store.editorUsuario().abierto"
    >
      <div #barraEditor class="barra">
        <button
          type="button"
          id="btn-cancelar"
          [style.display]="store.editorUsuario().esEditar ? 'none' : 'inline-block'"
          (click)="cancelar()"
        >
          Cancelar
        </button>
        <button
          type="button"
          id="btn-eliminar-usuario"
          [style.display]="store.editorUsuario().esEditar ? 'inline-block' : 'none'"
          (mousedown)="bloquearModoFoco()"
          (click)="eliminar()"
        >
          Eliminar
        </button>
        <h3 id="titulo-editor">{{ store.editorUsuario().titulo }}</h3>
        <button
          type="button"
          id="btn-guardar-usuario"
          style="display:inline-block;"
          (mousedown)="bloquearModoFoco()"
          (click)="guardar()"
        >
          Guardar
        </button>
      </div>

      <div class="datos-usuario">
        <div id="avatar-preview" class="perfil-avatar" style="margin:0 auto;">
          {{ avatarSeleccionado() }}
        </div>

        <div class="campo-integrado campo-nombre flotante">
          <label for="input-nombre-usuario">Nombre</label>
          <div
            #nombreEl
            id="input-nombre-usuario"
            class="input-integrado"
            contenteditable="true"
            appEditableInput
            [maxDigitos]="23"
            data-max-digitos="23"
            data-placeholder="Nombre del perfil"
            (focus)="onCampoFocus(nombreEl)"
            (blur)="onCampoBlur(nombreEl, $event)"
          ></div>
        </div>

        <div class="fila-campos">
          <div class="campo-integrado">
            <label for="input-fecha">Fecha de nacimiento</label>
            <div
              #fechaEl
              id="input-fecha"
              class="input-integrado"
              contenteditable="true"
              appEditableInput
              [maxDigitos]="10"
              data-max-digitos="10"
              data-placeholder="Ej: 14/01/1997"
              (focus)="onCampoFocus(fechaEl)"
              (blur)="onCampoBlur(fechaEl, $event)"
              (input)="onFechaInput()"
            ></div>
          </div>

          <div class="campo-integrado">
            <label for="input-edad">Edad</label>
            <div
              #edadEl
              id="input-edad"
              class="input-integrado"
              contenteditable="true"
              appEditableInput
              [soloEnteros]="true"
              [maxDigitos]="3"
              inputmode="decimal"
              data-max-digitos="3"
              data-placeholder="Ej: 28 (años)"
              (focus)="onCampoFocus(edadEl)"
              (blur)="onCampoBlur(edadEl, $event)"
            ></div>
          </div>

          <div class="campo-integrado">
            <label for="input-altura">Altura</label>
            <div
              #alturaEl
              id="input-altura"
              class="input-integrado"
              contenteditable="true"
              appEditableInput
              [soloEnteros]="true"
              [maxDigitos]="3"
              inputmode="decimal"
              data-max-digitos="3"
              data-placeholder="Ej: 178 (cm)"
              (focus)="onCampoFocus(alturaEl)"
              (blur)="onCampoBlur(alturaEl, $event)"
            ></div>
          </div>

          <div class="campo-integrado">
            <label for="input-peso">Peso</label>
            <div
              #pesoEl
              id="input-peso"
              class="input-integrado"
              contenteditable="true"
              appEditableInput
              [soloEnteros]="true"
              [maxDigitos]="3"
              inputmode="decimal"
              data-max-digitos="3"
              data-placeholder="Ej: 65 (kg)"
              (focus)="onCampoFocus(pesoEl)"
              (blur)="onCampoBlur(pesoEl, $event)"
            ></div>
          </div>
        </div>
      </div>

      <app-emoji-picker
        [activo]="store.editorUsuario().abierto"
        (emojiSeleccionado)="onEmojiSeleccionado($event)"
      />
    </div>
  `,
})
export class ProfileEditor {
  readonly store = inject(NutritionStore);
  private readonly ui = inject(UiOverlay);
  private readonly doc = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private readonly editorRootRef = viewChild<ElementRef<HTMLDivElement>>('editorRoot');
  private readonly barraEditorRef = viewChild<ElementRef<HTMLDivElement>>('barraEditor');
  private readonly nombreRef = viewChild<ElementRef<HTMLDivElement>>('nombreEl');
  private readonly fechaRef = viewChild<ElementRef<HTMLDivElement>>('fechaEl');
  private readonly edadRef = viewChild<ElementRef<HTMLDivElement>>('edadEl');
  private readonly alturaRef = viewChild<ElementRef<HTMLDivElement>>('alturaEl');
  private readonly pesoRef = viewChild<ElementRef<HTMLDivElement>>('pesoEl');

  readonly avatarSeleccionado = signal<string>('🙂');

  private modoFocoBloqueado = false;
  private lenguaTimeout1: ReturnType<typeof setTimeout> | null = null;
  private lenguaTimeout2: ReturnType<typeof setTimeout> | null = null;
  private focusTimer: ReturnType<typeof setTimeout> | null = null;
  private wasAbierto = false;
  private wasModalVisible = false;

  constructor() {
    effect(() => {
      const state = this.store.editorUsuario();
      if (!isPlatformBrowser(this.platformId)) return;

      if (state.abierto && !this.wasAbierto) {
        this.wasAbierto = true;
        this.inicializarEditor(state);
      } else if (!state.abierto && this.wasAbierto) {
        this.wasAbierto = false;
        this.limpiarTimersLengua();
        this.restaurarModoFoco();
      }
    });

    effect(() => {
      const modalVisible = this.ui.confirmacion().visible;
      if (this.wasModalVisible && !modalVisible && this.modoFocoBloqueado) {
        this.restaurarModoFoco();
      }
      this.wasModalVisible = modalVisible;
    });

    this.destroyRef.onDestroy(() => {
      this.limpiarTimersLengua();
      if (this.focusTimer !== null) clearTimeout(this.focusTimer);
    });
  }

  private get campos(): HTMLDivElement[] {
    return [
      this.nombreRef()?.nativeElement,
      this.fechaRef()?.nativeElement,
      this.alturaRef()?.nativeElement,
      this.pesoRef()?.nativeElement,
      this.edadRef()?.nativeElement,
    ].filter((el): el is HTMLDivElement => !!el);
  }

  private inicializarEditor(state: ReturnType<NutritionStore['editorUsuario']>): void {
    this.avatarSeleccionado.set(state.emojiInicial);
    this.modoFocoBloqueado = false;

    const nombreDiv = this.nombreRef()?.nativeElement;
    const fechaDiv = this.fechaRef()?.nativeElement;
    const edadDiv = this.edadRef()?.nativeElement;
    const alturaDiv = this.alturaRef()?.nativeElement;
    const pesoDiv = this.pesoRef()?.nativeElement;

    if (nombreDiv) nombreDiv.textContent = state.nombreInicial || '';

    const u =
      state.esEditar && state.editandoKey
        ? this.store.usuariosMap()[state.editandoKey]
        : undefined;

    if (u) {
      if (fechaDiv) fechaDiv.textContent = u.fechaNacimiento || '';
      if (pesoDiv) pesoDiv.textContent = u.peso != null ? String(u.peso) : '';
      if (alturaDiv) alturaDiv.textContent = u.altura != null ? String(u.altura) : '';
      if (edadDiv) edadDiv.textContent = u.edad != null ? String(u.edad) : '';
    } else {
      if (fechaDiv) fechaDiv.textContent = '';
      if (pesoDiv) pesoDiv.textContent = '';
      if (alturaDiv) alturaDiv.textContent = '';
      if (edadDiv) edadDiv.textContent = '';
    }

    this.campos.forEach((div) => this.updatePlaceholder(div));
    this.activarModoFoco();

    if (!state.esEditar) {
      this.limpiarTimersLengua();
      this.lenguaTimeout1 = setTimeout(() => {
        const original = this.avatarSeleccionado();
        this.avatarSeleccionado.set('😛');
        this.lenguaTimeout2 = setTimeout(() => {
          this.avatarSeleccionado.set(original);
        }, 500);
      }, 2000);
    }

    if (this.focusTimer !== null) clearTimeout(this.focusTimer);
    this.focusTimer = setTimeout(() => {
      if (!nombreDiv) return;
      if (nombreDiv.classList.contains('placeholder-activo')) {
        nombreDiv.textContent = '';
        nombreDiv.classList.remove('placeholder-activo');
      }
      nombreDiv.focus();

      const r = this.doc.createRange();
      r.selectNodeContents(nombreDiv);
      r.collapse(false);

      const s = window.getSelection();
      if (s) {
        s.removeAllRanges();
        s.addRange(r);
      }
    }, 0);
  }

  private limpiarTimersLengua(): void {
    if (this.lenguaTimeout1 !== null) {
      clearTimeout(this.lenguaTimeout1);
      this.lenguaTimeout1 = null;
    }
    if (this.lenguaTimeout2 !== null) {
      clearTimeout(this.lenguaTimeout2);
      this.lenguaTimeout2 = null;
    }
  }

  private updatePlaceholder(div: HTMLElement): void {
    const ph = div.dataset['placeholder'] || '';
    if (!(div.textContent || '').trim()) {
      div.classList.add('placeholder-activo');
      div.textContent = ph;
    } else {
      if (div.classList.contains('placeholder-activo')) div.textContent = '';
      div.classList.remove('placeholder-activo');
    }
  }

  private getElementosAOcultar(): HTMLElement[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    return Array.from(
      this.doc.querySelectorAll<HTMLElement>(
        '#panel1 .barra:not(#editor-usuario .barra), #lista-usuarios',
      ),
    );
  }

  private activarModoFoco(): void {
    const editor = this.editorRootRef()?.nativeElement;
    const barra = this.barraEditorRef()?.nativeElement;
    if (!editor || !barra) return;

    this.getElementosAOcultar().forEach((el) => (el.style.display = 'none'));
    barra.style.display = 'flex';
    editor.style.position = 'fixed';
    editor.style.inset = '0';
    editor.style.transition = 'none';
    editor.style.opacity = '1';
  }

  private desactivarModoFoco(e?: FocusEvent): void {
    if (this.modoFocoBloqueado) return;
    const editor = this.editorRootRef()?.nativeElement;
    const newFocus = e?.relatedTarget as Node | null;
    if (newFocus && editor?.contains(newFocus)) return;

    setTimeout(() => {
      if (this.modoFocoBloqueado) return;
      this.getElementosAOcultar().forEach((el) => (el.style.display = ''));
      if (editor) {
        editor.style.position = '';
        editor.style.inset = '';
      }
    }, 0);
  }

  private restaurarModoFoco(): void {
    const editor = this.editorRootRef()?.nativeElement;
    const barra = this.barraEditorRef()?.nativeElement;
    this.getElementosAOcultar().forEach((el) => (el.style.display = ''));
    if (barra) barra.style.display = 'flex';
    if (editor) {
      editor.style.position = '';
      editor.style.inset = '';
    }
    this.modoFocoBloqueado = false;
  }

  onCampoFocus(div: HTMLDivElement): void {
    if (div.classList.contains('placeholder-activo')) {
      div.textContent = '';
      div.classList.remove('placeholder-activo');
    }
    this.activarModoFoco();
  }

  onCampoBlur(div: HTMLDivElement, event: FocusEvent): void {
    this.updatePlaceholder(div);
    this.desactivarModoFoco(event);
  }

  onFechaInput(): void {
    const fechaDiv = this.fechaRef()?.nativeElement;
    const edadDiv = this.edadRef()?.nativeElement;
    if (!fechaDiv || !edadDiv) return;

    const fecha = (fechaDiv.textContent || '').trim();
    const edad = calcularEdadDesdeTexto(fecha);
    if (edad !== null) {
      edadDiv.classList.remove('placeholder-activo');
      edadDiv.textContent = String(edad);
    } else {
      edadDiv.textContent = '';
      edadDiv.classList.add('placeholder-activo');
    }
  }

  onEmojiSeleccionado(emoji: string): void {
    this.avatarSeleccionado.set(emoji);
  }

  bloquearModoFoco(): void {
    this.modoFocoBloqueado = true;
  }

  cancelar(): void {
    this.store.cerrarEditorUsuario();
    this.restaurarModoFoco();
    this.store.verificarLluvia();
  }

  eliminar(): void {
    this.modoFocoBloqueado = true;
    setTimeout(() => {
      this.store.eliminarUsuario();
    }, 200);
  }

  guardar(): void {
    const nombreDiv = this.nombreRef()?.nativeElement;
    const fechaDiv = this.fechaRef()?.nativeElement;
    const pesoDiv = this.pesoRef()?.nativeElement;
    const alturaDiv = this.alturaRef()?.nativeElement;
    if (!nombreDiv) return;

    const nombreInput = nombreDiv.classList.contains('placeholder-activo')
      ? ''
      : (nombreDiv.textContent || '').trim();

    if (!nombreInput) {
      setTimeout(() => {
        this.ui.mostrarToast('Escribe un nombre para el perfil');
        this.modoFocoBloqueado = false;
      }, 200);

      setTimeout(() => {
        if (nombreDiv.classList.contains('placeholder-activo')) {
          nombreDiv.textContent = '';
          nombreDiv.classList.remove('placeholder-activo');
        }
        nombreDiv.focus();
      }, 1301);
      return;
    }

    const editKey = this.store.editorUsuario().editandoKey;
    const map = this.store.usuariosMap();
    const existe = editKey
      ? Object.values(map).some((u) => u.nombreVisual === nombreInput && u !== map[editKey])
      : Object.values(map).some((u) => u.nombreVisual === nombreInput);

    if (existe) {
      setTimeout(() => {
        this.ui.mostrarToast('Ese nombre ya existe');
        this.modoFocoBloqueado = false;
      }, 200);

      setTimeout(() => {
        if (nombreDiv.classList.contains('placeholder-activo')) {
          nombreDiv.textContent = '';
          nombreDiv.classList.remove('placeholder-activo');
        }
        nombreDiv.focus();
      }, 1301);
      return;
    }

    this.modoFocoBloqueado = true;

    setTimeout(() => {
      this.ui.mostrarConfirmacion(
        '¿Quieres guardar este perfil?',
        () => {
          nombreDiv.blur();

          const limpiarNumero = (el: HTMLElement | undefined): number | null => {
            if (!el || el.classList.contains('placeholder-activo')) return null;
            const raw = (el.textContent || '').trim().replace(',', '.');
            const n = parseFloat(raw);
            return Number.isFinite(n) ? n : null;
          };

          const peso = limpiarNumero(pesoDiv);
          const altura = limpiarNumero(alturaDiv);
          const fechaNacimiento =
            !fechaDiv || fechaDiv.classList.contains('placeholder-activo')
              ? ''
              : (fechaDiv.textContent || '').trim();
          const edad = calcularEdadDesdeTexto(fechaNacimiento);

          this.store.guardarPerfil({
            nombreInput,
            emoji: this.avatarSeleccionado(),
            fechaNacimiento,
            edad,
            peso,
            altura,
          });
          this.restaurarModoFoco();
        },
        () => {
          this.ui.mostrarToast('Operación cancelada');
          this.restaurarModoFoco();
        },
        { textoAceptar: 'Aceptar' },
      );
    }, 200);
  }
}
