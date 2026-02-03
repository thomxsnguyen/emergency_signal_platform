# Emergency Signal Platform

Real-time earthquake monitoring with interactive map visualization.

## Stack

- Node.js, Express, TypeScript, MySQL
- React, TypeScript, Leaflet

## Setup

```bash
npm run install:all
cd server && cp .env.example .env
# Edit .env with MySQL credentials
npm run dev
```

## API

- `GET /api/earthquakes?timeRange=hour|day|week|month`
- `GET /api/health`

Data source: USGS Earthquake API
