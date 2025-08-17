"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import {
	ShoppingCartIcon,
	UserIcon,
	MenuIcon,
	XIcon,
} from "@/components/ui/Icons";

interface NavbarProps {
	onCartClick?: () => void;
	onHistoryClick?: () => void;
}

export function Navbar({ onCartClick, onHistoryClick }: NavbarProps) {
	const { user, logout, isAdmin } = useAuth();
	const { getCartItemCount } = useCart();
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	const cartItemCount = getCartItemCount();

	const handleLogout = () => {
		logout();
		setIsMenuOpen(false);
	};

	return (
		<nav className="bg-white shadow-lg border-b">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex justify-between h-16">
					<div className="flex items-center">
						<Link href="/" className="flex-shrink-0">
							<h1 className="text-xl font-bold text-blue-600">
								E-Commerce
							</h1>
						</Link>

						{user && (
							<div className="hidden md:ml-6 md:flex md:space-x-8">
								{isAdmin() && (
									<Link
										href="/admin"
										className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium"
									>
										🏠 Panel Admin
									</Link>
								)}
							</div>
						)}
					</div>

					<div className="flex items-center space-x-4">
						{user ? (
							<>
								{/* Icono del historial de compras */}
								<button
									onClick={onHistoryClick}
									className="relative p-2 text-gray-600 hover:text-blue-600"
									title="Historial de compras"
								>
									📋
								</button>

								{/* Icono del carrito */}
								<button
									onClick={onCartClick}
									className="relative p-2 text-gray-600 hover:text-blue-600"
									title="Carrito de compras"
								>
									<ShoppingCartIcon size={24} />
									{cartItemCount > 0 && (
										<span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center">
											{cartItemCount}
										</span>
									)}
								</button>

								<div className="hidden md:flex items-center space-x-4">
									<div className="flex items-center space-x-2">
										<UserIcon size={20} />
										<span className="text-sm text-gray-700">
											{user.nombre}
										</span>
										{user.role === "admin" && (
											<span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
												Admin
											</span>
										)}
									</div>
									<button
										onClick={handleLogout}
										className="text-gray-600 hover:text-red-600 text-sm font-medium"
									>
										Salir
									</button>
								</div>

								<div className="md:hidden">
									<button
										onClick={() =>
											setIsMenuOpen(!isMenuOpen)
										}
										className="text-gray-600 hover:text-blue-600"
									>
										{isMenuOpen ? (
											<XIcon size={24} />
										) : (
											<MenuIcon size={24} />
										)}
									</button>
								</div>
							</>
						) : (
							<div className="space-x-4">
								<Link
									href="/auth/login"
									className="text-gray-600 hover:text-blue-600 text-sm font-medium"
								>
									Iniciar Sesión
								</Link>
								<Link
									href="/auth/register"
									className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
								>
									Registrarse
								</Link>
							</div>
						)}
					</div>
				</div>

				{/* Mobile menu */}
				{isMenuOpen && user && (
					<div className="md:hidden">
						<div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t">
							<Link
								href="/productos"
								className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600"
								onClick={() => setIsMenuOpen(false)}
							>
								Productos
							</Link>
							<Link
								href="/compras"
								className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600"
								onClick={() => setIsMenuOpen(false)}
							>
								Compras
							</Link>
							<Link
								href="/dashboard"
								className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600"
								onClick={() => setIsMenuOpen(false)}
							>
								Dashboard
							</Link>

							{isAdmin() && (
								<>
									<Link
										href="/admin/productos"
										className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600"
										onClick={() => setIsMenuOpen(false)}
									>
										Admin Productos
									</Link>
									<Link
										href="/admin/dashboard"
										className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600"
										onClick={() => setIsMenuOpen(false)}
									>
										Panel Supervisor
									</Link>
								</>
							)}

							<div className="border-t pt-3 mt-3">
								<div className="flex items-center px-3 py-2">
									<UserIcon size={20} />
									<span className="ml-2 text-base font-medium text-gray-700">
										{user.nombre}
									</span>
									{user.role === "admin" && (
										<span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
											Admin
										</span>
									)}
								</div>
								<button
									onClick={handleLogout}
									className="block w-full text-left px-3 py-2 text-base font-medium text-red-600 hover:text-red-800"
								>
									Cerrar Sesión
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</nav>
	);
}
