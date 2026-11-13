import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import { NUTRIENTES, VDR_BASE } from '../../data/nutrients.data';
import { EditableInput } from '../../directives/editable-input';
import { NutrienteInfo } from '../../models/nutrition.model';
import { EmojiRain } from '../../services/emoji-rain';
import { NutritionStore } from '../../services/nutrition-store';
import { UiOverlay } from '../../services/ui-overlay';

interface VdrFila {
  tipo: 'subtitulo' | 'nutriente';
  subtitulo?: string;
  nutriente?: NutrienteInfo;
}

interface VdrSeccion {
  categoria: string;
  filas: VdrFila[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-vdr-panel',
  imports: [EditableInput],
  template: `
    <div id="panel" [class.abierto]="ui.activePanel() === 'panel'">
      <div class="barra">
        <button type="button" class="cerrar" (click)="cerrarVDR()">×</button>
        <h3>Personalizar VDR%</h3>
        <button type="button" (click)="guardarVDR()">VDR%</button>
      </div>
      <div id="tabla-vdr" #tablaVdr>
        @if (ui.activePanel() === 'panel') {
          @for (sec of secciones; track sec.categoria) {
            <section style="margin:0.5rem;">
              <table>
                <thead>
                  <tr>
                    <th>Nutriente</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th>VDR%</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colspan="4" style="text-align:center;background:#f0f0f0;font-weight:600">
                      {{ sec.categoria }}
                    </td>
                  </tr>
                  @for (fila of sec.filas; track $index) {
                    @if (fila.tipo === 'subtitulo') {
                      <tr>
                        <td
                          colspan="4"
                          style="text-align:center;background:#f0f0f0;font-weight:600;font-size:.8rem"
                        >
                          {{ fila.subtitulo }}
                        </td>
                      </tr>
                    } @else if (fila.nutriente; as n) {
                      <tr>
                        <td>{{ n.nombre }}</td>
                        <td>
                          <div
                            contenteditable="true"
                            appEditableInput
                            [soloEnteros]="true"
                            [maxDigitos]="4"
                            inputmode="decimal"
                            data-max-digitos="4"
                            [attr.data-nutriente]="n.nombre"
                            class="input-editor"
                            placeholder="0.00"
                          >{{ displayValor(n.nombre) }}</div>
                        </td>
                        <td>{{ n.unidad }}</td>
                        <td style="color:#2e7d32">100%</td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </section>
          }
        }
      </div>
    </div>
  `,
})
export class VdrPanel {
  readonly ui = inject(UiOverlay);
  private readonly store = inject(NutritionStore);
  private readonly rain = inject(EmojiRain);
  private readonly doc = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly tablaVdrRef = viewChild<ElementRef<HTMLDivElement>>('tablaVdr');

  readonly secciones: VdrSeccion[] = this.construirSecciones();

  readonly userVdr = computed(() => {
    return this.store.usuarioActualObj()?.vdr || VDR_BASE;
  });

  private construirSecciones(): VdrSeccion[] {
    const res: VdrSeccion[] = [];
    const extraer = (nodo: unknown): VdrFila[] => {
      const filas: VdrFila[] = [];
      if (Array.isArray(nodo)) {
        (nodo as NutrienteInfo[]).forEach((n) => {
          filas.push({ tipo: 'nutriente', nutriente: n });
        });
      } else if (nodo && typeof nodo === 'object') {
        for (const [subtitulo, subn] of Object.entries(nodo as Record<string, unknown>)) {
          filas.push({ tipo: 'subtitulo', subtitulo });
          filas.push(...extraer(subn));
        }
      }
      return filas;
    };

    for (const [categoria, contenido] of Object.entries(NUTRIENTES)) {
      if (categoria.toLowerCase().includes('fisicoquímicas')) continue;
      res.push({ categoria, filas: extraer(contenido) });
    }
    return res;
  }

  displayValor(nombre: string): string {
    const valor = this.userVdr()[nombre];
    return typeof valor === 'number' ? String(valor) : '';
  }

  cerrarVDR(): void {
    this.ui.closePanel('panel');
    this.rain.iniciarLluvia();
  }

  guardarVDR(): void {
    const usuario = this.store.usuarioActualObj();
    if (!usuario) {
      this.ui.mostrarToast('No hay un usuario activo para guardar VDR.');
      return;
    }

    if (isPlatformBrowser(this.platformId)) {
      const nombreDiv = this.doc.getElementById('input-nombre-usuario');
      if (nombreDiv) nombreDiv.blur();
    }

    setTimeout(() => {
      this.ui.mostrarConfirmacion(
        '¿Quieres guardar los VDR%?',
        () => {
          const cont = this.tablaVdrRef()?.nativeElement;
          const nuevoVdr: Record<string, number> = {};
          if (cont) {
            cont.querySelectorAll<HTMLElement>('[data-nutriente]').forEach((div) => {
              const nombre = div.dataset['nutriente'];
              const texto = (div.textContent || '').trim();
              const valor = parseFloat(texto);
              if (nombre && !isNaN(valor)) {
                nuevoVdr[nombre] = valor;
              }
            });
          }

          this.store.actualizarVDRUsuario(nuevoVdr);
          this.cerrarVDR();
          this.ui.syncScroll();
          this.ui.mostrarToast('VDR% guardados correctamente.');
          this.store.enfocarPrimerPeso();
        },
        () => {
          this.ui.mostrarToast('Operación cancelada');
        },
        { textoAceptar: 'Aceptar' },
      );
    }, 200);
  }
}
