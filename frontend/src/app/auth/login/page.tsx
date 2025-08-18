"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import toast from "react-hot-toast";

export default function LoginPage() {
	const [formData, setFormData] = useState({
		email: "",
		password: "",
		tenant_id: "",
	});
	const [loading, setLoading] = useState(false);

	const { login } = useAuth();
	const router = useRouter();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			await login(formData.email, formData.password, formData.tenant_id);
			toast.success("Inicio de sesión exitoso");

			const userData = JSON.parse(
				localStorage.getItem("user_data") || "{}"
			);

			if (userData.role === "admin") {
				router.push("/admin");
			} else {
				router.push("/dashboard");
			}
		} catch (error: unknown) {
			console.error("Login error:", error);
			const errorMessage =
				error instanceof Error
					? error.message
					: (error as { response?: { data?: { error?: string } } })
							?.response?.data?.error ||
					  "Error al iniciar sesión";
			toast.error(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value,
		});
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md w-full">
				<div className="text-center mb-8">
					<h1 className="text-3xl font-bold text-gray-900">
						E-Commerce
					</h1>
					<h2 className="mt-6 text-2xl font-semibold text-gray-900">
						Iniciar Sesión
					</h2>
					<p className="mt-2 text-sm text-gray-600">
						¿No tienes cuenta?{" "}
						<Link
							href="/auth/register"
							className="font-medium text-blue-600 hover:text-blue-500"
						>
							Regístrate aquí
						</Link>
					</p>
				</div>

				<Card>
					<form onSubmit={handleSubmit} className="space-y-6">
						<Input
							label="Tenant ID"
							name="tenant_id"
							type="text"
							value={formData.tenant_id}
							onChange={handleInputChange}
							placeholder="ID de la empresa/organización"
							required
						/>

						<Input
							label="Email"
							name="email"
							type="email"
							value={formData.email}
							onChange={handleInputChange}
							placeholder="tu@email.com"
							required
						/>

						<Input
							label="Contraseña"
							name="password"
							type="password"
							value={formData.password}
							onChange={handleInputChange}
							placeholder="••••••••"
							required
						/>

						<Button
							type="submit"
							className="w-full"
							loading={loading}
							disabled={loading}
						>
							{loading ? "Iniciando sesión..." : "Iniciar Sesión"}
						</Button>
					</form>

					<div className="mt-6">
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<div className="w-full border-t border-gray-300" />
							</div>
							<div className="relative flex justify-center text-sm">
								<span className="px-2 bg-white text-gray-500">
									Ejemplos de Tenant ID
								</span>
							</div>
						</div>
						<div className="mt-3 text-xs text-gray-500 space-y-1">
							<p>
								•{" "}
								<code className="bg-gray-100 px-1 rounded">
									empresa1
								</code>{" "}
								- Para la Empresa 1
							</p>
							<p>
								•{" "}
								<code className="bg-gray-100 px-1 rounded">
									tienda-abc
								</code>{" "}
								- Para Tienda ABC
							</p>
							<p>
								•{" "}
								<code className="bg-gray-100 px-1 rounded">
									demo
								</code>{" "}
								- Para pruebas
							</p>
						</div>
					</div>
				</Card>
			</div>
		</div>
	);
}
