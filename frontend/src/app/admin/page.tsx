"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import {
	Product,
	Compra,
	EstadoTexto,
	EstadoColor,
	EstadoStockTexto,
	EstadoStockColor,
} from "@/types";
import { Badge } from "@/components/ui/Badge";
import { productsService, purchasesService, inventoryService } from "@/lib/api";

export default function AdminPage() {
	const { user, isLoading } = useAuth();
	const router = useRouter();
	const [activeTab, setActiveTab] = useState("productos");
	const [products, setProducts] = useState<Product[]>([]);
	const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
	const [pendingCompras, setPendingCompras] = useState<Compra[]>([]);
	const [searchTerm, setSearchTerm] = useState("");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingProduct, setEditingProduct] = useState<Product | null>(null);

	const [productsLastKey, setProductsLastKey] = useState<string | null>(null);
	const [lowStockLastKey, setLowStockLastKey] = useState<string | null>(null);
	const [pendingComprasLastKey, setPendingComprasLastKey] = useState<
		string | null
	>(null);
	const [isLoadingMore, setIsLoadingMore] = useState(false);

	const loadData = async (append: boolean = false) => {
		try {
			const [productsData, lowStockData, pendingComprasData] =
				await Promise.all([
					productsService.list({
						limit: 20,
						lastKey: append
							? productsLastKey || undefined
							: undefined,
					}),
					productsService.listLowStock({
						limit: 20,
						lastKey: append
							? lowStockLastKey || undefined
							: undefined,
					}),
					purchasesService.listPendingApprovals({
						limit: 20,
						lastKey: append
							? pendingComprasLastKey || undefined
							: undefined,
					}),
				]);

			if (append) {
				setProducts((prev) => [...prev, ...productsData.items]);
				setLowStockProducts((prev) => [...prev, ...lowStockData.items]);
				setPendingCompras((prev) => [
					...prev,
					...pendingComprasData.items,
				]);
			} else {
				setProducts(productsData.items);
				setLowStockProducts(lowStockData.items);
				setPendingCompras(pendingComprasData.items);
			}

			setProductsLastKey(productsData.lastKey || null);
			setLowStockLastKey(lowStockData.lastKey || null);
			setPendingComprasLastKey(pendingComprasData.lastKey || null);
		} catch (error) {
			console.error("Error loading admin data:", error);
		}
	};

	useEffect(() => {
		const initializeAdminData = async () => {
			if (!isLoading && (!user || user.role !== "admin")) {
				router.push("/auth/login");
				return;
			}

			if (!user) return;

			try {
				const [productsData, lowStockData, pendingComprasData] =
					await Promise.all([
						productsService.list({ limit: 20 }),
						productsService.listLowStock({ limit: 20 }),
						purchasesService.listPendingApprovals({ limit: 20 }),
					]);

				setProducts(productsData.items);
				setLowStockProducts(lowStockData.items);
				setPendingCompras(pendingComprasData.items);

				setProductsLastKey(productsData.lastKey || null);
				setLowStockLastKey(lowStockData.lastKey || null);
				setPendingComprasLastKey(pendingComprasData.lastKey || null);
			} catch (error) {
				console.error("Error loading admin data:", error);
			}
		};

		initializeAdminData();
	}, [user, isLoading, router]);

	const loadMoreData = async () => {
		setIsLoadingMore(true);
		await loadData(true);
		setIsLoadingMore(false);
	};

	const filteredProducts = products.filter(
		(product) =>
			product.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
			product.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
			product.categoria.toLowerCase().includes(searchTerm.toLowerCase())
	);

	const handleCreateProduct = () => {
		setEditingProduct(null);
		setIsModalOpen(true);
	};

	const handleEditProduct = (product: Product) => {
		setEditingProduct(product);
		setIsModalOpen(true);
	};

	const handleDeleteProduct = async (codigo: string) => {
		if (confirm("¿Estás seguro de que quieres eliminar este producto?")) {
			try {
				await productsService.delete(codigo);
				await loadData();
			} catch (error) {
				console.error("Error deleting product:", error);
			}
		}
	};

	const handleApproveCompra = async (compraId: string) => {
		try {
			const compra = pendingCompras.find((c) => c.compra_id === compraId);
			if (compra?.approval_info?.task_token) {
				await purchasesService.approveOrder({
					task_token: compra.approval_info.task_token,
					decision: "approve",
					approver: user?.nombre || "admin",
				});
				await loadData();
			}
		} catch (error) {
			console.error("Error approving compra:", error);
		}
	};

	const handleRejectCompra = async (compraId: string) => {
		const reason = prompt("Motivo del rechazo:");
		if (reason) {
			try {
				const compra = pendingCompras.find(
					(c) => c.compra_id === compraId
				);
				if (compra?.approval_info?.task_token) {
					await purchasesService.approveOrder({
						task_token: compra.approval_info.task_token,
						decision: "reject",
						reason: reason,
						approver: user?.nombre || "admin",
					});
					await loadData();
				}
			} catch (error) {
				console.error("Error rejecting compra:", error);
			}
		}
	};

	const handleRestockDecision = async (
		productCode: string,
		decision: "approve_restock" | "delay_restock" | "discontinue"
	) => {
		try {
			const product = lowStockProducts.find(
				(p) => p.codigo === productCode
			);
			if (product?.stock_alert?.task_token) {
				let restock_quantity;

				if (decision === "approve_restock") {
					const quantity = prompt("¿Cantidad a reabastecer?", "100");
					if (!quantity || isNaN(Number(quantity))) {
						alert("Cantidad inválida");
						return;
					}
					restock_quantity = Number(quantity);
				}

				await inventoryService.handleRestockDecision({
					task_token: product.stock_alert.task_token,
					decision: decision,
					restock_quantity: restock_quantity,
					supervisor: user?.nombre || "admin",
				});
				await loadData();
				alert(`Decisión de restock ${decision} procesada exitosamente`);
			}
		} catch (error) {
			console.error("Error handling restock decision:", error);
			alert("Error procesando decisión de restock");
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-gray-600">Cargando...</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<div className="bg-white shadow-sm border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center py-4">
						<h1 className="text-2xl font-bold text-gray-900">
							Panel de Administración
						</h1>
						<div className="flex items-center space-x-4">
							<span className="text-sm text-gray-600">
								Bienvenido, {user?.nombre}
							</span>
							<button
								onClick={() => router.push("/dashboard")}
								className="text-sm text-blue-600 hover:text-blue-800"
							>
								Volver al Dashboard
							</button>
						</div>
					</div>
				</div>
			</div>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="flex">
					{/* Sidebar Tabs */}
					<div className="w-64 mr-8">
						<nav className="space-y-2">
							<button
								onClick={() => setActiveTab("productos")}
								className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
									activeTab === "productos"
										? "bg-blue-100 text-blue-700 border border-blue-200"
										: "text-gray-700 hover:bg-gray-100"
								}`}
							>
								📦 Productos
							</button>
							<button
								onClick={() => setActiveTab("stock")}
								className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
									activeTab === "stock"
										? "bg-blue-100 text-blue-700 border border-blue-200"
										: "text-gray-700 hover:bg-gray-100"
								}`}
							>
								⚠️ Stock Bajo
							</button>
							<button
								onClick={() => setActiveTab("compras")}
								className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
									activeTab === "compras"
										? "bg-blue-100 text-blue-700 border border-blue-200"
										: "text-gray-700 hover:bg-gray-100"
								}`}
							>
								🛒 Compras por Aprobar
								{pendingCompras.length > 0 && (
									<span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
										{pendingCompras.length}
									</span>
								)}
							</button>
						</nav>
					</div>

					{/* Main Content */}
					<div className="flex-1">
						{/* Productos Tab */}
						{activeTab === "productos" && (
							<div className="bg-white rounded-lg shadow">
								<div className="p-6 border-b">
									<div className="flex justify-between items-center mb-4">
										<h2 className="text-xl font-semibold">
											Gestión de Productos
										</h2>
										<button
											onClick={handleCreateProduct}
											className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
										>
											+ Nuevo Producto
										</button>
									</div>
									<div className="relative">
										<input
											type="text"
											placeholder="Buscar productos..."
											value={searchTerm}
											onChange={(e) =>
												setSearchTerm(e.target.value)
											}
											className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
										/>
										<div className="absolute inset-y-0 left-0 pl-3 flex items-center">
											<svg
												className="h-5 w-5 text-gray-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
												/>
											</svg>
										</div>
									</div>
								</div>

								<div className="overflow-x-auto">
									<table className="w-full">
										<thead className="bg-gray-50">
											<tr>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
													Código
												</th>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
													Nombre
												</th>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
													Categoría
												</th>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
													Precio
												</th>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
													Stock
												</th>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
													Acciones
												</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-gray-200">
											{filteredProducts.map((product) => (
												<tr
													key={product.codigo}
													className="hover:bg-gray-50"
												>
													<td className="px-6 py-4 text-sm font-medium text-gray-900">
														{product.codigo}
													</td>
													<td className="px-6 py-4 text-sm text-gray-900">
														{product.nombre}
													</td>
													<td className="px-6 py-4 text-sm text-gray-600">
														{product.categoria}
													</td>
													<td className="px-6 py-4 text-sm text-gray-900">
														${product.precio}
													</td>
													<td className="px-6 py-4 text-sm">
														<span
															className={`px-2 py-1 rounded-full text-xs ${
																product.stock <
																10
																	? "bg-red-100 text-red-800"
																	: "bg-green-100 text-green-800"
															}`}
														>
															{product.stock}
														</span>
													</td>
													<td className="px-6 py-4 text-sm space-x-2">
														<button
															onClick={() =>
																handleEditProduct(
																	product
																)
															}
															className="text-blue-600 hover:text-blue-800"
														>
															Editar
														</button>
														<button
															onClick={() =>
																handleDeleteProduct(
																	product.codigo
																)
															}
															className="text-red-600 hover:text-red-800"
														>
															Eliminar
														</button>
													</td>
												</tr>
											))}
										</tbody>
									</table>
									{filteredProducts.length === 0 && (
										<div className="text-center py-8 text-gray-500">
											No se encontraron productos
										</div>
									)}
								</div>

								{/* Load More Button for Products */}
								{productsLastKey && (
									<div className="p-4 border-t text-center">
										<button
											onClick={loadMoreData}
											disabled={isLoadingMore}
											className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
										>
											{isLoadingMore
												? "Cargando..."
												: "Cargar más productos"}
										</button>
									</div>
								)}
							</div>
						)}

						{/* Stock Tab */}
						{activeTab === "stock" && (
							<div className="bg-white rounded-lg shadow">
								<div className="p-6 border-b">
									<h2 className="text-xl font-semibold">
										Productos con Stock Bajo
									</h2>
									<p className="text-gray-600 mt-1">
										Productos que requieren atención de
										inventario
									</p>
								</div>

								<div className="overflow-x-auto">
									<table className="w-full">
										<thead className="bg-gray-50">
											<tr>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
													Producto
												</th>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
													Stock Actual
												</th>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
													Estado de Alerta
												</th>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
													Última Alerta
												</th>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
													Acciones
												</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-gray-200">
											{lowStockProducts.map((product) => (
												<tr
													key={product.codigo}
													className="hover:bg-gray-50"
												>
													<td className="px-6 py-4">
														<div>
															<div className="text-sm font-medium text-gray-900">
																{product.nombre}
															</div>
															<div className="text-sm text-gray-500">
																{product.codigo}
															</div>
														</div>
													</td>
													<td className="px-6 py-4 text-sm">
														<span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
															{product.stock}
														</span>
													</td>
													<td className="px-6 py-4">
														{product.stock_alert && (
															<Badge
																className={
																	EstadoStockColor[
																		product
																			.stock_alert
																			.status
																	]
																}
															>
																{
																	EstadoStockTexto[
																		product
																			.stock_alert
																			.status
																	]
																}
															</Badge>
														)}
													</td>
													<td className="px-6 py-4 text-sm text-gray-600">
														{product.stock_alert
															?.last_alert &&
															new Date(
																product.stock_alert.last_alert
															).toLocaleDateString()}
													</td>
													<td className="px-6 py-4 text-sm">
														{product.stock_alert
															?.task_token ? (
															<div className="space-x-2">
																<button
																	onClick={() =>
																		handleRestockDecision(
																			product.codigo,
																			"approve_restock"
																		)
																	}
																	className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
																>
																	✓ Aprobar
																	Restock
																</button>
																<button
																	onClick={() =>
																		handleRestockDecision(
																			product.codigo,
																			"delay_restock"
																		)
																	}
																	className="bg-yellow-600 text-white px-3 py-1 rounded text-xs hover:bg-yellow-700"
																>
																	⏸ Retrasar
																</button>
																<button
																	onClick={() =>
																		handleRestockDecision(
																			product.codigo,
																			"discontinue"
																		)
																	}
																	className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
																>
																	✗
																	Descontinuar
																</button>
															</div>
														) : (
															<span className="text-gray-400">
																Sin decisión
																pendiente
															</span>
														)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
									{lowStockProducts.length === 0 && (
										<div className="text-center py-8 text-gray-500">
											No hay productos con alertas de
											stock bajo
										</div>
									)}
								</div>

								{/* Load More Button for Low Stock Products */}
								{lowStockLastKey && (
									<div className="p-4 border-t text-center">
										<button
											onClick={loadMoreData}
											disabled={isLoadingMore}
											className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
										>
											{isLoadingMore
												? "Cargando..."
												: "Cargar más productos con stock bajo"}
										</button>
									</div>
								)}
							</div>
						)}

						{/* Compras Tab */}
						{activeTab === "compras" && (
							<div className="bg-white rounded-lg shadow">
								<div className="p-6 border-b">
									<h2 className="text-xl font-semibold">
										Compras Pendientes de Aprobación
									</h2>
									<p className="text-gray-600 mt-1">
										Compras superiores a $500 que requieren
										tu aprobación
									</p>
								</div>

								<div className="space-y-4 p-6">
									{pendingCompras.map((compra) => (
										<div
											key={compra.compra_id}
											className="border border-gray-200 rounded-lg p-4"
										>
											<div className="flex justify-between items-start mb-4">
												<div>
													<h3 className="font-medium text-gray-900">
														Compra #
														{compra.compra_id}
													</h3>
													<p className="text-sm text-gray-600">
														Usuario:{" "}
														{compra.user_id} •
														Total: ${compra.total}
													</p>
													<p className="text-sm text-gray-500">
														{new Date(
															compra.created_at
														).toLocaleString()}
													</p>
												</div>
												<Badge
													className={
														EstadoColor[
															compra.estado
														]
													}
												>
													{EstadoTexto[compra.estado]}
												</Badge>
											</div>

											<div className="mb-4">
												<h4 className="text-sm font-medium text-gray-700 mb-2">
													Productos:
												</h4>
												<div className="space-y-1">
													{compra.productos.map(
														(producto, index) => (
															<div
																key={index}
																className="text-sm text-gray-600 flex justify-between"
															>
																<span>
																	{
																		producto.nombre
																	}{" "}
																	x
																	{
																		producto.cantidad
																	}
																</span>
																<span>
																	$
																	{
																		producto.subtotal
																	}
																</span>
															</div>
														)
													)}
												</div>
											</div>

											<div className="flex space-x-3">
												<button
													onClick={() =>
														handleApproveCompra(
															compra.compra_id
														)
													}
													className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors"
												>
													✓ Aprobar
												</button>
												<button
													onClick={() =>
														handleRejectCompra(
															compra.compra_id
														)
													}
													className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors"
												>
													✗ Rechazar
												</button>
											</div>
										</div>
									))}
									{pendingCompras.length === 0 && (
										<div className="text-center py-8 text-gray-500">
											No hay compras pendientes de
											aprobación
										</div>
									)}
								</div>

								{/* Load More Button for Pending Compras */}
								{pendingComprasLastKey && (
									<div className="p-4 border-t text-center">
										<button
											onClick={loadMoreData}
											disabled={isLoadingMore}
											className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
										>
											{isLoadingMore
												? "Cargando..."
												: "Cargar más compras pendientes"}
										</button>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Product Modal */}
			{isModalOpen && (
				<ProductModal
					product={editingProduct}
					onClose={() => setIsModalOpen(false)}
					onSave={() => {
						setIsModalOpen(false);
						loadData();
					}}
				/>
			)}
		</div>
	);
}

function ProductModal({
	product,
	onClose,
	onSave,
}: {
	product: Product | null;
	onClose: () => void;
	onSave: () => void;
}) {
	const [formData, setFormData] = useState({
		codigo: product?.codigo || "",
		nombre: product?.nombre || "",
		descripcion: product?.descripcion || "",
		precio: product?.precio || 0,
		categoria: product?.categoria || "",
		stock: product?.stock || 0,
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			if (product) {
				await productsService.update(product.codigo, formData);
			} else {
				await productsService.create(formData);
			}
			onSave();
		} catch (error) {
			console.error("Error saving product:", error);
		}
	};

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white rounded-lg p-6 w-full max-w-md">
				<h3 className="text-lg font-semibold mb-4">
					{product ? "Editar Producto" : "Nuevo Producto"}
				</h3>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Código
						</label>
						<input
							type="text"
							value={formData.codigo}
							onChange={(e) =>
								setFormData({
									...formData,
									codigo: e.target.value,
								})
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
							required
							disabled={!!product}
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Nombre
						</label>
						<input
							type="text"
							value={formData.nombre}
							onChange={(e) =>
								setFormData({
									...formData,
									nombre: e.target.value,
								})
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
							required
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Descripción
						</label>
						<textarea
							value={formData.descripcion}
							onChange={(e) =>
								setFormData({
									...formData,
									descripcion: e.target.value,
								})
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
							rows={3}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Precio
							</label>
							<input
								type="number"
								step="0.01"
								value={formData.precio}
								onChange={(e) =>
									setFormData({
										...formData,
										precio: parseFloat(e.target.value),
									})
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
								required
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Stock
							</label>
							<input
								type="number"
								value={formData.stock}
								onChange={(e) =>
									setFormData({
										...formData,
										stock: parseInt(e.target.value),
									})
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
								required
							/>
						</div>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Categoría
						</label>
						<input
							type="text"
							value={formData.categoria}
							onChange={(e) =>
								setFormData({
									...formData,
									categoria: e.target.value,
								})
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
							required
						/>
					</div>

					<div className="flex space-x-3 pt-4">
						<button
							type="submit"
							className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
						>
							{product ? "Actualizar" : "Crear"}
						</button>
						<button
							type="button"
							onClick={onClose}
							className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
						>
							Cancelar
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
