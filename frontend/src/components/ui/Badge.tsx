import { ReactNode } from "react";
import { clsx } from "clsx";
import { EstadoCompra, EstadoTexto, EstadoColor } from "@/types";

interface BadgeProps {
	children: ReactNode;
	variant?: "default" | "success" | "warning" | "error" | "info";
	className?: string;
}

export function Badge({
	children,
	variant = "default",
	className,
}: BadgeProps) {
	const variants = {
		default: "bg-gray-100 text-gray-800",
		success: "bg-green-100 text-green-800",
		warning: "bg-yellow-100 text-yellow-800",
		error: "bg-red-100 text-red-800",
		info: "bg-blue-100 text-blue-800",
	};

	return (
		<span
			className={clsx(
				"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
				variants[variant],
				className
			)}
		>
			{children}
		</span>
	);
}

interface StatusBadgeProps {
	estado: EstadoCompra;
	className?: string;
}

export function StatusBadge({ estado, className }: StatusBadgeProps) {
	return (
		<span
			className={clsx(
				"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
				EstadoColor[estado],
				className
			)}
		>
			{EstadoTexto[estado]}
		</span>
	);
}
