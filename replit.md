# KARY SCENTS E-commerce Platform

## Overview

KARY SCENTS is a luxury Arabic perfume e-commerce platform built for the Kenyan market. The application focuses on selling premium fragrances with an elegant, culturally-inspired design that combines modern web technologies with Arabic aesthetic elements. The platform features a full shopping experience including product browsing, cart management, checkout with payment processing, and administrative tools for order management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development practices
- **Styling**: Tailwind CSS with custom design system implementing luxury Arabic-inspired aesthetics
- **UI Components**: Radix UI primitives with shadcn/ui component library for consistent, accessible components
- **State Management**: React Context API for cart management and TanStack Query for server state
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Language**: TypeScript for full-stack type safety
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon serverless PostgreSQL for scalable cloud hosting
- **Session Management**: Cookie-based sessions for admin authentication
- **API Structure**: RESTful API with structured error handling and logging

### Design System
- **Color Palette**: Luxury-focused with Soft Rose primary, Deep Plum accents, and Warm Gold highlights
- **Typography**: Playfair Display for headings, Inter for body text, with Arabic font support
- **Theme Support**: Light/dark mode toggle with CSS custom properties
- **Layout**: Mobile-first responsive design with consistent spacing units

### E-commerce Features
- **Product Management**: Full CRUD operations for products with categories, pricing, and images
- **Shopping Cart**: Persistent cart state with quantity management and local storage
- **Checkout Process**: Multi-step checkout with delivery location selection
- **Order Management**: Complete order lifecycle from creation to fulfillment tracking
- **Admin Panel**: Protected admin interface for product and order management

### Authentication & Authorization
- **Admin Authentication**: Session-based authentication with secure cookie management
- **Session Security**: Automatic session expiration and cleanup of expired sessions
- **Route Protection**: Middleware-based route protection for admin endpoints

## External Dependencies

### Payment Processing
- **Stripe**: Primary payment processor with React Stripe.js integration for secure payment handling
- **Payment Methods**: Credit/debit cards with potential for mobile money integration

### Database & Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Database Migrations**: Drizzle Kit for schema management and migrations

### Development & Deployment
- **Replit**: Development environment with integrated deployment capabilities
- **Asset Management**: Local asset serving for product images with generated image support

### UI & Styling Libraries
- **Radix UI**: Comprehensive primitive components for accessibility and functionality
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **Lucide React**: Icon library for consistent iconography

### Form & Validation
- **React Hook Form**: Form state management with validation
- **Zod**: Schema validation for form inputs and API data

### Additional Integrations
- **WhatsApp Integration**: Customer support through WhatsApp Business API
- **Phone Integration**: Direct calling functionality for customer service
- **Email Support**: Contact form with email integration capabilities