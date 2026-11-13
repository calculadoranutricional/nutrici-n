import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { COLORES_VDR, NUTRIENTES_PLANOS } from '../../data/nutrients.data';
import { SISTEMAS } from '../../data/systems.data';

interface FilaSistema {
  nombre: string;
  cantidad: string | number;
  unidad: string;
  porcTxt: string;
  color: string;
}

interface SubcategoriaSistema {
  nombre: string;
  filas: FilaSistema[];
}

interface CategoriaSistema {
  nombre: string;
  subcategorias: SubcategoriaSistema[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-body-systems',
  template: `
    @for (cat of categorias(); track cat.nombre) {
      <div
        class="section perfil-funcional"
        [attr.data-categoria]="cat.nombre"
        style="margin-bottom:1rem;"
      >
        <section>
          <h4 style="text-align:center">{{ cat.nombre }}</h4>
          @for (sub of cat.subcategorias; track sub.nombre) {
            <h5 style="text-align:left; margin-bottom:0.5rem">{{ sub.nombre }}</h5>
            <table class="tabla" style="margin-bottom:1rem;">
              <thead>
                <tr>
                  <th>Nutriente</th>
                  <th>Cantidad</th>
                  <th>Unidad</th>
                  <th>VDR%</th>
                </tr>
              </thead>
              <tbody>
                @for (fila of sub.filas; track fila.nombre) {
                  <tr [attr.data-nutriente]="fila.nombre">
                    <td>{{ fila.nombre }}</td>
                    <td class="cantidad">{{ fila.cantidad }}</td>
                    <td class="unidad">{{ fila.unidad }}</td>
                    <td class="vdr" [style.color]="fila.color">{{ fila.porcTxt }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>
      </div>
    }
  `,
})
export class BodySystems {
  readonly totales = input.required<Record<string, number | null>>();
  readonly vdr = input.required<Record<string, number>>();

  readonly categorias = computed<CategoriaSistema[]>(() => {
    const totales = this.totales();
    const vdr = this.vdr();

    return Object.entries(SISTEMAS).map(([categoria, subcategorias]) => ({
      nombre: categoria,
      subcategorias: Object.entries(subcategorias).map(([subcategoria, listaNutrientes]) => ({
        nombre: subcategoria,
        filas: listaNutrientes.map((nutriente) => {
          const cantidad = +(Number(totales[nutriente]) || 0).toFixed(2);
          const nInfo = NUTRIENTES_PLANOS.find((n) => n.nombre === nutriente);
          const unidad = nInfo?.unidad || '';
          const base = vdr[nutriente] || 0;
          const porc = base ? (cantidad / base) * 100 : 0;
          const p = +porc.toFixed(1);
          const porcTxt = p.toFixed(1) + '%';

          let color: string;
          if (p >= 95 && p <= 105) color = COLORES_VDR.verde;
          else if ((p >= 90 && p < 95) || (p > 105 && p <= 110)) color = COLORES_VDR.amarillo;
          else color = COLORES_VDR.rojo;

          return {
            nombre: nutriente,
            cantidad: cantidad !== 0 ? cantidad : '0.00',
            unidad,
            porcTxt,
            color,
          };
        }),
      })),
    }));
  });
}
