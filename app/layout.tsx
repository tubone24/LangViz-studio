import { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "LangChain Observability",
  description: "Visualize your LangChain runs"
};

export default function RootLayout({
                                     children
                                   }: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
    <body>{children}</body>
    </html>
  );
}
