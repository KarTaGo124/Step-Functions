"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/MainLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CartModal } from "@/components/CartModal";
import { useRouter } from "next/navigation";
import { Product, Compra } from "@/types";
import { productsService, purchasesService } from "@/lib/api";
import toast from "react-hot-toast";

export default function DashboardPage() {
	const { user, isLoading } = useAuth();
	const router = useRouter();
	const [products, setProducts] = useState<Product[]>([]);
	const [recentPurchases, setRecentPurchases] = useState<Compra[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [cartModalOpen, setCartModalOpen] = useState(false);

	// Estados de paginación
	const [productsLastKey, setProductsLastKey] = useState<string | null>(null);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [hasMoreProducts, setHasMoreProducts] = useState(true);

	// Cargar datos iniciales
	const loadData = async (append: boolean = false) => {
		try {
			if (!append) {
				setLoading(true);
			} else {
				setIsLoadingMore(true);
			}

			const [productsResponse, purchasesResponse] = await Promise.all([
				productsService.list({
					limit: 20,
					lastKey: append ? productsLastKey || undefined : undefined,
				}),
				append
					? Promise.resolve({ items: recentPurchases })
					: purchasesService.list({ limit: 3 }),
			]);

			if (append) {
				setProducts((prev) => [...prev, ...productsResponse.items]);
			} else {
				setProducts(productsResponse.items);
				setRecentPurchases(purchasesResponse.items);
			}

			setProductsLastKey(productsResponse.lastKey || null);
			setHasMoreProducts(!!productsResponse.lastKey);
		} catch (error) {
			console.error("Error loading data:", error);
			toast.error("Error al cargar datos");
		} finally {
			setLoading(false);
			setIsLoadingMore(false);
		}
	};

	useEffect(() => {
		const initializeData = async () => {
			if (!user) {
				setLoading(false);
				return;
			}

			try {
				setLoading(true);
				const [productsResponse, purchasesResponse] = await Promise.all(
					[
						productsService.list({ limit: 20 }),
						purchasesService.list({ limit: 3 }),
					]
				);

				setProducts(productsResponse.items);
				setRecentPurchases(purchasesResponse.items);
				setProductsLastKey(productsResponse.lastKey || null);
				setHasMoreProducts(!!productsResponse.lastKey);
			} catch (error) {
				console.error("Error loading initial data:", error);
				toast.error("Error al cargar datos");
			} finally {
				setLoading(false);
			}
		};

		initializeData();
	}, [user]);

	const loadMoreProducts = async () => {
		if (!hasMoreProducts || isLoadingMore) return;
		await loadData(true);
	};

	// Agregar al carrito
	const addToCart = (product: Product) => {
		if (!user) return;

		const cartKey = `cart_${user.tenant_id}_${user.user_id}`;
		const existingCart = localStorage.getItem(cartKey);
		const cart = existingCart ? JSON.parse(existingCart) : [];

		const existingItem = cart.find(
			(item: { codigo: string }) => item.codigo === product.codigo
		);

		if (existingItem) {
			existingItem.cantidad += 1;
		} else {
			cart.push({
				codigo: product.codigo,
				nombre: product.nombre,
				precio: product.precio,
				cantidad: 1,
				stock: product.stock,
			});
		}

		localStorage.setItem(cartKey, JSON.stringify(cart));
		toast.success(`${product.nombre} agregado al carrito`);

		// Disparar evento para actualizar contador del carrito
		window.dispatchEvent(new Event("cartUpdated"));
	};

	// Filtrar productos solo por nombre
	const filteredProducts = products.filter((product) =>
		product.nombre.toLowerCase().includes(searchTerm.toLowerCase())
	);

	// Manejar redirección de autenticación
	useEffect(() => {
		if (!user && !isLoading) {
			router.push("/auth/login");
		}
	}, [user, isLoading, router]);

	// Mostrar loading si está cargando autenticación
	if (isLoading) {
		return (
			<MainLayout onCartClick={() => setCartModalOpen(true)}>
				<div className="max-w-6xl mx-auto px-4 py-8">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
						<p className="mt-4 text-gray-600">
							Verificando autenticación...
						</p>
					</div>
				</div>
			</MainLayout>
		);
	}

	// Si no hay usuario después de cargar, redirigir
	if (!user) {
		return null; // El useEffect se encargará de la redirección
	}

	// Mostrar loading si está cargando datos
	if (loading) {
		return (
			<MainLayout
				onCartClick={() => setCartModalOpen(true)}
				onHistoryClick={() => router.push("/compras")}
			>
				<div className="max-w-7xl mx-auto px-4 py-8">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
						<p className="mt-4 text-gray-600">
							Cargando productos...
						</p>
					</div>
				</div>
			</MainLayout>
		);
	}

	return (
		<>
			<MainLayout
				onCartClick={() => setCartModalOpen(true)}
				onHistoryClick={() => router.push("/compras")}
			>
				<div className="max-w-7xl mx-auto px-4 py-6">
					{/* Header de bienvenida */}
					<div className="mb-8">
						<h1 className="text-2xl font-bold text-gray-900 mb-2">
							Hola, {user.nombre} 👋
						</h1>
						<p className="text-gray-600">
							Descubre nuestros productos destacados
						</p>
					</div>

					{/* Barra de búsqueda */}
					<div className="mb-8 bg-white p-4 rounded-lg shadow-sm">
						<input
							type="text"
							placeholder="Buscar productos por nombre..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>

					{/* Compras recientes - Solo si hay */}
					{recentPurchases.length > 0 && (
						<div className="mb-8">
							<div className="flex justify-between items-center mb-4">
								<h2 className="text-xl font-semibold text-gray-900">
									📦 Tus pedidos recientes
								</h2>
								<Button
									variant="secondary"
									size="sm"
									onClick={() => router.push("/compras")}
								>
									Ver todos
								</Button>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								{recentPurchases.slice(0, 3).map((compra) => (
									<Card
										key={compra.compra_id}
										className="p-4"
									>
										<div className="flex justify-between items-start mb-2">
											<span className="text-sm text-gray-600">
												Pedido #
												{compra.compra_id.substring(
													0,
													8
												)}
											</span>
											<span
												className={`text-xs px-2 py-1 rounded-full ${
													compra.estado ===
													"completado"
														? "bg-green-100 text-green-800"
														: "bg-yellow-100 text-yellow-800"
												}`}
											>
												{compra.estado}
											</span>
										</div>
										<p className="text-sm text-gray-700 mb-2">
											{compra.productos.length} productos
										</p>
										<p className="font-semibold text-blue-600">
											${compra.total.toFixed(2)}
										</p>
									</Card>
								))}
							</div>
						</div>
					)}

					{/* Grid de productos */}
					<div>
						<div className="flex justify-between items-center mb-6">
							<h2 className="text-xl font-semibold text-gray-900">
								🛍️ Productos para ti
							</h2>
							<span className="text-sm text-gray-600">
								{filteredProducts.length} productos encontrados
							</span>
						</div>

						{filteredProducts.length === 0 ? (
							<div className="text-center py-12">
								<div className="text-6xl mb-4">🔍</div>
								<h3 className="text-xl font-semibold text-gray-900 mb-2">
									No se encontraron productos
								</h3>
								<p className="text-gray-600">
									Intenta cambiar los filtros o el término de
									búsqueda
								</p>
							</div>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
								{filteredProducts.map((product) => (
									<Card
										key={product.codigo}
										className="group hover:shadow-lg transition-shadow"
									>
										<div className="p-4">
											{/* Imagen placeholder */}
											<div className="w-full h-48 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
												<span className="text-4xl">
													📦
												</span>
											</div>

											{/* Información del producto */}
											<h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
												{product.nombre}
											</h3>
											<p className="text-sm text-gray-600 mb-3 line-clamp-2">
												{product.descripcion}
											</p>

											{/* Precio y stock */}
											<div className="flex justify-between items-center mb-3">
												<span className="text-xl font-bold text-blue-600">
													${product.precio.toFixed(2)}
												</span>
												<span className="text-sm text-gray-500">
													Stock: {product.stock}
												</span>
											</div>

											{/* Categoría */}
											<span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded mb-3">
												{product.categoria}
											</span>

											{/* Botón de agregar al carrito */}
											<Button
												onClick={() =>
													addToCart(product)
												}
												disabled={product.stock === 0}
												className="w-full"
												size="sm"
											>
												{product.stock === 0
													? "Sin Stock"
													: "🛒 Agregar al Carrito"}
											</Button>
										</div>
									</Card>
								))}
							</div>
						)}

						{/* Botón para cargar más productos */}
						{hasMoreProducts && filteredProducts.length > 0 && (
							<div className="text-center mt-8">
								<Button
									onClick={loadMoreProducts}
									disabled={isLoadingMore}
									variant="secondary"
									size="lg"
								>
									{isLoadingMore
										? "Cargando..."
										: "Cargar más productos"}
								</Button>
							</div>
						)}
					</div>
				</div>
			</MainLayout>

			{/* Modal del carrito - FUERA del MainLayout para evitar problemas de z-index */}
			<CartModal
				isOpen={cartModalOpen}
				onClose={() => setCartModalOpen(false)}
				onPurchaseComplete={async () => {
					// Recargar datos desde el inicio
					setProductsLastKey(null);
					setHasMoreProducts(true);
					await loadData(false);
				}}
			/>
		</>
	);
}
