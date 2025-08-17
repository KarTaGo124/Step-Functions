"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/MainLayout";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/hooks/useCart";
import { productsService } from "@/lib/api";
import { Product } from "@/types";
import { SearchIcon, PlusIcon } from "@/components/ui/Icons";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function ProductosPage() {
	const { user, isLoading } = useAuth();
	const { addToCart } = useCart();
	const router = useRouter();
	const [query, setQuery] = useState("");
	const [productos, setProductos] = useState<Product[]>([]);
	const [filteredProductos, setFilteredProductos] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [lastKey, setLastKey] = useState<string | null>(null);
	const [loadingMore, setLoadingMore] = useState(false);

	const loadProducts = useCallback(
		async (append = false) => {
			const loader = append ? setLoadingMore : setLoading;
			loader(true);

			try {
				const { items, lastKey: newLastKey } =
					await productsService.list({
						limit: 12,
						lastKey: append ? lastKey || undefined : undefined,
					});

				if (append) {
					setProductos((prev) => [...prev, ...items]);
				} else {
					setProductos(items);
				}

				setLastKey(newLastKey || null);
			} catch (error) {
				console.error("Error loading products:", error);
				toast.error("Error al cargar productos");
			} finally {
				loader(false);
			}
		},
		[lastKey]
	);

	useEffect(() => {
		if (!user && !isLoading) {
			router.push("/auth/login");
			return;
		}
		if (user) {
			loadProducts();
		}
	}, [user, isLoading, router, loadProducts]);

	useEffect(() => {
		// Filtrar productos localmente
		if (query.trim()) {
			const filtered = productsService.searchProducts(productos, query);
			setFilteredProductos(filtered);
		} else {
			setFilteredProductos(productos);
		}
	}, [query, productos]);

	const handleAddToCart = (product: Product) => {
		if (product.stock <= 0) {
			toast.error("Producto sin stock");
			return;
		}

		addToCart({
			codigo: product.codigo,
			nombre: product.nombre,
			precio: product.precio,
			stock: product.stock,
			cantidad: 1,
		});

		toast.success(`${product.nombre} agregado al carrito`);
	};

	// Mostrar loading si está cargando autenticación
	if (isLoading) {
		return (
			<MainLayout>
				<div className="max-w-7xl mx-auto px-4 py-8">
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
		return null;
	}

	return (
		<MainLayout>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-gray-900 mb-4">
						Catálogo de Productos
					</h1>

					<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
						<div className="relative max-w-md w-full">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<SearchIcon className="h-5 w-5 text-gray-400" />
							</div>
							<Input
								type="text"
								placeholder="Buscar por código, nombre o descripción..."
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								className="pl-10"
							/>
						</div>

						<div className="flex gap-2">
							<Button
								variant="secondary"
								onClick={() => router.push("/carrito")}
							>
								Ver Carrito
							</Button>
							<Button onClick={() => router.push("/compras")}>
								Mis Compras
							</Button>
						</div>
					</div>
				</div>

				{loading ? (
					<div className="text-center py-12">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
						<p className="mt-4 text-gray-600">
							Cargando productos...
						</p>
					</div>
				) : (
					<>
						<div className="mb-6 flex justify-between items-center">
							<p className="text-gray-600">
								{filteredProductos.length} producto(s)
								disponible(s)
								{query && ` - Filtrado por "${query}"`}
							</p>

							{query && (
								<Button
									variant="secondary"
									size="sm"
									onClick={() => setQuery("")}
								>
									Limpiar filtro
								</Button>
							)}
						</div>

						{filteredProductos.length === 0 ? (
							<Card>
								<div className="text-center py-12">
									<SearchIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
									<h3 className="text-lg font-medium text-gray-900 mb-2">
										No se encontraron productos
									</h3>
									<p className="text-gray-500">
										{query
											? "Intenta con otros términos de búsqueda"
											: "No hay productos disponibles en este momento"}
									</p>
								</div>
							</Card>
						) : (
							<>
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
									{filteredProductos.map((product) => (
										<Card
											key={product.codigo}
											padding={false}
											className="hover:shadow-lg transition-shadow"
										>
											<div className="p-6">
												<div className="mb-4">
													<h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
														{product.nombre}
													</h3>
													<p className="text-sm text-gray-600 mb-2 line-clamp-3">
														{product.descripcion}
													</p>
													<div className="flex flex-wrap gap-2 text-xs text-gray-500">
														<span>
															#{product.codigo}
														</span>
														{product.categoria && (
															<span className="bg-gray-100 px-2 py-1 rounded">
																{
																	product.categoria
																}
															</span>
														)}
													</div>
												</div>

												<div className="flex items-center justify-between mb-4">
													<div>
														<p className="text-2xl font-bold text-blue-600">
															$
															{product.precio.toFixed(
																2
															)}
														</p>
														<p
															className={`text-sm ${
																product.stock >
																10
																	? "text-green-600"
																	: product.stock >
																	  0
																	? "text-yellow-600"
																	: "text-red-600"
															}`}
														>
															{product.stock > 0
																? `${
																		product.stock
																  } disponible${
																		product.stock !==
																		1
																			? "s"
																			: ""
																  }`
																: "Sin stock"}
														</p>
													</div>
												</div>

												<Button
													onClick={() =>
														handleAddToCart(product)
													}
													disabled={
														product.stock <= 0
													}
													className="w-full"
													variant={
														product.stock <= 0
															? "secondary"
															: "primary"
													}
												>
													<PlusIcon
														size={16}
														className="mr-2"
													/>
													{product.stock <= 0
														? "Sin Stock"
														: "Agregar al Carrito"}
												</Button>
											</div>
										</Card>
									))}
								</div>

								{/* Cargar más productos */}
								{!query && lastKey && (
									<div className="text-center mt-8">
										<Button
											onClick={() => loadProducts(true)}
											loading={loadingMore}
											disabled={loadingMore}
											variant="secondary"
										>
											{loadingMore
												? "Cargando..."
												: "Cargar más productos"}
										</Button>
									</div>
								)}
							</>
						)}
					</>
				)}
			</div>
		</MainLayout>
	);
}
