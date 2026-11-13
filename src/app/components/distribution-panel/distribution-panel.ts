import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, PLATFORM_ID } from '@angular/core';
import { COMIDAS, DISTRIBUCION_VDR_BASE } from '../../data/nutrients.data';
import { EditableInput } from '../../directives/editable-input';
import { NutritionStore } from '../../services/nutrition-store';
import { UiOverlay } from '../../services/ui-overlay';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-distribution-panel',
  imports: [EditableInput],
  template: `
    <div id="panel2" [class.abierto]="ui.activePanel() === 'panel2'">
      <div class="barra">
        <button type="button" class="cerrar" (click)="cerrar()">×</button>
        <h3>Distribución VDR%</h3>
        <button type="button" (click)="guardar()">VDR%</button>
      </div>
      <div id="tabla-distribucion-vdr">
        @if (ui.activePanel() === 'panel2') {
          <section style="margin:0.5rem;">
            <table>
              <thead>
                <tr>
                  <th>Comidas / Total</th>
                  <th>Cantidad</th>
                  <th>Unidad</th>
                  <th>VDR%</th>
                </tr>
              </thead>
              <tbody>
                @for (c of filas; track c) {
                  <tr>
                    <td>{{ c }}</td>
                    <td>0.00</td>
                    <td>g</td>
                    <td style="color:#2e7d32;">
                      @if (c === 'Total') {
                        {{ valorDe(c) }}%
                      } @else {
                        <span
                          contenteditable="true"
                          appEditableInput
                          [soloEnteros]="true"
                          [maxDigitos]="2"
                          inputmode="decimal"
                          data-max-digitos="2"
                          [attr.data-comida]="c"
                          style="display:inline-block;"
                          (input)="onValorInput($event, c)"
                        >{{ valorDe(c) }}</span>%
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }
      </div>
    </div>
  `,
})
export class DistributionPanel {
  readonly ui = inject(UiOverlay);
  private readonly store = inject(NutritionStore);
  private readonly doc = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  readonly filas = [...COMIDAS, 'Total'];

  readonly valores = computed<Record<string, number>>(() => {
    const u = this.store.usuarioActualObj();
    return u?.distribucionTemp || u?.distribucionVDR || DISTRIBUCION_VDR_BASE;
  });

  valorDe(comida: string): number {
    return this.valores()[comida] || 0;
  }

  onValorInput(event: Event, comida: string): void {
    const target = event.target as HTMLElement;
    let val = parseFloat(target.textContent || '');
    if (isNaN(val)) val = 0;
    this.store.setDistribucionTemp(comida, val);
  }

  cerrar(): void {
    this.store.descartarDistribucionTemp();
    this.ui.openPanel('panel1');
  }

  guardar(): void {
    const usuario = this.store.usuarioActualObj();
    if (!usuario) {
      this.ui.mostrarToast('No hay un usuario activo seleccionado.');
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
          const uActual = this.store.usuarioActualObj();
          if (uActual?.distribucionTemp) {
            this.store.actualizarDistribucionUsuario(uActual.distribucionTemp);
          } else if (uActual) {
            this.store.actualizarDistribucionUsuario(uActual.distribucionVDR);
          }

          this.ui.closePanel('panel2');
          this.store.verificarLluvia();
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
