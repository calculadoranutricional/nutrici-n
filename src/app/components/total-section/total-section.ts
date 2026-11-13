import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DISTRIBUCION_VDR_BASE, VDR_BASE } from '../../data/nutrients.data';
import { NutritionStore } from '../../services/nutrition-store';
import { BodySystems } from '../body-systems/body-systems';
import { DonutChart } from '../donut-chart/donut-chart';
import { NutrientTable } from '../nutrient-table/nutrient-table';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-total-section',
  imports: [DonutChart, NutrientTable, BodySystems],
  template: `
    <div
      class="section"
      [class.hidden]="!visible()"
      [id]="'total-' + usuario()"
      style="margin: 0.5rem;"
    >
      <h4>Total</h4>
      <div class="contenedor0" [class.hidden]="!visible()">
        <div>
          <button
            type="button"
            [id]="'btn-seccion-total-' + usuario()"
            (click)="toggleSeccion()"
          >
            Gráfico-Tablas-Perfiles
          </button>
        </div>
        <button
          type="button"
          [id]="'btn-grafico-total-' + usuario()"
          (click)="toggleGrafico()"
        >
          {{ graficoVisible() ? 'Ocultar gráfico' : 'Mostrar gráfico' }}
        </button>
        <button
          type="button"
          [id]="'btn-tabla-total-' + usuario()"
          (click)="toggleTabla()"
        >
          {{ tablaLabel() }}
        </button>
        <button
          type="button"
          [id]="'btn-perfiles-total-' + usuario()"
          (click)="togglePerfiles()"
        >
          {{ perfilesVisible() ? 'Ocultar perfiles' : 'Mostrar perfiles' }}
        </button>
      </div>

      <div [id]="'seccion0-total-' + usuario()" [class.hidden]="!graficoVisible()">
        <h5 [id]="'titulo-grafico-total-' + usuario()">Gráfico Nutricional</h5>
        <app-donut-chart
          [chartKey]="'total-' + usuario()"
          [totales]="totales()"
          [visible]="visible() && graficoVisible()"
        />
      </div>

      <div
        [id]="'seccion1-total-' + usuario()"
        class="contenedor0"
        [class.hidden]="!tablaVisible()"
      >
        <h5>Tabla Nutricional</h5>
        <div [id]="'tabla-total-' + usuario()">
          <app-nutrient-table
            [totales]="totales()"
            [vdr]="vdr()"
            [distribucionVdr]="distribucionVdr()"
            comida="total"
            [mostrarTodos]="false"
          />
        </div>
        <button type="button" class="btn-compartir" (click)="compartirResultados()">
          Compartir resultados
        </button>
      </div>

      <div [id]="'seccion2-' + usuario()" [class.hidden]="!perfilesVisible()">
        <h3>Sistemas del cuerpo humano</h3>
        <div [id]="'contenido-perfiles-' + usuario()">
          <app-body-systems [totales]="totales()" [vdr]="vdr()" />
        </div>
      </div>
    </div>
  `,
})
export class TotalSection {
  private readonly store = inject(NutritionStore);

  readonly usuario = input.required<string>();

  readonly graficoVisible = signal<boolean>(false);
  readonly tablaVisible = signal<boolean>(false);
  readonly perfilesVisible = signal<boolean>(false);
  private readonly tablaFueToggled = signal<boolean>(false);

  readonly visible = computed(() => {
    return this.store.comidasConAlimentosCount() >= 2;
  });

  readonly totales = computed(() => {
    this.store.datosComidas();
    return this.store.calcularComida(this.usuario(), 'total');
  });

  readonly vdr = computed(() => {
    return this.store.usuariosMap()[this.usuario()]?.vdr || VDR_BASE;
  });

  readonly distribucionVdr = computed(() => {
    return this.store.usuariosMap()[this.usuario()]?.distribucionVDR || DISTRIBUCION_VDR_BASE;
  });

  readonly tablaLabel = computed(() => {
    if (!this.tablaFueToggled() && !this.tablaVisible()) {
      return 'Mostrar tabla';
    }
    return this.tablaVisible() ? 'Ocultar tablas' : 'Mostrar tablas';
  });

  toggleGrafico(): void {
    this.graficoVisible.update((v) => !v);
  }

  toggleTabla(): void {
    this.tablaFueToggled.set(true);
    this.tablaVisible.update((v) => !v);
  }

  togglePerfiles(): void {
    this.perfilesVisible.update((v) => !v);
  }

  toggleSeccion(): void {
    this.tablaFueToggled.set(true);
    const todasOcultas =
      !this.graficoVisible() && !this.tablaVisible() && !this.perfilesVisible();
    this.graficoVisible.set(todasOcultas);
    this.tablaVisible.set(todasOcultas);
    this.perfilesVisible.set(todasOcultas);
  }

  compartirResultados(): void {
    this.store.compartirResultados(this.usuario(), 'total');
  }
}
