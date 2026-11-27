import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma-postgres/client", "bcryptjs"],
};

export default nextConfig;
