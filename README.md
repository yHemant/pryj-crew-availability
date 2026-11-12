# PRYJ Crew Availability Dashboard

A full-stack application for managing and visualizing Loco Pilot & ALP crew availability data.

**Tech Stack:** Node.js/Express · PostgreSQL · React (Vite) · Tailwind CSS

---

## Prerequisites

- **Node.js** ≥ 18.x
- **PostgreSQL** ≥ 14.x
- **npm** ≥ 9.x

---

## Quick Start

### 1. Database Setup

```bash
# Start PostgreSQL, then create the database:
psql -U postgres -f init.sql
```

Or manually:
```sql
CREATE DATABASE crew_availability;
```

The backend auto-creates the table on first startup.

### 2. Backend Setup

```bash
cd backend
npm install
```

Edit `.env` if needed (defaults work with a standard PostgreSQL install):

```env
ADMIN_USER=admin
ADMIN_PASS=admin123
JWT_SECRET=pryj-crew-availability-secret-key-2024
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=crew_availability
PORT=5000
```

Start the backend:
```bash
npm start        # Production
npm run dev      # Development (auto-reload)
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev      # Starts on http://localhost:5173
```

The Vite dev server proxies `/api` requests to `http://localhost:5000`.

### 4. Login

Open `http://localhost:5173` and log in with:
- **Username:** `admin`
- **Password:** `admin123`

### 5. Upload Data

Use the upload section on the dashboard to upload your `CREW AVAILABILITY.xlsx` file. The app will:
1. Parse Sheet1 (headers at row 10)
2. Truncate existing data
3. Insert all parsed rows
4. Refresh the summary dashboard

---

## Project Structure

```
├── backend/
│   ├── .env                  # Environment variables
│   ├── server.js             # Express app entry point
│   ├── db.js                 # PostgreSQL pool + init
│   ├── middleware/
│   │   └── auth.js           # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js           # POST /api/login
│   │   ├── upload.js         # POST /api/upload (protected)
│   │   ├── summary.js        # GET  /api/summary
│   │   └── details.js        # GET  /api/crew/details
│   └── uploads/              # Temp upload directory
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Router + auth state
│   │   ├── api.js            # Axios client + interceptors
│   │   └── components/
│   │       ├── Login.jsx     # Login form
│   │       ├── Upload.jsx    # File upload with toast
│   │       ├── Dashboard.jsx # Summary table (clickable cells)
│   │       └── DetailView.jsx# Drill-down crew table
│   ├── vite.config.js
│   └── tailwind.config.js
├── init.sql                  # Database initialization script
└── README.md
```

---

## API Endpoints

| Method | Endpoint              | Auth | Description                          |
|--------|-----------------------|------|--------------------------------------|
| POST   | `/api/login`          | No   | Returns JWT on valid credentials     |
| POST   | `/api/upload`         | JWT  | Upload & parse Excel, refresh DB     |
| GET    | `/api/summary`        | No   | Station × HQ/OS × time-bucket counts|
| GET    | `/api/crew/details`   | No   | Drill-down rows for a summary cell   |
| GET    | `/api/health`         | No   | Health check                         |

### Summary Calculation Rules

- **Crew Type:** HQ (AVAIL STTN = HQ column) vs OS (mismatch)
- **Status Filter:** Only `REST`, `CALLED`, `BOOKED`
- **LEAVE Exception (4-8 bucket only):** Also counts `LEAVE` crew with AVAIL TIME ≥ start of today
- **Time Buckets:** 0-4, 4-8, 8-16, 16-24 (hour of AVAIL TIME)

---

## Production Build

```bash
cd frontend
npm run build        # Outputs to frontend/dist/

# Set NODE_ENV=production on the backend to serve the React build:
cd ../backend
NODE_ENV=production npm start
```

The Express server serves the React build from `frontend/dist/` in production mode.

