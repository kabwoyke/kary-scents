import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { closeDatabase } from "./db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Simple log function for production (replace the imported log)
const log = (message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [express] ${message}`);
};

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Conditionally import vite modules only when needed
  if (app.get("env") === "development") {
    // Dynamic import only in development
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    // For production, either serve static files or skip this entirely
    // If you have static files to serve, implement a simple static server here
    // For API-only apps, you can remove this section
    
    // Simple static file serving (replace with your needs)
    app.use(express.static('public')); // if you have a public directory
    
    // Or if you don't need static file serving in production, just skip this
  }

  // Use PORT from environment, default to 8080 for DigitalOcean compatibility
  const port = parseInt(process.env.PORT || '8080', 10);
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    log(`Received ${signal}. Starting graceful shutdown...`);
    
    try {
      // Close HTTP server first
      await new Promise<void>((resolve) => {
        server.close(() => {
          log('HTTP server closed');
          resolve();
        });
      });

      // Close database connection pool
      await closeDatabase();
      
      log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Handle process termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions and unhandled promise rejections
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
})();