"use client";

import { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";

interface MainLayoutProps {
	children: ReactNode;
	onCartClick?: () => void;
	onHistoryClick?: () => void;
}

export function MainLayout({ children, onCartClick, onHistoryClick }: MainLayoutProps) {
	return (
		<div className="min-h-screen bg-gray-50">
			<Navbar onCartClick={onCartClick} onHistoryClick={onHistoryClick} />
			<main>{children}</main>
		</div>
	);
}
