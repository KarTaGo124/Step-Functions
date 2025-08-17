import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "E-commerce Multi-Tenant",
	description: "Sistema de e-commerce con step functions y multi-tenancy",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="es">
			<body className={inter.className}>
				<AuthProvider>
					{children}
					<Toaster position="top-right" />
				</AuthProvider>
			</body>
		</html>
	);
}
