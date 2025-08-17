export interface User {
	user_id: string;
	tenant_id: string;
	email: string;
	nombre: string;
	role: "user" | "admin";
	created_at: string;
	is_active: boolean;
}

export interface AuthResponse {
	mensaje: string;
	token: string;
	usuario: User;
	expires_in: number;
}

export interface Product {
	tenant_id: string;
	codigo: string;
	nombre: string;
	descripcion: string;
	precio: number;
	categoria: string;
	stock: number;
	created_at: string;
	created_by?: string;
	updated_at?: string;
	updated_by?: string;
	stock_alert?: {
		status: EstadoStock;
		threshold: number;
		last_alert: string;
		restock_quantity?: number;
		approver?: string;
		timestamp: string;
		task_token?: string;
		alert_sent_at?: string;
		severity?: string;
		current_stock?: number;
	};
}

export interface CartItem {
	codigo: string;
	nombre: string;
	precio: number;
	cantidad: number;
	stock: number;
}

export interface CompraProducto {
	codigo: string;
	nombre: string;
	precio_unitario: number;
	cantidad: number;
	subtotal: number;
}

export interface Compra {
	compra_id: string;
	tenant_id: string;
	user_id: string;
	productos: CompraProducto[];
	total: number;
	estado: EstadoCompra;
	created_at: string;
	updated_at: string;
	step_function_execution?: string | null;
	approval_info?: {
		task_token?: string;
		approver?: string;
		decision?: "approve" | "reject";
		reason?: string;
		timestamp?: string;
	};
}

export interface ApiResponse<T = unknown> {
	mensaje?: string;
	error?: string;
	data?: T;
	[key: string]: unknown;
}

export interface PaginatedResponse<T> {
	items: T[];
	lastKey?: string | null;
	count: number;
}

// Enums para estados de workflow
export enum EstadoCompra {
	PENDIENTE = "pendiente",
	VALIDANDO = "validando",
	ESPERANDO_APROBACION = "esperando_aprobacion",
	PROCESANDO = "procesando",
	PROCESANDO_PAGO = "procesando_pago",
	PAGO_COMPLETADO = "pago_completado",
	FACTURADO = "facturado",
	COMPLETADO = "completado",
	RECHAZADO = "rechazado",
	ERROR = "error",
	ERROR_PAGO = "error_pago",
	ERROR_FACTURACION = "error_facturacion",
	INVENTARIO_ACTUALIZADO = "inventario_actualizado",
	ERROR_INVENTARIO = "error_inventario",
	ERROR_APROBACION = "error_aprobacion",
	COMPLETADO_SIN_NOTIFICACION = "completado_sin_notificacion",
}

// Enums para estados de inventario/stock (workflow 2)
export enum EstadoStock {
	PENDING_RESTOCK = "pending_restock",
	ALERT_FAILED = "alert_failed",
	RESOLVED = "resolved",
	RESTOCK_FAILED = "restock_failed",
	RESTOCK_APPROVED = "restock_approved",
	RESTOCK_DELAYED = "restock_delayed",
	PRODUCT_DISCONTINUED = "product_discontinued",
}

// Mapeo de estados a textos en español
export const EstadoTexto: Record<EstadoCompra, string> = {
	[EstadoCompra.PENDIENTE]: "Pendiente",
	[EstadoCompra.VALIDANDO]: "Validando",
	[EstadoCompra.ESPERANDO_APROBACION]: "Esperando Aprobación",
	[EstadoCompra.PROCESANDO]: "Procesando",
	[EstadoCompra.PROCESANDO_PAGO]: "Procesando Pago",
	[EstadoCompra.PAGO_COMPLETADO]: "Pago Completado",
	[EstadoCompra.FACTURADO]: "Facturado",
	[EstadoCompra.COMPLETADO]: "Completado",
	[EstadoCompra.RECHAZADO]: "Rechazado",
	[EstadoCompra.ERROR]: "Error",
	[EstadoCompra.ERROR_PAGO]: "Error en Pago",
	[EstadoCompra.ERROR_FACTURACION]: "Error en Facturación",
	[EstadoCompra.INVENTARIO_ACTUALIZADO]: "Inventario Actualizado",
	[EstadoCompra.ERROR_INVENTARIO]: "Error en Inventario",
	[EstadoCompra.ERROR_APROBACION]: "Error en Aprobación",
	[EstadoCompra.COMPLETADO_SIN_NOTIFICACION]: "Completado sin Notificación",
};

// Mapeo de estados a colores
export const EstadoColor: Record<EstadoCompra, string> = {
	[EstadoCompra.PENDIENTE]: "bg-gray-100 text-gray-800",
	[EstadoCompra.VALIDANDO]: "bg-blue-100 text-blue-800",
	[EstadoCompra.ESPERANDO_APROBACION]: "bg-yellow-100 text-yellow-800",
	[EstadoCompra.PROCESANDO]: "bg-purple-100 text-purple-800",
	[EstadoCompra.PROCESANDO_PAGO]: "bg-blue-100 text-blue-800",
	[EstadoCompra.PAGO_COMPLETADO]: "bg-green-100 text-green-800",
	[EstadoCompra.FACTURADO]: "bg-green-100 text-green-800",
	[EstadoCompra.COMPLETADO]: "bg-green-100 text-green-800",
	[EstadoCompra.RECHAZADO]: "bg-red-100 text-red-800",
	[EstadoCompra.ERROR]: "bg-red-100 text-red-800",
	[EstadoCompra.ERROR_PAGO]: "bg-red-100 text-red-800",
	[EstadoCompra.ERROR_FACTURACION]: "bg-red-100 text-red-800",
	[EstadoCompra.INVENTARIO_ACTUALIZADO]: "bg-green-100 text-green-800",
	[EstadoCompra.ERROR_INVENTARIO]: "bg-red-100 text-red-800",
	[EstadoCompra.ERROR_APROBACION]: "bg-red-100 text-red-800",
	[EstadoCompra.COMPLETADO_SIN_NOTIFICACION]: "bg-yellow-100 text-yellow-800",
};

// Mapeo de estados de stock a textos en español
export const EstadoStockTexto: Record<EstadoStock, string> = {
	[EstadoStock.PENDING_RESTOCK]: "Pendiente Reabastecimiento",
	[EstadoStock.ALERT_FAILED]: "Error en Alerta",
	[EstadoStock.RESOLVED]: "Resuelto",
	[EstadoStock.RESTOCK_FAILED]: "Error en Reabastecimiento",
	[EstadoStock.RESTOCK_APPROVED]: "Reabastecimiento Aprobado",
	[EstadoStock.RESTOCK_DELAYED]: "Reabastecimiento Pospuesto",
	[EstadoStock.PRODUCT_DISCONTINUED]: "Producto Discontinuado",
};

// Mapeo de estados de stock a colores
export const EstadoStockColor: Record<EstadoStock, string> = {
	[EstadoStock.PENDING_RESTOCK]: "bg-orange-100 text-orange-800",
	[EstadoStock.ALERT_FAILED]: "bg-red-100 text-red-800",
	[EstadoStock.RESOLVED]: "bg-green-100 text-green-800",
	[EstadoStock.RESTOCK_FAILED]: "bg-red-100 text-red-800",
	[EstadoStock.RESTOCK_APPROVED]: "bg-blue-100 text-blue-800",
	[EstadoStock.RESTOCK_DELAYED]: "bg-yellow-100 text-yellow-800",
	[EstadoStock.PRODUCT_DISCONTINUED]: "bg-gray-100 text-gray-800",
};
