"use client";

import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/MainLayout";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
	const { user, isLoading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!isLoading) {
			if (!user) {
				router.push("/auth/login");
			} else {
				if (user.role === "admin") {
					router.push("/admin");
				} else {
					router.push("/dashboard");
				}
			}
		}
	}, [user, isLoading, router]);

	if (isLoading || !user) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
					<p className="mt-4 text-gray-600">Cargando...</p>
				</div>
			</div>
		);
	}

	return (
		<MainLayout>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="text-center">
					<h1 className="text-3xl font-bold text-gray-900 mb-4">
						Bienvenido, {user.nombre}
					</h1>
					<p className="text-lg text-gray-600">
						Redirigiendo al dashboard...
					</p>
				</div>
			</div>
		</MainLayout>
	);
}
