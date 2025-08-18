"use client";

import {
	useState,
	useEffect,
	createContext,
	useContext,
	ReactNode,
} from "react";
import { User } from "@/types";
import { authService } from "@/lib/api";

interface AuthContextType {
	user: User | null;
	isLoading: boolean;
	login: (email: string, password: string, tenantId: string) => Promise<void>;
	register: (data: {
		email: string;
		password: string;
		nombre: string;
		tenant_id: string;
		role?: "user" | "admin";
	}) => Promise<void>;
	logout: () => void;
	isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		// Verificar si hay un usuario autenticado al cargar la página
		const initAuth = async () => {
			try {
				if (authService.isAuthenticated()) {
					// Primero intentar obtener el usuario desde localStorage/cookies
					const storedUser = authService.getCurrentUser();
					
					if (storedUser && storedUser.nombre) {
						setUser(storedUser);
						setIsLoading(false);
						return;
					}

					// Si no hay usuario almacenado válido, validar con el servidor
					const { valido, usuario } =
						await authService.validateToken();
					if (valido && usuario && usuario.nombre) {
						setUser(usuario);
					} else {
						console.log("Token válido pero usuario incompleto:", usuario);
						authService.logout();
					}
				}
			} catch (error) {
				console.error("Error validating token:", error);
				authService.logout();
			} finally {
				setIsLoading(false);
			}
		};

		initAuth();
	}, []);

	const login = async (email: string, password: string, tenantId: string) => {
		try {
			const response = await authService.login({
				email,
				password,
				tenant_id: tenantId,
			});
			setUser(response.usuario);
		} catch (error) {
			console.error("Login error:", error);
			throw error;
		}
	};

	const register = async (data: {
		email: string;
		password: string;
		nombre: string;
		tenant_id: string;
		role?: "user" | "admin";
	}) => {
		try {
			await authService.register(data);
			// Después del registro, hacer login automáticamente
			await login(data.email, data.password, data.tenant_id);
		} catch (error) {
			console.error("Register error:", error);
			throw error;
		}
	};

	const logout = () => {
		authService.logout();
		setUser(null);
	};

	const isAdmin = () => {
		return user?.role === "admin";
	};

	const value = {
		user,
		isLoading,
		login,
		register,
		logout,
		isAdmin,
	};

	return (
		<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
