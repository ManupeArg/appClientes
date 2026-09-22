export type TipoPrecio = "minorista" | "mayorista";

export interface Perfil {
  id: string;
  nombre: string;
  email: string;
  rol: "admin" | "vendedor";
  activo: boolean;
}

export interface Cliente {
  id: string;
  nombre: string;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  localidad: string | null;
  tipo_precio: TipoPrecio;
  notas: string | null;
  activo: boolean;
  creado_en: string;
}

export interface Producto {
  id: string;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  unidad: string;
  precio_minorista: number;
  precio_mayorista: number;
  costo: number | null;
  stock: number;
  stock_minimo: number;
  alerta_stock: boolean;
  activo: boolean;
}

export interface Remito {
  id: string;
  numero: number;
  cliente_id: string;
  fecha: string;
  tipo_precio: TipoPrecio;
  subtotal: number;
  descuento: number;
  total: number;
  estado: "emitido" | "anulado";
  observaciones: string | null;
  creado_en: string;
}

export interface RemitoItem {
  id: string;
  remito_id: string;
  producto_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface Pago {
  id: string;
  cliente_id: string;
  fecha: string;
  monto: number;
  medio: string;
  referencia: string | null;
  observaciones: string | null;
  anulado: boolean;
  creado_en: string;
}

export interface MovimientoCC {
  id: string;
  cliente_id: string;
  fecha: string;
  tipo: string;
  descripcion: string;
  debe: number;
  haber: number;
  remito_id: string | null;
  pago_id: string | null;
  creado_en: string;
}
