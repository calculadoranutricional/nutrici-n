export interface NutrienteInfo {
  nombre: string;
  unidad: string;
  descripcion: string;
}

export interface NutrientePlano extends NutrienteInfo {
  niveles: string[];
}

export type NodoNutrientes = NutrienteInfo[] | Record<string, unknown>;

export interface Alimento {
  nombre: string;
  categoria?: string;
  unidad?: string;
  esManual?: boolean;
  displayManual?: string;
  composicion: Record<string, number>;
}

export interface ComidaItem {
  alimento: Alimento;
  peso: number;
}

export interface UsuarioPerfil {
  nombre: string;
  nombreVisual: string;
  fantasma?: boolean;
  emoji?: string;
  fechaNacimiento?: string;
  edad?: number | null;
  peso?: number | null;
  altura?: number | null;
  vdr: Record<string, number>;
  distribucionVDR: Record<string, number>;
  distribucionTemp?: Record<string, number>;
}

export type PanelId = 'panel' | 'panel1' | 'panel2' | 'panel3';

export interface ConfirmOpcionesBoton {
  textoAceptar?: string;
  colorAceptar?: string;
  colorTexto?: string;
}

export interface ConfirmacionState {
  visible: boolean;
  mostrar: boolean;
  mensaje: string;
  textoAceptar: string;
  colorAceptar: string;
  colorTexto: string;
  onAceptar?: () => void;
  onCancelar?: () => void;
}
