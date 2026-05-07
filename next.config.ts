import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Turbopack/webpack from bundling these Node.js packages.
  // PDFKit uses __dirname to locate font files at runtime — if bundled,
  // __dirname resolves to a wrong path (C:\ROOT\...) and fonts are not found.
  serverExternalPackages: ["pdfkit", "nodemailer", "pdf-parse", "mammoth"],
};

export default nextConfig;
