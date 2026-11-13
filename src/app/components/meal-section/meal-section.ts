import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { ALIMENTOS } from '../../data/foods.data';
import { CATEGORIAS, VDR_BASE, DISTRIBUCION_VDR_BASE } from '../../data/nutrients.data';
import { EditableInput } from '../../directives/editable-input';
import { Alimento } from '../../models/nutrition.model';
import { NutritionStore } from '../../services/nutrition-store';
import { DonutChart } from '../donut-chart/donut-chart';
import { ManualEditor } from '../manual-editor/manual-editor';
import { NutrientTable } from '../nutrient-table/nutrient-table';

interface ItemDisplay {
  nombre: string;
  cantidad: string | number;
  unidad: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-meal-section',
  imports: [EditableInput, DonutChart, NutrientTable, ManualEditor],
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
  template: `
    <div
      class="section"
      [id]="'comida-' + key()"
      style="margin: 0.5rem; border-bottom: 1px solid #ccc;"
    >
      <div class="contenedor-select">
        <h5 class="titulo-comida">{{ comida() }}</h5>
        <select
          [id]="'cat-' + key()"
          class="select-categorias"
          (change)="onCategoriaChange($event)"
        >
          <option value="">Todas las categorías</option>
          @for (c of categorias; track c) {
            <option [value]="c">{{ c }}</option>
          }
        </select>
      </div>

      <div class="fila-comida">
        <div class="contenedor-buscador">
          <div
            #buscarEl
            [id]="'buscar-' + key()"
            contenteditable="true"
            appEditableInput
            [esBuscador]="true"
            [maxDigitos]="20"
            class="input-buscador"
            data-max-digitos="20"
            placeholder="Buscar alimento"
            (input)="onBuscarInput()"
          ></div>
          <ul #sugerenciasEl [id]="'sugerencias-' + key()" class="sugerencias-lista">
            @for (a of sugerencias(); track a.nombre) {
              <li>
                <button type="button" (click)="onSugerenciaClick(a, $event)">
                  {{ a.nombre }}
                </button>
              </li>
            }
          </ul>
        </div>
        <div class="contenedor-peso">
          <span class="etiqueta-peso">g</span>
          <div
            #pesoEl
            [id]="'peso-' + key()"
            contenteditable="true"
            appEditableInput
            [soloEnteros]="true"
            inputmode="decimal"
            class="input-peso"
            placeholder="Peso"
          ></div>
        </div>
      </div>

      <div [id]="'lista-' + key()">
        @if (itemsDisplay().length > 0) {
          <div
            class="sin-scrollbar"
            [style.maxHeight]="itemsDisplay().length > 5 ? '160px' : null"
            [style.overflowY]="itemsDisplay().length > 5 ? 'auto' : null"
          >
            <table>
              <thead>
                <tr>
                  <th>Alimento / Nutriente</th>
                  <th>Cantidad</th>
                  <th>Unidad</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (item of itemsDisplay(); track $index) {
                  <tr>
                    <td>{{ item.nombre }}</td>
                    <td>{{ item.cantidad }}</td>
                    <td>{{ item.unidad }}</td>
                    <td>
                      <button
                        type="button"
                        class="btn-eliminar btn-eliminar-item"
                        (click)="eliminarItem($index)"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <div class="contenedor0" [class.hidden]="items().length === 0">
        <div class="contenedor">
          <div class="divisor-box">
            <button type="button" (click)="revertirDivision()">Revertir</button>
            <div
              #divisorEl
              contenteditable="true"
              appEditableInput
              [soloEnteros]="true"
              [id]="'divisor-' + key()"
              inputmode="decimal"
              class="input-divir"
              placeholder="Dividir comida entre..."
            ></div>
            <button type="button" (click)="dividirAlimentos()">Aplicar</button>
          </div>
          <button type="button" [id]="'btn-grafico-' + key()" (click)="toggleGrafico()">
            {{ graficoVisible() ? 'Ocultar gráfico' : 'Mostrar gráfico' }}
          </button>
          <button type="button" [id]="'btn-seccion-' + key()" (click)="toggleSeccion()">
            Gráfico-Tablas
          </button>
          <button type="button" [id]="'btn-tabla-' + key()" (click)="toggleTabla()">
            {{ tablaVisible() ? 'Ocultar tablas' : 'Mostrar tablas' }}
          </button>
          <div>
            <button type="button" class="btn-compartir" (click)="compartirAlimentos()">
              Compartir alimentos con perfiles
            </button>
          </div>
        </div>

        <div [id]="'seccion0-' + key()" [class.hidden]="!graficoVisible()">
          <h4 [id]="'titulo-grafico-' + key()">Gráfico Nutricional</h4>
          <app-donut-chart
            [chartKey]="key()"
            [totales]="totales()"
            [visible]="items().length > 0 && graficoVisible()"
          />
        </div>

        <div [id]="'seccion1-' + key()" [class.hidden]="!tablaVisible()">
          <button type="button" [id]="'btn-nutrientes-' + key()" (click)="toggleNutrientes()">
            {{
              mostrarTodos()
                ? 'Ocultar nutrientes vacíos'
                : 'Mostrar todos los nutrientes'
            }}
          </button>
          <button type="button" [id]="'btn-aplicar-' + key()" (click)="toggleAlternar()">
            {{ modoManual() ? 'Aplicar nutrientes' : 'Agregar nutrientes' }}
          </button>
          <h4 [id]="'titulo-tabla-' + key()">Tabla Nutricional</h4>
          <div [id]="'tabla-' + key()" [class.hidden]="modoManual()">
            <app-nutrient-table
              [totales]="totales()"
              [vdr]="vdr()"
              [distribucionVdr]="distribucionVdr()"
              [comida]="comida()"
              [mostrarTodos]="mostrarTodos()"
            />
          </div>
          <h4 [id]="'titulo-editor-' + key()" class="hidden">Editor Manual</h4>
          <div [id]="'editor-' + key()" [class.hidden]="!modoManual()">
            <app-manual-editor
              #manualEditor
              [usuario]="usuario()"
              [comida]="comida()"
              [totales]="totales()"
              [vdr]="vdr()"
              [distribucionVdr]="distribucionVdr()"
            />
          </div>
          <button type="button" class="btn-compartir" (click)="compartirResultados()">
            Compartir resultados
          </button>
        </div>
      </div>
    </div>
  `,
})
export class MealSection {
  private readonly store = inject(NutritionStore);
  private readonly platformId = inject(PLATFORM_ID);

  readonly usuario = input.required<string>();
  readonly comida = input.required<string>();

  private readonly buscarRef = viewChild<ElementRef<HTMLDivElement>>('buscarEl');
  private readonly sugerenciasRef = viewChild<ElementRef<HTMLUListElement>>('sugerenciasEl');
  private readonly pesoRef = viewChild<ElementRef<HTMLDivElement>>('pesoEl');
  private readonly divisorRef = viewChild<ElementRef<HTMLDivElement>>('divisorEl');
  private readonly manualEditorRef = viewChild<ManualEditor>('manualEditor');

  readonly categorias = CATEGORIAS;
  readonly categoriaSeleccionada = signal<string>('');
  readonly sugerencias = signal<Alimento[]>([]);

  readonly graficoVisible = signal<boolean>(true);
  readonly tablaVisible = signal<boolean>(true);
  readonly modoManual = signal<boolean>(false);

  readonly key = computed(() => `${this.usuario()}-${this.comida()}`);

  readonly items = computed(() => {
    return this.store.datosComidas()[this.key()] || [];
  });

  readonly itemsDisplay = computed<ItemDisplay[]>(() => {
    return this.items().map(({ alimento, peso }) => {
      if (alimento?.esManual && alimento.displayManual) {
        const partes = alimento.displayManual.trim().split(' ');
        const unidad = partes.pop() || '';
        const cantidad = partes.pop() || '';
        const nombre = partes.join(' ');
        return { nombre, cantidad, unidad };
      }
      return {
        nombre: alimento.nombre,
        cantidad: peso,
        unidad: alimento.unidad || 'g',
      };
    });
  });

  readonly totales = computed(() => {
    this.items();
    return this.store.calcularComida(this.usuario(), this.comida());
  });

  readonly vdr = computed(() => {
    return this.store.usuariosMap()[this.usuario()]?.vdr || VDR_BASE;
  });

  readonly distribucionVdr = computed(() => {
    return this.store.usuariosMap()[this.usuario()]?.distribucionVDR || DISTRIBUCION_VDR_BASE;
  });

  readonly mostrarTodos = computed(() => {
    return !!this.store.mostrarTodosLosNutrientes()[this.key()];
  });

  onCategoriaChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.categoriaSeleccionada.set(val);
    if (this.sugerencias().length > 0 || (this.buscarRef()?.nativeElement.textContent || '').trim()) {
      this.onBuscarInput();
    }
  }

  onBuscarInput(): void {
    const buscar = this.buscarRef()?.nativeElement;
    if (!buscar) return;
    const val = (buscar.textContent || '').toLowerCase();
    const cat = this.categoriaSeleccionada();
    this.sugerencias.set(
      ALIMENTOS.filter((a) => a.nombre.toLowerCase().includes(val) && (!cat || a.categoria === cat)),
    );
  }

  onSugerenciaClick(alimento: Alimento, event: MouseEvent): void {
    event.stopPropagation();
    setTimeout(() => this.seleccionarAlimento(alimento), 0);
  }

  onDocumentClick(e: MouseEvent): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const target = e.target as Node | null;
    const buscar = this.buscarRef()?.nativeElement;
    const sugerencias = this.sugerenciasRef()?.nativeElement;
    const peso = this.pesoRef()?.nativeElement;
    if (!buscar || !sugerencias || !peso || !target) return;

    const clickedInside =
      buscar.contains(target) || sugerencias.contains(target) || peso.contains(target);
    if (!clickedInside) {
      buscar.textContent = '';
      this.sugerencias.set([]);
      peso.textContent = '';
    }
  }

  private seleccionarAlimento(alimento: Alimento): void {
    const buscar = this.buscarRef()?.nativeElement;
    const pesoEl = this.pesoRef()?.nativeElement;
    if (!buscar || !pesoEl) return;

    const peso = parseFloat(pesoEl.textContent || '');
    const res = this.store.agregarAlimento(this.usuario(), this.comida(), alimento, peso);

    if (!res.ok) {
      if (res.focusPeso) {
        setTimeout(() => pesoEl.focus(), 1000);
      }
      return;
    }

    buscar.textContent = '';
    pesoEl.textContent = '';
    this.sugerencias.set([]);
  }

  eliminarItem(index: number): void {
    this.store.eliminarItem(this.usuario(), this.comida(), index);
  }

  dividirAlimentos(): void {
    const divisorEl = this.divisorRef()?.nativeElement;
    if (!divisorEl) return;
    const res = this.store.dividirAlimentos(
      this.usuario(),
      this.comida(),
      divisorEl.textContent || '',
    );
    if (!res.ok) {
      setTimeout(() => divisorEl.focus(), 1001);
    }
  }

  revertirDivision(): void {
    this.store.revertirDivision(this.usuario(), this.comida());
  }

  toggleGrafico(): void {
    this.graficoVisible.update((v) => !v);
  }

  toggleTabla(): void {
    this.tablaVisible.update((v) => !v);
  }

  toggleSeccion(): void {
    const ambasOcultas = !this.graficoVisible() && !this.tablaVisible();
    this.graficoVisible.set(ambasOcultas);
    this.tablaVisible.set(ambasOcultas);
  }

  toggleNutrientes(): void {
    this.store.toggleMostrarTodosNutrientes(this.key());
  }

  toggleAlternar(): void {
    if (this.modoManual()) {
      this.manualEditorRef()?.aplicarManual();
      this.modoManual.set(false);
    } else {
      this.manualEditorRef()?.resetear();
      this.modoManual.set(true);
    }
  }

  compartirAlimentos(): void {
    this.store.compartirAlimentos(this.usuario(), this.comida());
  }

  compartirResultados(): void {
    this.store.compartirResultados(this.usuario(), this.comida());
  }
}
