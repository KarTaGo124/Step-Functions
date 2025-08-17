import { ReactNode } from "react";
import { clsx } from "clsx";

interface CardProps {
	children: ReactNode;
	className?: string;
	padding?: boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
	return (
		<div
			className={clsx(
				"bg-white rounded-lg border border-gray-200 shadow-sm",
				padding && "p-6",
				className
			)}
		>
			{children}
		</div>
	);
}
