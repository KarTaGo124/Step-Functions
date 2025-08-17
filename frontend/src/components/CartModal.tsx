"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { CartItem, Product } from "@/types";
import { productsService, purchasesService } from "@/lib/api";
import toast from "react-hot-toast";

interface CartModalProps {
	isOpen: boolean;
	onClose: () => void;
	onPurchaseComplete: () => void;
}

export function CartModal({
	isOpen,
	onClose,
	onPurchaseComplete,
}: CartModalProps) {
	const { user } = useAuth();
	const [cartItems, setCartItems] = useState<CartItem[]>([]);
	const [productos, setProductos] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [purchasing, setPurchasing] = useState(false);

	// Cargar productos y carrito del localStorage
	useEffect(() => {
		const loadData = async () => {
			try {
				const { items: allProducts } = await productsService.list();
				setProductos(allProducts);

				if (user) {
					const savedCart = localStorage.getItem(
						`cart_${user.tenant_id}_${user.user_id}`
					);
					if (savedCart) {
						const cart: CartItem[] = JSON.parse(savedCart);
						setCartItems(cart);
					}
				}
			} catch (error) {
				console.error("Error loading data:", error);
				toast.error("Error al cargar datos");
			} finally {
				setLoading(false);
			}
		};

		if (isOpen && user) {
			loadData();
		}
	}, [isOpen, user]);

	// Guardar carrito en localStorage
	const saveCart = (newCart: CartItem[]) => {
		if (user) {
			localStorage.setItem(
				`cart_${user.tenant_id}_${user.user_id}`,
				JSON.stringify(newCart)
			);
		}
		setCartItems(newCart);
		// Actualizar el contador del carrito en el navbar
		window.dispatchEvent(new Event("cartUpdated"));
	};

	// Actualizar cantidad
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

	// Eliminar item
	const removeItem = (codigo: string) => {
		const newCart = cartItems.filter((item) => item.codigo !== codigo);
		saveCart(newCart);
		toast.success("Producto eliminado del carrito");
	};

	// Limpiar carrito
	const clearCart = () => {
		saveCart([]);
		toast.success("Carrito limpiado");
	};

	// Calcular total
	const calculateTotal = () => {
		return cartItems.reduce((total, item) => {
			const producto = productos.find((p) => p.codigo === item.codigo);
			return total + (producto?.precio || 0) * item.cantidad;
		}, 0);
	};

	// Procesar compra
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

			// Limpiar carrito
			saveCart([]);

			toast.success("¡Compra realizada! Procesando pedido...");
			onClose();
			onPurchaseComplete();
		} catch (error) {
			console.error("Error processing purchase:", error);
			toast.error("Error al procesar la compra");
		} finally {
			setPurchasing(false);
		}
	};

	if (!isOpen) {
		return null;
	}

	return (
		<div
			className="fixed inset-0 overflow-y-auto"
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				zIndex: 99999,
				pointerEvents: "auto",
			}}
		>
			<div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
				{/* Background overlay */}
				<div
					className="fixed inset-0 bg-black bg-opacity-50 transition-opacity cursor-pointer"
					style={{
						position: "fixed",
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundColor: "rgba(0, 0, 0, 0.5)",
						zIndex: 99998,
						pointerEvents: "auto",
					}}
					onClick={onClose}
				></div>

				{/* Modal panel */}
				<div
					className="inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all my-8 align-middle max-w-2xl w-full mx-4"
					style={{
						position: "relative",
						zIndex: 99999,
						pointerEvents: "auto",
						maxHeight: "90vh",
						overflowY: "auto",
					}}
					onClick={(e) => e.stopPropagation()}
				>
					{/* Header */}
					<div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-medium text-gray-900">
								🛒 Mi Carrito ({cartItems.length} productos)
							</h3>
							<button
								onClick={onClose}
								className="text-gray-400 hover:text-gray-600 text-2xl p-1 hover:bg-gray-100 rounded"
								style={{ pointerEvents: "auto" }}
							>
								✕
							</button>
						</div>

						{loading ? (
							<div className="text-center py-8">
								<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
								<p className="mt-2 text-gray-600">
									Cargando...
								</p>
							</div>
						) : cartItems.length === 0 ? (
							<div className="text-center py-8">
								<div className="text-4xl mb-4">🛒</div>
								<p className="text-gray-600">
									Tu carrito está vacío
								</p>
							</div>
						) : (
							<>
								{/* Items del carrito */}
								<div className="max-h-96 overflow-y-auto space-y-3">
									{cartItems.map((item) => {
										const producto = productos.find(
											(p) => p.codigo === item.codigo
										);
										if (!producto) return null;

										return (
											<div
												key={item.codigo}
												className="flex items-center justify-between p-3 border rounded-lg"
											>
												<div className="flex-1">
													<h4 className="font-medium text-gray-900">
														{producto.nombre}
													</h4>
													<p className="text-sm text-gray-600">
														$
														{producto.precio.toFixed(
															2
														)}
													</p>
												</div>

												<div className="flex items-center space-x-2">
													<button
														onClick={() =>
															updateQuantity(
																item.codigo,
																item.cantidad -
																	1
															)
														}
														className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded"
													>
														➖
													</button>

													<span className="text-sm font-medium w-8 text-center">
														{item.cantidad}
													</span>

													<button
														onClick={() =>
															updateQuantity(
																item.codigo,
																item.cantidad +
																	1
															)
														}
														className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded"
													>
														➕
													</button>

													<button
														onClick={() =>
															removeItem(
																item.codigo
															)
														}
														className="w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded"
													>
														🗑️
													</button>
												</div>

												<div className="ml-3 text-right">
													<p className="font-bold">
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

								{/* Resumen */}
								<div className="border-t pt-4 mt-4">
									<div className="flex justify-between items-center text-lg font-bold">
										<span>Total:</span>
										<span className="text-blue-600">
											${calculateTotal().toFixed(2)}
										</span>
									</div>
								</div>
							</>
						)}
					</div>

					{/* Footer */}
					{cartItems.length > 0 && (
						<div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse space-y-2 sm:space-y-0 sm:space-x-reverse sm:space-x-3">
							<Button
								onClick={processPurchase}
								disabled={purchasing}
								className="w-full sm:w-auto"
							>
								{purchasing ? (
									<>
										<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
										Procesando...
									</>
								) : (
									"Comprar Ahora"
								)}
							</Button>
							<Button
								variant="secondary"
								onClick={clearCart}
								className="w-full sm:w-auto"
							>
								Limpiar Carrito
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
