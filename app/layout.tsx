import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Organigrama Interactivo — Workday",
  description: "Visualiza y exporta organigramas desde reportes Workday RaaS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
