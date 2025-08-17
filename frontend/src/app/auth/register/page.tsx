"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import toast from "react-hot-toast";

export default function RegisterPage() {
	const [formData, setFormData] = useState({
		nombre: "",
		email: "",
		password: "",
		confirmPassword: "",
		tenant_id: "",
		role: "user" as "user" | "admin",
	});
	const [loading, setLoading] = useState(false);

	const { register } = useAuth();
	const router = useRouter();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (formData.password !== formData.confirmPassword) {
			toast.error("Las contraseñas no coinciden");
			return;
		}

		if (formData.password.length < 6) {
			toast.error("La contraseña debe tener al menos 6 caracteres");
			return;
		}

		setLoading(true);

		try {
			await register({
				nombre: formData.nombre,
				email: formData.email,
				password: formData.password,
				tenant_id: formData.tenant_id,
				role: formData.role,
			});
			toast.success("Registro exitoso");
			router.push("/dashboard");
		} catch (error: unknown) {
			console.error("Register error:", error);
			const errorMessage =
				error instanceof Error
					? error.message
					: (error as { response?: { data?: { error?: string } } })
							?.response?.data?.error ||
					  "Error al registrar usuario";
			toast.error(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
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
						Crear Cuenta
					</h2>
					<p className="mt-2 text-sm text-gray-600">
						¿Ya tienes cuenta?{" "}
						<Link
							href="/auth/login"
							className="font-medium text-blue-600 hover:text-blue-500"
						>
							Inicia sesión aquí
						</Link>
					</p>
				</div>

				<Card>
					<form onSubmit={handleSubmit} className="space-y-6">
						<Input
							label="Nombre completo"
							name="nombre"
							type="text"
							value={formData.nombre}
							onChange={handleInputChange}
							placeholder="Tu nombre completo"
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
							label="Tenant ID"
							name="tenant_id"
							type="text"
							value={formData.tenant_id}
							onChange={handleInputChange}
							placeholder="ID de la empresa/organización"
							required
						/>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Rol
							</label>
							<select
								name="role"
								value={formData.role}
								onChange={handleInputChange}
								className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								required
							>
								<option value="user">Usuario (Cliente)</option>
								<option value="admin">
									Administrador (Supervisor)
								</option>
							</select>
						</div>

						<Input
							label="Contraseña"
							name="password"
							type="password"
							value={formData.password}
							onChange={handleInputChange}
							placeholder="••••••••"
							required
						/>

						<Input
							label="Confirmar contraseña"
							name="confirmPassword"
							type="password"
							value={formData.confirmPassword}
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
							{loading ? "Creando cuenta..." : "Crear Cuenta"}
						</Button>
					</form>

					<div className="mt-6">
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<div className="w-full border-t border-gray-300" />
							</div>
							<div className="relative flex justify-center text-sm">
								<span className="px-2 bg-white text-gray-500">
									Información importante
								</span>
							</div>
						</div>
						<div className="mt-3 text-xs text-gray-500 space-y-2">
							<p>
								<strong>Usuario:</strong> Puede comprar
								productos, ver su carrito y hacer seguimiento de
								pedidos
							</p>
							<p>
								<strong>Administrador:</strong> Puede gestionar
								productos y aprobar/rechazar pedidos
							</p>
							<p>
								<strong>Tenant ID:</strong> Identifica tu
								organización en el sistema multi-tenant
							</p>
						</div>
					</div>
				</Card>
			</div>
		</div>
	);
}
