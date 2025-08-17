"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/MainLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { Compra, EstadoTexto, EstadoColor } from "@/types";
import { purchasesService } from "@/lib/api";
import toast from "react-hot-toast";

export default function ComprasPage() {
	const { user, isLoading } = useAuth();
	const router = useRouter();
	const [compras, setCompras] = useState<Compra[]>([]);
	const [loading, setLoading] = useState(true);

	// Estados de paginación
	const [comprasLastKey, setComprasLastKey] = useState<string | null>(null);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [hasMoreCompras, setHasMoreCompras] = useState(true);

	// Cargar historial de compras
	const loadCompras = async (append: boolean = false) => {
		try {
			if (!append) {
				setLoading(true);
			} else {
				setIsLoadingMore(true);
			}

			const response = await purchasesService.list({
				limit: 10,
				lastKey: append ? comprasLastKey || undefined : undefined,
			});

			if (append) {
				setCompras((prev) => [...prev, ...response.items]);
			} else {
				setCompras(response.items);
			}

			setComprasLastKey(response.lastKey || null);
			setHasMoreCompras(!!response.lastKey);
		} catch (error) {
			console.error("Error loading purchases:", error);
			toast.error("Error al cargar el historial de compras");
		} finally {
			setLoading(false);
			setIsLoadingMore(false);
		}
	};

	useEffect(() => {
		const initializeCompras = async () => {
			if (!user) {
				setLoading(false);
				return;
			}

			try {
				setLoading(true);
				const response = await purchasesService.list({ limit: 10 });
				setCompras(response.items);
				setComprasLastKey(response.lastKey || null);
				setHasMoreCompras(!!response.lastKey);
			} catch (error) {
				console.error("Error loading initial purchases:", error);
				toast.error("Error al cargar el historial de compras");
			} finally {
				setLoading(false);
			}
		};

		initializeCompras();
	}, [user]);

	const loadMoreCompras = async () => {
		if (!hasMoreCompras || isLoadingMore) return;
		await loadCompras(true);
	};

	const handleCancelCompra = async (compraId: string) => {
		if (
			!confirm(
				"¿Estás seguro de que quieres cancelar esta compra? Esta acción eliminará la compra permanentemente."
			)
		) {
			return;
		}

		try {
			await purchasesService.cancel(compraId);
			toast.success("Compra cancelada y eliminada exitosamente");

			// Remover la compra cancelada de la lista local
			setCompras((prevCompras) =>
				prevCompras.filter((compra) => compra.compra_id !== compraId)
			);
		} catch (error: unknown) {
			console.error("Error cancelling purchase:", error);
			const errorMessage =
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(error as any).response?.data?.error ||
				"Error al cancelar la compra";
			toast.error(errorMessage);
		}
	};

	// Manejar redirección de autenticación
	useEffect(() => {
		if (!user && !isLoading) {
			router.push("/auth/login");
		}
	}, [user, isLoading, router]);

	// Mostrar loading si está cargando autenticación
	if (isLoading) {
		return (
			<MainLayout>
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
		return null;
	}

	// Mostrar loading si está cargando datos
	if (loading) {
		return (
			<MainLayout>
				<div className="max-w-6xl mx-auto px-4 py-8">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
						<p className="mt-4 text-gray-600">
							Cargando historial...
						</p>
					</div>
				</div>
			</MainLayout>
		);
	}

	// Función para obtener el estado formateado
	const getEstadoFormatted = (estado: string) => {
		return {
			text: EstadoTexto[estado as keyof typeof EstadoTexto] || estado,
			color:
				EstadoColor[estado as keyof typeof EstadoColor] ||
				"bg-gray-100 text-gray-800",
		};
	};

	// Función para formatear fecha
	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("es-ES", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<MainLayout>
			<div className="max-w-6xl mx-auto px-4 py-8">
				<div className="flex justify-between items-center mb-8">
					<h1 className="text-3xl font-bold text-gray-900">
						📋 Historial de Compras
					</h1>
				</div>

				{compras.length === 0 ? (
					<Card>
						<div className="text-center py-12">
							<div className="text-6xl mb-4">📦</div>
							<h3 className="text-xl font-semibold text-gray-900 mb-2">
								No tienes compras aún
							</h3>
							<p className="text-gray-600 mb-6">
								¡Explora nuestros productos y realiza tu primera
								compra!
							</p>
							<Button onClick={() => router.push("/productos")}>
								Ver Productos
							</Button>
						</div>
					</Card>
				) : (
					<div className="space-y-6">
						{compras.map((compra) => {
							const estado = getEstadoFormatted(compra.estado);

							return (
								<Card key={compra.compra_id}>
									<div className="p-6">
										{/* Header de la compra */}
										<div className="flex justify-between items-start mb-4">
											<div>
												<h3 className="text-lg font-semibold text-gray-900">
													Pedido #
													{compra.compra_id.substring(
														0,
														8
													)}
												</h3>
												<p className="text-sm text-gray-600">
													{formatDate(
														compra.created_at
													)}
												</p>
											</div>
											<div className="text-right">
												<span
													className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estado.color}`}
												>
													{estado.text}
												</span>
												<p className="text-lg font-bold text-blue-600 mt-1">
													${compra.total.toFixed(2)}
												</p>
											</div>
										</div>

										{/* Productos de la compra */}
										<div className="border-t pt-4">
											<h4 className="font-medium text-gray-900 mb-3">
												Productos (
												{compra.productos.length})
											</h4>
											<div className="space-y-2">
												{compra.productos.map(
													(producto, index) => (
														<div
															key={index}
															className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0"
														>
															<div className="flex-1">
																<p className="font-medium text-gray-900">
																	{
																		producto.nombre
																	}
																</p>
																<p className="text-sm text-gray-600">
																	Cantidad:{" "}
																	{
																		producto.cantidad
																	}{" "}
																	× $
																	{producto.precio_unitario.toFixed(
																		2
																	)}
																</p>
															</div>
															<div className="text-right">
																<p className="font-semibold">
																	$
																	{producto.subtotal.toFixed(
																		2
																	)}
																</p>
															</div>
														</div>
													)
												)}
											</div>
										</div>

										{/* Acciones */}
										<div className="flex justify-between items-center pt-4 mt-4 border-t">
											<div className="flex space-x-3">
												<Button
													size="sm"
													variant="secondary"
													onClick={() =>
														router.push(
															`/compras/${compra.compra_id}`
														)
													}
												>
													Ver Detalles
												</Button>
												{compra.estado ===
													"completado" && (
													<Button
														size="sm"
														variant="secondary"
														onClick={() =>
															toast(
																"Funcionalidad de reseña en desarrollo"
															)
														}
													>
														⭐ Dejar Reseña
													</Button>
												)}
											</div>
											{(compra.estado === "pendiente" ||
												compra.estado ===
													"esperando_aprobacion" ||
												compra.estado ===
													"procesando_pago") && (
												<Button
													size="sm"
													variant="danger"
													onClick={() =>
														handleCancelCompra(
															compra.compra_id
														)
													}
												>
													Cancelar Pedido
												</Button>
											)}
										</div>
									</div>
								</Card>
							);
						})}

						{/* Botón para cargar más compras */}
						{hasMoreCompras && compras.length > 0 && (
							<div className="text-center mt-6">
								<Button
									onClick={loadMoreCompras}
									disabled={isLoadingMore}
									variant="secondary"
									size="lg"
								>
									{isLoadingMore
										? "Cargando..."
										: "Cargar más compras"}
								</Button>
							</div>
						)}
					</div>
				)}

				{/* Estadísticas de compras */}
				{compras.length > 0 && (
					<Card className="mt-8">
						<div className="p-6">
							<h3 className="text-lg font-semibold text-gray-900 mb-4">
								📊 Resumen de Compras
							</h3>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-6">
								<div className="text-center">
									<p className="text-2xl font-bold text-blue-600">
										{compras.length}
									</p>
									<p className="text-sm text-gray-600">
										Total de Pedidos
									</p>
								</div>
								<div className="text-center">
									<p className="text-2xl font-bold text-green-600">
										{
											compras.filter(
												(c) => c.estado === "completado"
											).length
										}
									</p>
									<p className="text-sm text-gray-600">
										Completadas
									</p>
								</div>
								<div className="text-center">
									<p className="text-2xl font-bold text-green-600">
										$
										{compras
											.filter(
												(compra) =>
													compra.estado ===
													"completado"
											)
											.reduce(
												(total, compra) =>
													total + compra.total,
												0
											)
											.toFixed(2)}
									</p>
									<p className="text-sm text-gray-600">
										Total Gastado
									</p>
								</div>
								<div className="text-center">
									<p className="text-2xl font-bold text-purple-600">
										{compras
											.filter(
												(compra) =>
													compra.estado ===
													"completado"
											)
											.reduce(
												(total, compra) =>
													total +
													compra.productos.length,
												0
											)}
									</p>
									<p className="text-sm text-gray-600">
										Productos Comprados
									</p>
								</div>
							</div>

							{/* Mostrar estados adicionales si existen */}
							{(compras.some((c) => c.estado === "rechazado") ||
								compras.some(
									(c) => c.estado === "esperando_aprobacion"
								) ||
								compras.some(
									(c) => c.estado === "pendiente"
								)) && (
								<div className="mt-6 pt-4 border-t border-gray-200">
									<div className="grid grid-cols-3 gap-4 text-center">
										{compras.filter(
											(c) => c.estado === "rechazado"
										).length > 0 && (
											<div>
												<p className="text-lg font-semibold text-red-600">
													{
														compras.filter(
															(c) =>
																c.estado ===
																"rechazado"
														).length
													}
												</p>
												<p className="text-xs text-gray-500">
													Rechazadas
												</p>
											</div>
										)}
										{compras.filter(
											(c) =>
												c.estado ===
												"esperando_aprobacion"
										).length > 0 && (
											<div>
												<p className="text-lg font-semibold text-yellow-600">
													{
														compras.filter(
															(c) =>
																c.estado ===
																"esperando_aprobacion"
														).length
													}
												</p>
												<p className="text-xs text-gray-500">
													Esperando Aprobación
												</p>
											</div>
										)}
										{compras.filter(
											(c) => c.estado === "pendiente"
										).length > 0 && (
											<div>
												<p className="text-lg font-semibold text-blue-600">
													{
														compras.filter(
															(c) =>
																c.estado ===
																"pendiente"
														).length
													}
												</p>
												<p className="text-xs text-gray-500">
													Pendientes
												</p>
											</div>
										)}
									</div>
								</div>
							)}
						</div>
					</Card>
				)}
			</div>
		</MainLayout>
	);
}
