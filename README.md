# CareSphere Server - REST API Engine

CareSphere Server is the backend service powering the **CareSphere Social Development Events Platform**. It provides secure RESTful APIs, JWT-based authentication, MongoDB data transactions, and role-restricted event management operations.

---

## Key Features

- **JWT-Secured Authorization:** Custom middleware (`verifyToken`) inspecting Bearer tokens to protect private administrative and volunteer endpoints.
- **Secure Password Hashing:** Salted password encryption using `bcryptjs` before persisting user credentials in the database.
- **Strict Event Validation:** Server-side date validation preventing past or expired events from being created or updated, paired with creator-only update and deletion guards.
- **Optimized MongoDB Operations:** Native MongoDB aggregation and query pipelines using `.limit(6)` and date ordering to serve dynamic landing page feeds efficiently.
- **Cascading Reference Management:** Automatically clears linked event participation records whenever an organizer cancels or deletes an active event drive.

---

## Tech Stack

- **Runtime Environment:** Node.js
- **Web Framework:** Express.js
- **Database:** MongoDB (Official Native Driver)
- **Token & Security:** JSON Web Tokens (`jsonwebtoken`), `bcryptjs`
- **Utilities & Middleware:** `cors`, `dotenv`, `nodemon` (Development)
- **Deployment Platform:** Render

---

## API Endpoints

### Authentication Routes
- `POST /api/auth/register` - Register a new user with hashed credentials and issue a JWT.
- `POST /api/auth/login` - Authenticate registered user credentials and issue a session token.
- `POST /api/auth/social-login` - Synchronize OAuth/social profile data and return access tokens.
- `PATCH /api/users/profile` - Update user display name and profile picture (Protected).

### Event Management Routes
- `GET /api/events/recent` - Retrieve the top 6 upcoming events using MongoDB `.limit(6)` (Public).
- `GET /api/events` - Fetch all future upcoming events sorted chronologically (Public).
- `GET /api/events/:id` - Fetch comprehensive details for an individual event (Public).
- `POST /api/events` - Create a new event with mandatory future date validation (Protected).
- `GET /api/user/events` - Retrieve all events published by the authenticated user (Protected).
- `PATCH /api/events/:id` - Modify an event created by the current user (Protected, Author-Only).
- `DELETE /api/events/:id` - Delete an event and its participation records (Protected, Author-Only).

### Participation Routes
- `POST /api/events/:id/join` - Join an active community event (Protected).
- `GET /api/user/joined-events` - Fetch all events joined by the logged-in user sorted by date (Protected).

---

## Local Development Setup

### 1. Clone the repository
```bash
git clone [https://github.com/](https://github.com/)TSISabit/caresphere-server.git
cd caresphere-server