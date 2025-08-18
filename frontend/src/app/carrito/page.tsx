"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/MainLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { CartItem, Product } from "@/types";
import { productsService, purchasesService } from "@/lib/api";
import toast from "react-hot-toast";

export default function CarritoPage() {
	const { user, isLoading } = useAuth();
	const router = useRouter();
	const [cartItems, setCartItems] = useState<CartItem[]>([]);
	const [productos, setProductos] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [purchasing, setPurchasing] = useState(false);

	useEffect(() => {
		const loadData = async () => {
			try {
				const { items: allProducts } = await productsService.list();
				setProductos(allProducts);

				const savedCart = localStorage.getItem(
					`cart_${user?.tenant_id}_${user?.user_id}`
				);
				if (savedCart) {
					const cart: CartItem[] = JSON.parse(savedCart);
					setCartItems(cart);
				}
			} catch (error) {
				console.error("Error loading data:", error);
				toast.error("Error al cargar datos");
			} finally {
				setLoading(false);
			}
		};

		if (user) {
			loadData();
		} else {
			setLoading(false);
		}
	}, [user]);

	useEffect(() => {
		if (!user && !isLoading) {
			router.push("/auth/login");
		}
	}, [user, isLoading, router]);

	const saveCart = (newCart: CartItem[]) => {
		if (user) {
			localStorage.setItem(
				`cart_${user.tenant_id}_${user.user_id}`,
				JSON.stringify(newCart)
			);
		}
		setCartItems(newCart);
	};

	const updateQuantity = (codigo: string, newQuantity: number) => {
		if (newQuantity <= 0) {
			removeItem(codigo);
			return;
		}

		const newCart = cartItems.map((item) =>
			item.codigo === codigo ? { ...item, cantidad: newQuantity } : item
		);
		saveCart(newCart);
	};

	const removeItem = (codigo: string) => {
		const newCart = cartItems.filter((item) => item.codigo !== codigo);
		saveCart(newCart);
		toast.success("Producto eliminado del carrito");
	};

	const clearCart = () => {
		saveCart([]);
		toast.success("Carrito limpiado");
	};

	const calculateTotal = () => {
		return cartItems.reduce((total, item) => {
			const producto = productos.find((p) => p.codigo === item.codigo);
			return total + (producto?.precio || 0) * item.cantidad;
		}, 0);
	};

	const processPurchase = async () => {
		if (cartItems.length === 0) {
			toast.error("El carrito está vacío");
			return;
		}

		setPurchasing(true);
		try {
			const compraData = {
				productos: cartItems,
				total: calculateTotal(),
			};

			await purchasesService.create(compraData);

			saveCart([]);

			toast.success("¡Compra realizada! Procesando pedido...");
			router.push("/dashboard");
		} catch (error) {
			console.error("Error processing purchase:", error);
			toast.error("Error al procesar la compra");
		} finally {
			setPurchasing(false);
		}
	};

	if (isLoading) {
		return (
			<MainLayout>
				<div className="max-w-4xl mx-auto px-4 py-8">
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

	if (!user) {
		return null;
	}

	if (loading) {
		return (
			<MainLayout>
				<div className="max-w-4xl mx-auto px-4 py-8">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
						<p className="mt-4 text-gray-600">
							Cargando carrito...
						</p>
					</div>
				</div>
			</MainLayout>
		);
	}

	return (
		<MainLayout>
			<div className="max-w-4xl mx-auto px-4 py-8">
				<div className="flex justify-between items-center mb-8">
					<h1 className="text-3xl font-bold text-gray-900">
						🛒 Mi Carrito
					</h1>
				</div>

				{cartItems.length === 0 ? (
					<Card>
						<div className="text-center py-12">
							<div className="text-6xl mb-4">🛒</div>
							<h3 className="text-xl font-semibold text-gray-900 mb-2">
								Tu carrito está vacío
							</h3>
							<p className="text-gray-600 mb-6">
								¡Explora nuestros productos y añade algunos al
								carrito!
							</p>
							<Button onClick={() => router.push("/productos")}>
								Ver Productos
							</Button>
						</div>
					</Card>
				) : (
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
						{/* Items del Carrito */}
						<div className="lg:col-span-2">
							<Card>
								<div className="flex justify-between items-center mb-6">
									<h2 className="text-xl font-semibold">
										Productos ({cartItems.length})
									</h2>
									<Button
										variant="danger"
										size="sm"
										onClick={clearCart}
									>
										🗑️ Limpiar Carrito
									</Button>
								</div>

								<div className="space-y-4">
									{cartItems.map((item) => {
										const producto = productos.find(
											(p) => p.codigo === item.codigo
										);
										if (!producto) return null;

										return (
											<div
												key={item.codigo}
												className="flex items-center justify-between p-4 border rounded-lg"
											>
												<div className="flex-1">
													<h3 className="font-semibold text-gray-900">
														{producto.nombre}
													</h3>
													<p className="text-sm text-gray-600">
														{producto.descripcion}
													</p>
													<p className="text-lg font-bold text-blue-600">
														$
														{producto.precio.toFixed(
															2
														)}
													</p>
												</div>

												<div className="flex items-center space-x-3">
													<Button
														size="sm"
														variant="secondary"
														onClick={() =>
															updateQuantity(
																item.codigo,
																item.cantidad -
																	1
															)
														}
													>
														➖
													</Button>

													<span className="text-lg font-semibold w-12 text-center">
														{item.cantidad}
													</span>

													<Button
														size="sm"
														variant="secondary"
														onClick={() =>
															updateQuantity(
																item.codigo,
																item.cantidad +
																	1
															)
														}
													>
														➕
													</Button>

													<Button
														size="sm"
														variant="danger"
														onClick={() =>
															removeItem(
																item.codigo
															)
														}
													>
														🗑️
													</Button>
												</div>

												<div className="ml-4 text-right">
													<p className="text-lg font-bold">
														$
														{(
															producto.precio *
															item.cantidad
														).toFixed(2)}
													</p>
												</div>
											</div>
										);
									})}
								</div>
							</Card>
						</div>

						{/* Resumen de Compra */}
						<div className="lg:col-span-1">
							<Card>
								<h2 className="text-xl font-semibold mb-6">
									Resumen de Compra
								</h2>

								<div className="space-y-3 mb-6">
									<div className="flex justify-between">
										<span>Subtotal:</span>
										<span>
											${calculateTotal().toFixed(2)}
										</span>
									</div>
									<div className="flex justify-between">
										<span>Envío:</span>
										<span>Gratis</span>
									</div>
									<hr />
									<div className="flex justify-between text-xl font-bold">
										<span>Total:</span>
										<span className="text-blue-600">
											${calculateTotal().toFixed(2)}
										</span>
									</div>
								</div>

								<Button
									className="w-full"
									onClick={processPurchase}
									disabled={
										purchasing || cartItems.length === 0
									}
								>
									{purchasing ? (
										<>
											<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
											Procesando...
										</>
									) : (
										"Realizar Compra"
									)}
								</Button>

								<p className="text-xs text-gray-500 mt-4 text-center">
									Al hacer clic en &quot;Realizar
									Compra&quot;, aceptas nuestros términos y
									condiciones.
								</p>
							</Card>
						</div>
					</div>
				)}
			</div>
		</MainLayout>
	);
}
