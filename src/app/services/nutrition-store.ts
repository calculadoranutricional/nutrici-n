import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import {
  COMIDAS,
  DISTRIBUCION_VDR_BASE,
  NUTRIENTES_PLANOS,
  VDR_BASE,
} from '../data/nutrients.data';
import {
  Alimento,
  ComidaItem,
  UsuarioPerfil,
} from '../models/nutrition.model';
import {
  calcularTotalesComida,
  convertir,
  soloLetras,
} from '../utils/nutrition.utils';
import { EmojiRain } from './emoji-rain';
import { UiOverlay } from './ui-overlay';

const STORAGE_KEY = 'calculadora_nutricional_state_v1';

export interface EditorUsuarioState {
  abierto: boolean;
  titulo: string;
  nombreInicial: string;
  emojiInicial: string;
  esEditar: boolean;
  editandoKey: string | null;
}

interface PersistedState {
  usuariosMap: Record<string, UsuarioPerfil>;
  ordenUsuarios: string[];
  usuarioActivo: string;
  datosComidas: Record<string, ComidaItem[]>;
  datosOriginales: Record<string, ComidaItem[]>;
}

@Injectable({
  providedIn: 'root',
})
export class NutritionStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly doc = inject(DOCUMENT);
  private readonly ui = inject(UiOverlay);
  private readonly rain = inject(EmojiRain);

  readonly usuariosMap = signal<Record<string, UsuarioPerfil>>({});
  readonly ordenUsuarios = signal<string[]>([]);
  readonly usuarioActivo = signal<string>('Calculadora Nutricional');

  readonly datosComidas = signal<Record<string, ComidaItem[]>>({});
  readonly datosOriginales = signal<Record<string, ComidaItem[]>>({});
  readonly mostrarTodosLosNutrientes = signal<Record<string, boolean>>({});
  readonly datosManuales = signal<Record<string, Record<string, number>>>({});
  readonly datosManualesUnidades = signal<Record<string, Record<string, string>>>({});

  readonly editorUsuario = signal<EditorUsuarioState>({
    abierto: false,
    titulo: 'Nuevo perfil',
    nombreInicial: '',
    emojiInicial: '🙂',
    esEditar: false,
    editandoKey: null,
  });

  readonly usuarioActualObj = computed<UsuarioPerfil | undefined>(() => {
    return this.usuariosMap()[this.usuarioActivo()];
  });

  readonly tituloCalculadora = computed<string>(() => {
    return this.usuarioActualObj()?.nombreVisual || 'Calculadora Nutricional';
  });

  readonly perfilesHumanos = computed<UsuarioPerfil[]>(() => {
    const mapa = this.usuariosMap();
    const todos = Object.keys(mapa).filter((u) => u !== 'Calculadora Nutricional');
    let orden = this.ordenUsuarios().filter((u) => todos.includes(u));
    todos.forEach((u) => {
      if (!orden.includes(u)) orden = [...orden, u];
    });
    return orden.map((k) => mapa[k]).filter((u): u is UsuarioPerfil => !!u);
  });

  readonly comidasConAlimentosCount = computed<number>(() => {
    const userKey = this.usuarioActivo();
    const comidasMap = this.datosComidas();
    return COMIDAS.filter((c) => (comidasMap[`${userKey}-${c}`] || []).length > 0).length;
  });

  readonly totalItemsActivo = computed<ComidaItem[]>(() => {
    const userKey = this.usuarioActivo();
    const comidasMap = this.datosComidas();
    const result: ComidaItem[] = [];
    COMIDAS.forEach((c) => {
      (comidasMap[`${userKey}-${c}`] || []).forEach((item) => result.push(item));
    });
    return result;
  });

  readonly totalesTotalActivo = computed<Record<string, number | null>>(() => {
    return calcularTotalesComida(this.totalItemsActivo(), true);
  });

  constructor() {
    this.inicializarEstado();
  }

  private crearUsuarioObjeto(nombre: string, nombreVisual?: string, fantasma = false): UsuarioPerfil {
    return {
      nombre,
      nombreVisual: nombreVisual ?? nombre,
      fantasma,
      vdr: { ...VDR_BASE },
      distribucionVDR: { ...DISTRIBUCION_VDR_BASE },
    };
  }

  private inicializarEstado(): void {
    const defaultFantasma = this.crearUsuarioObjeto(
      'Calculadora Nutricional',
      'Calculadora Nutricional',
      true,
    );
    const defaultMap: Record<string, UsuarioPerfil> = {
      'Calculadora Nutricional': defaultFantasma,
    };
    const defaultComidas: Record<string, ComidaItem[]> = {};
    const defaultOriginales: Record<string, ComidaItem[]> = {};
    const defaultMostrar: Record<string, boolean> = {};

    COMIDAS.forEach((c) => {
      defaultComidas[`Calculadora Nutricional-${c}`] = [];
      defaultOriginales[`Calculadora Nutricional-${c}`] = [];
      defaultMostrar[`Calculadora Nutricional-${c}`] = false;
    });

    if (isPlatformBrowser(this.platformId)) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as PersistedState;
          if (parsed && parsed.usuariosMap && parsed.usuariosMap['Calculadora Nutricional']) {
            this.usuariosMap.set(parsed.usuariosMap);
            this.ordenUsuarios.set(parsed.ordenUsuarios || []);
            const activo = parsed.usuarioActivo && parsed.usuariosMap[parsed.usuarioActivo]
              ? parsed.usuarioActivo
              : 'Calculadora Nutricional';
            this.usuarioActivo.set(activo);
            this.datosComidas.set(parsed.datosComidas || defaultComidas);
            this.datosOriginales.set(parsed.datosOriginales || defaultOriginales);
            this.mostrarTodosLosNutrientes.set(defaultMostrar);
            this.verificarLluvia();
            return;
          }
        }
      } catch {
        // fallback a valores por defecto
      }
    }

    this.usuariosMap.set(defaultMap);
    this.ordenUsuarios.set([]);
    this.usuarioActivo.set('Calculadora Nutricional');
    this.datosComidas.set(defaultComidas);
    this.datosOriginales.set(defaultOriginales);
    this.mostrarTodosLosNutrientes.set(defaultMostrar);
  }

  private guardarEnStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const payload: PersistedState = {
        usuariosMap: this.usuariosMap(),
        ordenUsuarios: this.ordenUsuarios(),
        usuarioActivo: this.usuarioActivo(),
        datosComidas: this.datosComidas(),
        datosOriginales: this.datosOriginales(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignorar errores de cuota
    }
  }

  obtenerItemsComida(usuario: string, comida: string): ComidaItem[] {
    if (comida === 'total') {
      const result: ComidaItem[] = [];
      const map = this.datosComidas();
      COMIDAS.forEach((c) => {
        (map[`${usuario}-${c}`] || []).forEach((d) => result.push(d));
      });
      return result;
    }
    return this.datosComidas()[`${usuario}-${comida}`] || [];
  }

  calcularComida(usuario: string, comida: string): Record<string, number | null> {
    const items = this.obtenerItemsComida(usuario, comida);
    return calcularTotalesComida(items, comida === 'total');
  }

  agregarAlimento(
    usuario: string,
    comida: string,
    alimento: Alimento,
    peso: number,
  ): { ok: boolean; focusPeso?: boolean } {
    if (!peso || isNaN(peso) || peso <= 0) {
      this.ui.mostrarToast('Peso inválido. Ingresa un valor mayor a 0.');
      return { ok: false, focusPeso: true };
    }

    const totalesActuales = this.calcularComida(usuario, comida);
    for (const [nutriente, valor] of Object.entries(alimento.composicion || {})) {
      const nuevoValor = ((totalesActuales[nutriente] as number) || 0) + valor * (peso / 100);
      if (nuevoValor > 9999999) {
        this.ui.mostrarToast(
          `No se puede agregar "${alimento.nombre}" porque "${nutriente}" superaría el límite de 7 dígitos enteros.`,
          2500,
        );
        return { ok: false };
      }
    }

    const key = `${usuario}-${comida}`;
    this.datosComidas.update((map) => ({
      ...map,
      [key]: [...(map[key] || []), { alimento, peso }],
    }));

    this.guardarEnStorage();
    this.verificarLluvia();
    return { ok: true };
  }

  agregarItemManual(
    usuario: string,
    comida: string,
    nombre: string,
    cantidadIngresada: number,
    unidadIngresada: string,
    cantidadConvertida: number,
  ): boolean {
    const totalesActuales = this.calcularComida(usuario, comida);
    const actualEnBase = (totalesActuales[nombre] as number) || 0;
    if (actualEnBase + cantidadConvertida > 9999999) {
      return false;
    }

    const key = `${usuario}-${comida}`;
    const nuevoItem: ComidaItem = {
      alimento: {
        nombre,
        unidad: unidadIngresada,
        esManual: true,
        displayManual: `${nombre} ${cantidadIngresada} ${unidadIngresada}`,
        composicion: { [nombre]: cantidadConvertida },
      },
      peso: 100,
    };

    this.datosComidas.update((map) => ({
      ...map,
      [key]: [...(map[key] || []), nuevoItem],
    }));

    this.guardarEnStorage();
    this.verificarLluvia();
    return true;
  }

  eliminarItem(usuario: string, comida: string, index: number): void {
    const key = `${usuario}-${comida}`;
    this.datosComidas.update((map) => {
      const actuales = [...(map[key] || [])];
      if (index >= 0 && index < actuales.length) {
        actuales.splice(index, 1);
      }
      return { ...map, [key]: actuales };
    });

    this.guardarEnStorage();
    this.verificarLluvia();
  }

  dividirAlimentos(usuario: string, comida: string, divisorTexto: string): { ok: boolean } {
    const key = `${usuario}-${comida}`;
    const items = this.datosComidas()[key] || [];
    if (items.length === 0) return { ok: true };

    const divisor = parseFloat(divisorTexto);
    if (isNaN(divisor) || divisor <= 0) {
      this.ui.mostrarToast('Ingresa un número válido mayor a 0 para dividir.');
      return { ok: false };
    }

    const actualesOrig = this.datosOriginales()[key];
    if (!actualesOrig || actualesOrig.length === 0) {
      this.datosOriginales.update((orig) => ({
        ...orig,
        [key]: items.map((item) => ({
          alimento: {
            ...item.alimento,
            composicion: item.alimento?.composicion
              ? { ...item.alimento.composicion }
              : {},
          },
          peso: item.peso,
        })),
      }));
    }

    const divididos = items.map((item) => {
      const nuevo: ComidaItem = { ...item };
      if (item.alimento?.esManual) {
        const nuevaCompo: Record<string, number> = {};
        for (const [nutriente, valor] of Object.entries(item.alimento.composicion)) {
          nuevaCompo[nutriente] = Math.round((valor / divisor) * 100) / 100;
        }
        nuevo.alimento = { ...item.alimento, composicion: nuevaCompo };

        const clave = Object.keys(nuevaCompo)[0];
        const valorBase = nuevaCompo[clave];
        const unidadBase =
          NUTRIENTES_PLANOS.find((n) => n.nombre === clave)?.unidad ||
          item.alimento.unidad ||
          'g';
        const unidadDestino = item.alimento.unidad || unidadBase;
        const valorConvertido = convertir(valorBase, unidadBase, unidadDestino);
        nuevo.alimento.displayManual = `${clave} ${Math.round(valorConvertido * 100) / 100} ${unidadDestino}`;
      } else {
        nuevo.peso = Math.round((item.peso / divisor) * 100) / 100;
      }
      return nuevo;
    });

    this.datosComidas.update((map) => ({ ...map, [key]: divididos }));
    this.guardarEnStorage();
    return { ok: true };
  }

  revertirDivision(usuario: string, comida: string): void {
    const key = `${usuario}-${comida}`;
    const originales = this.datosOriginales()[key];
    if (!originales || originales.length === 0) return;

    const items = this.datosComidas()[key] || [];
    const revertidos = items.map((item) => {
      const original = originales.find((o) => o.alimento?.nombre === item.alimento?.nombre);
      if (original) {
        return {
          alimento: {
            ...original.alimento,
            composicion: original.alimento.composicion
              ? { ...original.alimento.composicion }
              : {},
            displayManual: original.alimento.displayManual || item.alimento.displayManual,
          },
          peso: original.peso,
        };
      }
      return item;
    });

    this.datosComidas.update((map) => ({ ...map, [key]: revertidos }));
    this.datosOriginales.update((orig) => ({ ...orig, [key]: [] }));
    this.guardarEnStorage();
  }

  toggleMostrarTodosNutrientes(key: string): void {
    this.mostrarTodosLosNutrientes.update((map) => ({
      ...map,
      [key]: !map[key],
    }));
  }

  setDatoManual(key: string, nutriente: string, valor: number): void {
    this.datosManuales.update((map) => ({
      ...map,
      [key]: { ...(map[key] || {}), [nutriente]: valor },
    }));
  }

  setUnidadManual(key: string, nutriente: string, unidad: string): void {
    this.datosManualesUnidades.update((map) => ({
      ...map,
      [key]: { ...(map[key] || {}), [nutriente]: unidad },
    }));
  }

  limpiarManual(key: string): void {
    this.datosManuales.update((map) => {
      const current = { ...(map[key] || {}) };
      Object.keys(current).forEach((k) => (current[k] = 0));
      return { ...map, [key]: current };
    });
    this.datosManualesUnidades.update((map) => ({
      ...map,
      [key]: {},
    }));
  }

  // Perfiles
  seleccionarUsuario(clave: string): void {
    if (!this.usuariosMap()[clave]) return;
    this.usuarioActivo.set(clave);
    this.cerrarEditorUsuario();
    this.ui.closePanel('panel1');
    this.guardarEnStorage();
    this.verificarLluvia();
  }

  abrirMenuNuevoUsuario(): void {
    this.editorUsuario.set({
      abierto: true,
      titulo: 'Nuevo perfil',
      nombreInicial: '',
      emojiInicial: '🙂',
      esEditar: false,
      editandoKey: null,
    });
  }

  abrirEditorPerfilActivo(): void {
    const activo = this.usuarioActivo();
    const usuario = this.usuariosMap()[activo];
    if (!usuario) return;
    this.editorUsuario.set({
      abierto: true,
      titulo: 'Editar perfil',
      nombreInicial: usuario.nombreVisual,
      emojiInicial: usuario.emoji || '🙂',
      esEditar: true,
      editandoKey: activo,
    });
  }

  cerrarEditorUsuario(): void {
    this.editorUsuario.update((s) => ({ ...s, abierto: false }));
  }

  actualizarOrdenUsuarios(nuevoOrden: string[]): void {
    this.ordenUsuarios.set(nuevoOrden);
    this.guardarEnStorage();
  }

  guardarPerfil(datos: {
    nombreInput: string;
    emoji: string;
    fechaNacimiento: string;
    edad: number | null;
    peso: number | null;
    altura: number | null;
  }): void {
    const editKey = this.editorUsuario().editandoKey;

    if (editKey && this.usuariosMap()[editKey]) {
      this.usuariosMap.update((map) => ({
        ...map,
        [editKey]: {
          ...map[editKey],
          nombreVisual: datos.nombreInput,
          emoji: datos.emoji,
          fechaNacimiento: datos.fechaNacimiento,
          edad: datos.edad,
          peso: datos.peso,
          altura: datos.altura,
        },
      }));
      this.usuarioActivo.set(editKey);
    } else {
      const claveBase = datos.nombreInput;
      let clave = claveBase;
      let contador = 1;
      const actualMap = this.usuariosMap();
      while (actualMap[clave]) {
        clave = `${claveBase}_${contador++}`;
      }

      const nuevo = this.crearUsuarioObjeto(clave, datos.nombreInput, false);
      nuevo.emoji = datos.emoji;
      nuevo.fechaNacimiento = datos.fechaNacimiento;
      nuevo.edad = datos.edad;
      nuevo.peso = datos.peso;
      nuevo.altura = datos.altura;

      this.usuariosMap.update((map) => ({ ...map, [clave]: nuevo }));
      this.ordenUsuarios.update((ord) => [...ord, clave]);

      // Inicializar comidas vacías para el nuevo usuario y limpiar Calculadora Nutricional
      this.datosComidas.update((comMap) => {
        const next = { ...comMap };
        COMIDAS.forEach((c) => {
          next[`${clave}-${c}`] = [];
          if (next[`Calculadora Nutricional-${c}`]) {
            next[`Calculadora Nutricional-${c}`] = [];
          }
        });
        return next;
      });
      this.usuarioActivo.set(clave);
    }

    this.cerrarEditorUsuario();
    this.ui.closePanel('panel1');
    this.guardarEnStorage();
    this.verificarLluvia();
    this.ui.mostrarToast('Perfil guardado correctamente');
    this.enfocarPrimerPeso();
  }

  eliminarUsuario(nombreOpcional?: string): void {
    const editKey = this.editorUsuario().editandoKey;
    const usuarioAEliminar = nombreOpcional || editKey || this.usuarioActivo();
    if (!usuarioAEliminar || usuarioAEliminar === 'Calculadora Nutricional') return;

    const u = this.usuariosMap()[usuarioAEliminar];
    if (!u) return;

    this.ui.mostrarConfirmacion(
      `¿Eliminar usuario ${u.nombreVisual}?`,
      () => {
        this.datosComidas.update((comMap) => {
          const next = { ...comMap };
          COMIDAS.forEach((c) => {
            delete next[`${usuarioAEliminar}-${c}`];
          });
          return next;
        });

        this.usuariosMap.update((map) => {
          const next = { ...map };
          delete next[usuarioAEliminar];
          return next;
        });

        this.ordenUsuarios.update((ord) => ord.filter((x) => x !== usuarioAEliminar));

        const restantes = Object.keys(this.usuariosMap()).filter(
          (k) => k !== 'Calculadora Nutricional',
        );
        const siguiente = restantes[0] || 'Calculadora Nutricional';
        this.usuarioActivo.set(siguiente);

        this.cerrarEditorUsuario();
        if (!nombreOpcional) {
          this.ui.closePanel('panel1');
        }
        this.guardarEnStorage();
        this.verificarLluvia();
        this.ui.mostrarToast('Usuario eliminado correctamente');
        this.enfocarPrimerPeso();
      },
      () => {
        this.ui.mostrarToast('Operación cancelada');
      },
      {
        textoAceptar: 'Eliminar',
        colorTexto: 'red',
      },
    );
  }

  actualizarVDRUsuario(nuevoVdr: Record<string, number>): void {
    const activo = this.usuarioActivo();
    if (!this.usuariosMap()[activo]) return;
    this.usuariosMap.update((map) => ({
      ...map,
      [activo]: {
        ...map[activo],
        vdr: { ...map[activo].vdr, ...nuevoVdr },
      },
    }));
    this.guardarEnStorage();
  }

  actualizarDistribucionUsuario(nuevaDist: Record<string, number>): void {
    const activo = this.usuarioActivo();
    if (!this.usuariosMap()[activo]) return;
    this.usuariosMap.update((map) => ({
      ...map,
      [activo]: {
        ...map[activo],
        distribucionVDR: { ...nuevaDist },
        distribucionTemp: undefined,
      },
    }));
    this.guardarEnStorage();
  }

  setDistribucionTemp(comida: string, valor: number): void {
    const activo = this.usuarioActivo();
    const u = this.usuariosMap()[activo];
    if (!u) return;
    const base = u.distribucionTemp ? { ...u.distribucionTemp } : { ...u.distribucionVDR };
    base[comida] = valor;
    this.usuariosMap.update((map) => ({
      ...map,
      [activo]: { ...map[activo], distribucionTemp: base },
    }));
  }

  descartarDistribucionTemp(): void {
    const activo = this.usuarioActivo();
    const u = this.usuariosMap()[activo];
    if (!u || !u.distribucionTemp) return;
    this.usuariosMap.update((map) => ({
      ...map,
      [activo]: { ...map[activo], distribucionTemp: undefined },
    }));
  }

  enfocarPrimerPeso(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => {
      const activo = this.usuarioActivo();
      const comidaVisible = COMIDAS[0];
      const pesoDiv = this.doc.getElementById(`peso-${activo}-${comidaVisible}`);
      if (pesoDiv) pesoDiv.focus();
    }, 1001);
  }

  verificarLluvia(): void {
    const activo = this.usuarioActivo();
    const u = this.usuariosMap()[activo];
    if (!u) {
      this.rain.detenerLluvia();
      return;
    }
    const comMap = this.datosComidas();
    const activar = COMIDAS.every((c) => (comMap[`${activo}-${c}`]?.length ?? 0) >= 1);
    this.rain.verificarLluvia(activar);
  }

  compartirResultados(usuario: string, comida: string): string {
    const totales = this.calcularComida(usuario, comida);
    const uObj = this.usuariosMap()[usuario];
    const nombreUsuario = soloLetras(uObj?.nombreVisual || usuario);

    const titulo =
      comida === 'total'
        ? `📊 Resultados Totales de ${nombreUsuario}`
        : `🍽️ ${comida} de ${nombreUsuario}`;

    let texto = `${titulo}\n\n`;

    NUTRIENTES_PLANOS.forEach((n) => {
      const val = +(Number(totales[n.nombre]) || 0).toFixed(2);
      if (val === 0) return;

      const base = uObj?.vdr[n.nombre] || 0;
      let porcTxt = '-';
      let icono = '';

      if (n.nombre !== 'pH (alimento)' && n.nombre !== 'pH estimado en estómago') {
        if (base) {
          const porc = +((val / base) * 100).toFixed(1);
          porcTxt = porc + '%';

          if (comida === 'total') {
            icono =
              porc >= 95 && porc <= 105
                ? '✔️'
                : (porc >= 90 && porc < 95) || (porc > 105 && porc <= 110)
                  ? '❗'
                  : '❌';
          } else {
            const obj = uObj?.distribucionVDR[comida] || 25;
            const m = obj * 0.05;
            icono =
              porc >= obj - m && porc <= obj + m
                ? '✔️'
                : (porc >= obj - 2 * m && porc < obj - m) ||
                    (porc > obj + m && porc <= obj + 2 * m)
                  ? '❗'
                  : '❌';
          }
        }
      }

      texto += `${icono} ${n.nombre}: ${val} ${n.unidad} (${porcTxt})\n`;
    });

    if (isPlatformBrowser(this.platformId) && navigator.clipboard) {
      navigator.clipboard.writeText(texto).catch((err) => {
        console.error('Error copiando al portapapeles:', err);
      });
    }

    const mensajeToast =
      comida === 'total'
        ? `Total de ${nombreUsuario} copiado correctamente.`
        : `${comida.charAt(0).toUpperCase() + comida.slice(1)} de ${nombreUsuario} copiado correctamente.`;

    this.ui.mostrarToast(mensajeToast);
    return texto;
  }

  compartirAlimentos(usuarioOrigen: string, comida: string): void {
    const otrosUsuarios = this.perfilesHumanos()
      .map((u) => u.nombre)
      .filter((u) => u !== usuarioOrigen && u !== 'Calculadora Nutricional');

    if (otrosUsuarios.length === 0) {
      this.ui.mostrarToast('No hay otros usuarios para compartir');
      return;
    }

    const mapa = this.usuariosMap();
    const opciones = otrosUsuarios
      .map((u) => {
        const nombreOriginal = mapa[u]?.nombreVisual || u;
        const nombreSoloLetras = soloLetras(nombreOriginal);
        return `
          <label class="compartir-opcion">
            <input type="checkbox" class="compartir-check" value="${u}" checked>
            <span style="color: black; font-weight: bold;">${nombreSoloLetras}</span>
          </label>
        `;
      })
      .join('');

    this.ui.mostrarConfirmacion(
      `<p>Compartir alimentos con:</p>${opciones}`,
      () => {
        if (!isPlatformBrowser(this.platformId)) return;
        const seleccionados = Array.from(
          this.doc.querySelectorAll<HTMLInputElement>('.compartir-check:checked'),
        ).map((chk) => chk.value);

        if (seleccionados.length === 0) {
          this.ui.mostrarToast('No seleccionaste ningún usuario');
          return;
        }

        const items = this.datosComidas()[`${usuarioOrigen}-${comida}`] || [];
        if (items.length === 0) {
          this.ui.mostrarToast('No hay alimentos para compartir');
          return;
        }

        const exitos: string[] = [];
        const bloqueados: { usuario: string; motivos: string[] }[] = [];

        for (const destUser of seleccionados) {
          const totalesDestino = this.calcularComida(destUser, comida) || {};
          let falla = false;
          const motivos = new Set<string>();

          for (const i of items) {
            const peso = i.peso || 0;
            const compos = i.alimento?.composicion || {};
            for (const [nutriente, valorPor100] of Object.entries(compos)) {
              const incremento = valorPor100 * (peso / 100);
              const actual = (totalesDestino[nutriente] as number) || 0;
              if (actual + incremento > 9999999) {
                falla = true;
                motivos.add(nutriente);
              }
            }
          }

          if (falla) {
            bloqueados.push({ usuario: destUser, motivos: Array.from(motivos) });
          } else {
            const keyDestino = `${destUser}-${comida}`;
            this.datosComidas.update((map) => ({
              ...map,
              [keyDestino]: [
                ...(map[keyDestino] || []),
                ...items.map((i) => ({ alimento: i.alimento, peso: i.peso })),
              ],
            }));
            exitos.push(destUser);
          }
        }

        this.guardarEnStorage();

        if (exitos.length > 0) {
          const nombresExitos = exitos.map((u) => soloLetras(mapa[u]?.nombreVisual || u));
          this.ui.mostrarToast(
            `
            <div style="width: 50vw; max-width: none; line-height: 1.2; text-align: center; font-family: inherit;">
              <span style="display:block; font-weight:600;">Alimentos compartidos con:</span>
              <div style="text-align:left; margin-top:10px;">
                ${nombresExitos
                  .map(
                    (n) => `
                  <div style="display:flex; align-items:center; margin-bottom:2px;">
                    <span style="line-height:0;">●</span>
                    <span style="margin-left:2px;">${n}</span>
                  </div>
                `,
                  )
                  .join('')}
              </div>
            </div>
          `,
            2000,
          );
        }

        if (bloqueados.length > 0) {
          const nombresBloqueados = bloqueados
            .map((b) => {
              const nombre = soloLetras(mapa[b.usuario]?.nombreVisual || b.usuario);
              return `
                <div style="display:flex; align-items:center; margin-bottom:2px;">
                  <span style="line-height:0;">●</span>
                  <span style="margin-left:2px; color:black; font-weight:bold;">${nombre}</span>
                </div>
              `;
            })
            .join('');

          this.ui.mostrarToast(
            `
            <div style="width: 50vw; max-width: none; line-height: 1.2; text-align: center; font-family: inherit;">
              <span style="display:block; font-weight:600; margin-bottom:6px;">
                No se pudo compartir alimentos con:
              </span>
              <div style="text-align:left; margin-top:10px;">
                ${nombresBloqueados}
              </div>
              <div style="margin-top:10px;">
                Porque uno o más nutrientes superarían el límite de 10 millones.
              </div>
            </div>
          `,
            3000,
          );
        }
      },
      () => {
        this.ui.mostrarToast('Operación cancelada');
      },
      { textoAceptar: 'Aceptar' },
    );
  }
}
