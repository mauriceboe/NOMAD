# TREK Wiki

TREK is a self-hosted, real-time collaborative travel planner licensed under AGPL-3.0.

![Dashboard](assets/DashboardWidgets.png)

## Features

### Planning
- **Drag & Drop Planner** — organize places into day plans with reordering and cross-day moves
- **Interactive Map** — Leaflet map with photo markers, clustering, route visualization, and customizable tile sources
- **Place Search** — Google Places (photos, ratings, hours) or OpenStreetMap (free, no API key needed)
- **Day Notes** — timestamped, icon-tagged notes per day
- **Route Optimization** — auto-optimize place order and export to Google Maps
- **Weather Forecasts** — 16-day forecasts via Open-Meteo (no API key required), historical climate averages as fallback

### Travel Management
- **Reservations & Bookings** — track flights, accommodations, restaurants with confirmation numbers and file attachments
- **Budget Tracking** — category-based expenses with pie chart, per-person/per-day splitting, multi-currency support
- **Packing Lists** — category-based checklists with user assignment, templates, and progress tracking
- **Document Manager** — attach documents, tickets, and PDFs to trips, places, or reservations (up to 50 MB per file)
- **PDF Export** — export complete trip plans as PDF with cover page, images, and notes

### Collaboration
- **Real-Time Sync** — WebSocket-based live sync; changes appear instantly for all connected users
- **Multi-User** — invite members with role-based access
- **Invite Links** — one-time registration links with configurable max uses and expiry
- **OIDC SSO** — sign in with Google, Apple, Authentik, Keycloak, or any OIDC provider
- **Two-Factor Authentication** — TOTP-based 2FA with QR code setup
- **Public Share Links** — share a read-only view of any trip

### Addons _(admin-toggleable)_
- **Vacay** — personal vacation day planner with calendar view, public holidays, and carry-over tracking
- **Atlas** — interactive world map, bucket list, travel stats, continent breakdown
- **Journey** — travel journal linking entries to trips, with contributor roles
- **Memories** — photo-focused trip memories
- **Collab** — group chat, shared notes, polls, and activity sign-ups
- **Dashboard Widgets** — currency converter and timezone clock, toggled per user

### AI / MCP Integration
- **MCP Server** — built-in Model Context Protocol server with OAuth 2.1 authentication
- **80+ Tools** — create trips, plan itineraries, manage budgets, send messages, and more
- **24 OAuth Scopes** — granular permissions across 13 permission groups
- **Pre-built Prompts** — `trip-summary`, `packing-list`, and `budget-overview` context loaders

### Admin
- User management, invite links, packing templates, global categories
- Addon management, API key storage, scheduled auto-backups
- System notices for onboarding and announcements

> **Admin:** Most configuration lives in the Admin Panel. The first user to register becomes the admin automatically.

## Get Started

| | |
|---|---|
| [Quick Start](Quick-Start) | Install in minutes with a single Docker command |
| [My Trips Dashboard](My-Trips-Dashboard) | Start planning your first trip |
| [Admin Panel](Admin-Panel-Overview) | Configure your instance |
| [MCP / AI Integration](MCP-Overview) | Connect Claude, Cursor, or any MCP client |
