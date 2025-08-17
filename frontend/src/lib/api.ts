import axios, { AxiosInstance, AxiosResponse } from "axios";
import Cookies from "js-cookie";
import {
	User,
	AuthResponse,
	Product,
	Compra,
	ApiResponse,
	PaginatedResponse,
} from "@/types";

// URLs base de las APIs (ajustar según deployment)
const API_USUARIOS_BASE = process.env.NEXT_PUBLIC_API_USUARIOS_URL;
const API_PRODUCTOS_BASE = process.env.NEXT_PUBLIC_API_PRODUCTOS_URL;
const API_COMPRAS_BASE = process.env.NEXT_PUBLIC_API_COMPRAS_URL;

// Configurar interceptores para todas las instancias
const createAxiosInstance = (baseURL: string): AxiosInstance => {
	const instance = axios.create({
		baseURL,
		timeout: 30000,
		headers: {
			"Content-Type": "application/json",
		},
	});

	// Interceptor para agregar token automáticamente
	instance.interceptors.request.use((config) => {
		let token = Cookies.get("auth_token");

		// Si no hay token en cookies, intentar localStorage
		if (!token && typeof window !== "undefined") {
			token = localStorage.getItem("auth_token") || undefined;
		}

		if (token && config.headers) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	});

	// Interceptor para manejar errores de autenticación
	instance.interceptors.response.use(
		(response) => response,
		(error) => {
			if (error.response?.status === 401) {
				// Token expirado o inválido - limpiar tanto cookies como localStorage
				Cookies.remove("auth_token");
				Cookies.remove("user_data");
				if (typeof window !== "undefined") {
					localStorage.removeItem("auth_token");
					localStorage.removeItem("user_data");
					window.location.href = "/auth/login";
				}
			}
			return Promise.reject(error);
		}
	);

	return instance;
};

const usuariosApi = createAxiosInstance(API_USUARIOS_BASE || "");
const productosApi = createAxiosInstance(API_PRODUCTOS_BASE || "");
const comprasApi = createAxiosInstance(API_COMPRAS_BASE || "");

// Servicios de autenticación
export const authService = {
	async register(data: {
		email: string;
		password: string;
		nombre: string;
		tenant_id: string;
		role?: "user" | "admin";
	}): Promise<{ usuario: User }> {
		const response: AxiosResponse<{ usuario: User }> =
			await usuariosApi.post("/usuarios/registro", data);
		return response.data;
	},

	async login(data: {
		email: string;
		password: string;
		tenant_id: string;
	}): Promise<AuthResponse> {
		const response: AxiosResponse<AuthResponse> = await usuariosApi.post(
			"/usuarios/login",
			data
		);

		// Guardar token y datos del usuario en cookies Y localStorage
		if (response.data.token) {
			Cookies.set("auth_token", response.data.token, { expires: 1 }); // 1 día
			Cookies.set("user_data", JSON.stringify(response.data.usuario), {
				expires: 1,
			});

			// También guardar en localStorage como backup
			if (typeof window !== "undefined") {
				localStorage.setItem("auth_token", response.data.token);
				localStorage.setItem(
					"user_data",
					JSON.stringify(response.data.usuario)
				);
			}
		}

		return response.data;
	},

	async validateToken(): Promise<{ valido: boolean; usuario: User }> {
		const response: AxiosResponse<{ valido: boolean; usuario: User }> =
			await usuariosApi.get("/usuarios/validar");
		return response.data;
	},

	logout(): void {
		Cookies.remove("auth_token");
		Cookies.remove("user_data");

		// También limpiar localStorage
		if (typeof window !== "undefined") {
			localStorage.removeItem("auth_token");
			localStorage.removeItem("user_data");
		}
	},

	getCurrentUser(): User | null {
		let userData = Cookies.get("user_data");

		// Si no hay en cookies, intentar localStorage
		if (!userData && typeof window !== "undefined") {
			userData = localStorage.getItem("user_data") || undefined;
		}

		return userData ? JSON.parse(userData) : null;
	},

	isAuthenticated(): boolean {
		const cookieToken = Cookies.get("auth_token");
		const localToken =
			typeof window !== "undefined"
				? localStorage.getItem("auth_token")
				: null;

		return !!(cookieToken || localToken);
	},
};

// Servicios de productos
export const productsService = {
	async create(
		product: Omit<Product, "tenant_id" | "created_at" | "created_by">
	): Promise<{ producto: Product }> {
		const response: AxiosResponse<{ producto: Product }> =
			await productosApi.post("/productos", product);
		return response.data;
	},

	async list(params?: {
		limit?: number;
		lastKey?: string;
	}): Promise<PaginatedResponse<Product>> {
		const response: AxiosResponse<{
			productos: Product[];
			lastKey: string | null;
			count: number;
		}> = await productosApi.get("/productos", { params });

		return {
			items: response.data.productos,
			lastKey: response.data.lastKey,
			count: response.data.count,
		};
	},

	async getByCode(codigo: string): Promise<{ producto: Product }> {
		const response: AxiosResponse<{ producto: Product }> =
			await productosApi.get(`/productos/${codigo}`);
		return response.data;
	},

	async update(
		codigo: string,
		updates: Partial<Product>
	): Promise<{ producto: Product }> {
		const response: AxiosResponse<{ producto: Product }> =
			await productosApi.put(`/productos/${codigo}`, updates);
		return response.data;
	},

	async delete(codigo: string): Promise<{ producto: Product }> {
		const response: AxiosResponse<{ producto: Product }> =
			await productosApi.delete(`/productos/${codigo}`);
		return response.data;
	},

	// Búsqueda local (cliente) por nombre o código
	searchProducts(products: Product[], query: string): Product[] {
		const searchTerm = query.toLowerCase().trim();
		if (!searchTerm) return products;

		return products.filter(
			(product) =>
				product.codigo.toLowerCase().includes(searchTerm) ||
				product.nombre.toLowerCase().includes(searchTerm) ||
				product.descripcion.toLowerCase().includes(searchTerm)
		);
	},

	// Listar productos con stock bajo
	async listLowStock(params?: {
		limit?: number;
		lastKey?: string;
	}): Promise<PaginatedResponse<Product>> {
		const response: AxiosResponse<{
			productos: Product[];
			lastKey: string | null;
			count: number;
		}> = await productosApi.get("/productos/stock-bajo", { params });

		return {
			items: response.data.productos,
			lastKey: response.data.lastKey,
			count: response.data.count,
		};
	},
};

// Servicios de compras
export const purchasesService = {
	async create(data: {
		productos: Array<{
			codigo: string;
			cantidad: number;
		}>;
	}): Promise<{ compra: Compra }> {
		const response: AxiosResponse<{ compra: Compra }> =
			await comprasApi.post("/compras", data);
		return response.data;
	},

	async list(params?: {
		limit?: number;
		lastKey?: string;
	}): Promise<PaginatedResponse<Compra>> {
		const response: AxiosResponse<{
			compras: Compra[];
			lastKey: string | null;
			count: number;
		}> = await comprasApi.get("/compras", { params });

		return {
			items: response.data.compras,
			lastKey: response.data.lastKey,
			count: response.data.count,
		};
	},

	async getById(compraId: string): Promise<{ compra: Compra }> {
		const response: AxiosResponse<{ compra: Compra }> =
			await comprasApi.get(`/compras/${compraId}`);
		return response.data;
	},

	// Listar compras pendientes de aprobación (solo admins)
	async listPendingApprovals(params?: {
		limit?: number;
		lastKey?: string;
	}): Promise<PaginatedResponse<Compra>> {
		const response: AxiosResponse<{
			compras: Compra[];
			lastKey: string | null;
			count: number;
		}> = await comprasApi.get("/compras/pendientes-aprobacion", { params });

		return {
			items: response.data.compras,
			lastKey: response.data.lastKey,
			count: response.data.count,
		};
	},

	// Para el dashboard de administrador - aprobar/rechazar pedidos
	async approveOrder(data: {
		execution_arn?: string;
		task_token?: string;
		decision: "approve" | "reject";
		reason?: string;
		approver: string;
	}): Promise<ApiResponse> {
		// Esta URL necesitará ser configurada según el endpoint de step functions
		const stepFunctionsApi = createAxiosInstance(
			process.env.NEXT_PUBLIC_STEP_FUNCTIONS_URL || ""
		);
		const endpoint = data.execution_arn
			? `/approval/${encodeURIComponent(data.execution_arn)}`
			: "/approval";

		const response: AxiosResponse<ApiResponse> =
			await stepFunctionsApi.post(endpoint, data);
		return response.data;
	},

	// Cancelar una compra
	async cancel(compraId: string): Promise<ApiResponse> {
		const response: AxiosResponse<ApiResponse> = await comprasApi.put(
			`/compras/${compraId}/cancel`
		);
		return response.data;
	},
};

// Servicio para gestión de inventario y restock
export const inventoryService = {
	// Aprobar/rechazar decisiones de restock
	async handleRestockDecision(data: {
		execution_arn?: string;
		task_token?: string;
		decision: "approve_restock" | "delay_restock" | "discontinue";
		restock_quantity?: number;
		supervisor: string;
	}): Promise<ApiResponse> {
		const stepFunctionsApi = createAxiosInstance(
			process.env.NEXT_PUBLIC_STEP_FUNCTIONS_URL || ""
		);
		const endpoint = data.execution_arn
			? `/restock/${encodeURIComponent(data.execution_arn)}`
			: "/restock";

		const response: AxiosResponse<ApiResponse> =
			await stepFunctionsApi.post(endpoint, data);
		return response.data;
	},
};

// Servicio para polling de estado de compras
export const pollingService = {
	startPolling(
		compraId: string,
		onUpdate: (compra: Compra) => void,
		intervalMs = 5000
	): () => void {
		const interval = setInterval(async () => {
			try {
				const { compra } = await purchasesService.getById(compraId);
				onUpdate(compra);

				// Detener polling si llegó a un estado final
				if (
					["completado", "rechazado", "error"].includes(compra.estado)
				) {
					clearInterval(interval);
				}
			} catch (error) {
				console.error("Error polling compra:", error);
			}
		}, intervalMs);

		// Retornar función para detener el polling
		return () => clearInterval(interval);
	},
};

const apiService = {
	auth: authService,
	products: productsService,
	purchases: purchasesService,
	inventory: inventoryService,
	polling: pollingService,
};

export default apiService;
