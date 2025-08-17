"use client";

import { useState, useEffect } from "react";
import { CartItem } from "@/types";

const CART_STORAGE_KEY = "ecommerce_cart";

export function useCart() {
	const [cart, setCart] = useState<CartItem[]>([]);

	// Cargar carrito desde localStorage al inicializar
	useEffect(() => {
		if (typeof window !== "undefined") {
			const savedCart = localStorage.getItem(CART_STORAGE_KEY);
			if (savedCart) {
				try {
					setCart(JSON.parse(savedCart));
				} catch (error) {
					console.error(
						"Error loading cart from localStorage:",
						error
					);
				}
			}
		}
	}, []);

	// Guardar carrito en localStorage cada vez que cambie
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
		}
	}, [cart]);

	const addToCart = (
		item: Omit<CartItem, "cantidad"> & { cantidad?: number }
	) => {
		const cantidad = item.cantidad || 1;

		setCart((currentCart) => {
			const existingItem = currentCart.find(
				(cartItem) => cartItem.codigo === item.codigo
			);

			if (existingItem) {
				// Si el producto ya existe, actualizar cantidad
				return currentCart.map((cartItem) =>
					cartItem.codigo === item.codigo
						? {
								...cartItem,
								cantidad: Math.min(
									cartItem.cantidad + cantidad,
									cartItem.stock
								),
						  }
						: cartItem
				);
			} else {
				// Si es un producto nuevo, agregarlo
				return [
					...currentCart,
					{ ...item, cantidad: Math.min(cantidad, item.stock) },
				];
			}
		});
	};

	const removeFromCart = (codigo: string) => {
		setCart((currentCart) =>
			currentCart.filter((item) => item.codigo !== codigo)
		);
	};

	const updateQuantity = (codigo: string, cantidad: number) => {
		setCart((currentCart) =>
			currentCart
				.map((item) =>
					item.codigo === codigo
						? {
								...item,
								cantidad: Math.max(
									0,
									Math.min(cantidad, item.stock)
								),
						  }
						: item
				)
				.filter((item) => item.cantidad > 0)
		);
	};

	const clearCart = () => {
		setCart([]);
		if (typeof window !== "undefined") {
			localStorage.removeItem(CART_STORAGE_KEY);
		}
	};

	const getCartTotal = () => {
		return cart.reduce(
			(total, item) => total + item.precio * item.cantidad,
			0
		);
	};

	const getCartItemCount = () => {
		return cart.reduce((count, item) => count + item.cantidad, 0);
	};

	return {
		cart,
		addToCart,
		removeFromCart,
		updateQuantity,
		clearCart,
		getCartTotal,
		getCartItemCount,
	};
}
