# Janseva — Government Certificate & Brokerage Service Platform

A mobile-first Next.js application for citizens to find help with government certificates and identity services. Built with Next.js App Router, Node.js route handlers, MongoDB, and Mongoose.

## Quick start

1. Install Node.js 20.19 or newer and start a local MongoDB server, or create a MongoDB Atlas database.
2. Create `.env.local` from `.env.example` if needed, then set `MONGODB_URI` and `JWT_SECRET` (at least 32 characters). The supplied local MongoDB and JWT settings are already saved in the ignored `.env.local` file.
3. Install dependencies and add the starter service catalog:

   ```bash
   npm install
   npm run seed
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Deployment configuration

Set these environment variables in the hosting provider before deploying:

- `MONGODB_URI`: a reachable MongoDB Atlas connection string or other production MongoDB URI. Do not use the example `127.0.0.1` URI for a hosted deployment. Ensure the database user has access and the host allows network access from the deployment.
- `JWT_SECRET`: a private random secret of at least 32 characters. Keep the same value across application instances and deployments so signed-in sessions remain valid.

Citizen registration and sign-in use an email address as the account identifier and a password. Email verification, OTP, and an email provider are not required. A MongoDB connection and `JWT_SECRET` are still required to create accounts and sessions. If registration or sign-in returns a configuration error, check the deployment logs and these environment variables, then redeploy.

## Included

- Responsive citizen workspace, searchable government service catalog, request history, and request submission.
- Service requests can be submitted as a guest without an account or email authentication; the confirmation provides a request reference, while request history and document downloads remain access-controlled. Citizen account registration also works without email verification or OTP; password-based login uses a signed HTTP-only JWT session. Agent registration is open, but agents need admin approval before accepting requests.
- MongoDB/Mongoose models for users, service listings, applications, uploaded documents, and request status history.
- Janseva data uses dedicated `janseva_*` MongoDB collections to avoid mixing records with other apps in a shared database.
- REST endpoints for authentication, service listings, citizen/agent/admin request access, agent verification, status changes, complaint escalation, and authorized document downloads.
- Private MongoDB document storage with random file identifiers, file-signature checks, PDF/JPG/PNG allow-listing, and a 10 MB per-file limit.
- Agent request acceptance uses an atomic claim so two agents cannot take the same request; request progress follows explicit status transitions.
- Admin workspace for service pricing and document guidance, agent verification, platform request metrics, and complaint resolution.
- Idempotent service catalog seed command (`npm run seed`).

The catalog includes Birth, Income, Caste, and Domicile certificates plus PAN and Aadhaar assistance. Displayed fees and estimated completion times are sample guidance and should be configured for the relevant state and authority before launch.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create a citizen account |
| `POST` | `/api/auth/agent-registration` | Apply for an agent account (pending verification) |
| `POST` | `/api/auth/login` / `/api/auth/logout` | Start or end a session |
| `GET` | `/api/auth/me` | Read the current session |
| `GET` | `/api/services` | List active services |
| `GET` / `POST` | `/api/requests` | List authorized requests or submit a guest or citizen request |
| `PATCH` | `/api/requests/:id` | Agent/admin status update; verified agents can accept unassigned requests |
| `POST` | `/api/requests/:id/documents` | Add authorized documents to an existing request |
| `GET` | `/api/requests/:id/documents/:documentId` | Download a request document if authorized |
| `GET` / `POST` | `/api/complaints` | Read permitted complaint history or submit a citizen complaint |
| `GET` / `PATCH` | `/api/admin/agents` | Admin agent review and verification |
| `GET` / `PATCH` | `/api/admin/services` | Admin service pricing, categories, and document guidance |
| `GET` / `PATCH` | `/api/admin/complaints` | Admin complaint triage, escalation, and resolution |

To bootstrap an administrator, create a user through registration and promote that account's `role` to `admin` in MongoDB using a trusted database administration tool. Do not expose an admin-registration endpoint.

## Production considerations

Uploaded file content is stored in a dedicated MongoDB collection and served only through per-request authorization checks. Configure database backups, malware scanning, and retention before production use. Replace the supplied development JWT signing key before production deployment. Agent earnings shown in the workspace are estimates based on completed assistance fees; payment processing and payouts are not included. Government fees and processing times vary by location; Janseva is an assistance service and does not issue government documents.
