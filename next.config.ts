import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Pour le client (browser), ignorer les modules Node.js qui ne peuvent pas être résolus
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        dns: false,
        tls: false,
        crypto: false,
        stream: false,
        util: false,
        url: false,
        assert: false,
        querystring: false,
        path: false,
        os: false,
        pg: false,
        'pg-native': false,
        'pg-connection-string': false,
        'pg-pool': false,
        'pg-types': false
      };
      
      // Supprimer les warnings pour les modules non résolus
      config.ignoreWarnings = [
        { module: /node_modules\/pg/ },
        { module: /node_modules\/pg-native/ },
        { module: /node_modules\/pg-connection-string/ }
      ];
    }
    
    return config;
  },
  
  // Configuration pour les modules externes côté serveur
  serverExternalPackages: ['pg', 'pg-native', 'jsonwebtoken', 'bcryptjs']
};

export default nextConfig;
