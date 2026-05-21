# Package CRUD API Documentation

> **IMPORTANT**: This module handles **customer package creation & management only** (CRUD operations). Driver assignment, delivery tracking, and driver-side operations will be implemented in a separate **Delivery Module** in the future.

---

## Overview

The Packages module provides a complete CRUD system for customers to create, manage, and submit delivery packages. The workflow follows these status transitions:

```
DRAFT → PENDING → ASSIGNED → IN_TRANSIT → DELIVERED
  ↓
CANCELLED (from DRAFT or PENDING)
  ↓
FAILED (from IN_TRANSIT)
```

**Current Focus**: DRAFT, PENDING, CANCELLED (customer-side operations only)

---

## Data Models

### Package Status Values

| Status | Description | Editable | Deletable |
|--------|-------------|----------|-----------|
| `DRAFT` | Initial state, not yet submitted | ✅ | ✅ |
| `PENDING` | Submitted, waiting for driver | ❌ | ❌ |
| `ASSIGNED` | Driver assigned (future) | ❌ | ❌ |
| `IN_TRANSIT` | Driver picked up (future) | ❌ | ❌ |
| `DELIVERED` | Completed (future) | ❌ | ❌ |
| `CANCELLED` | Cancelled by customer | ❌ | ❌ |
| `FAILED` | Delivery failed (future) | ❌ | ❌ |

### Vehicle Types

- `MOTORCYCLE` — Small parcels, documents
- `TUKTUKT` — Medium packages
- `CAR` — Larger packages
- `TRUCK` — Heavy items

### Package Types

- `DOCUMENT` — Papers, contracts, etc.
- `FRAGILE` — Glass, ceramics (requires care)
- `FOOD` — Meals, groceries (time-sensitive)
- `ELECTRONICS` — Phones, gadgets (sensitive)
- `CLOTHING` — Apparel, textiles
- `OTHER` — Miscellaneous

### Payment Methods

- `CASH` — Pay on delivery
- `ABA_QR` — Khmer banking transfer
- `MOBILE_BANKING` — Mobile app payment

### Payer Options

- `SENDER` — Customer pays (prepaid or on pickup)
- `RECIPIENT` — Recipient pays on delivery

---

## API Endpoints

### 1. Create Package
```
POST /api/v1/packages
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "vehicleType": "MOTORCYCLE",
  "items": [
    {
      "name": "Documents",
      "type": "DOCUMENT",
      "quantity": 1,
      "note": "Handle carefully, contains contracts"
    }
  ],
  "pickup": {
    "location": {
      "address": "Tuol Kork, Phnom Penh",
      "latitude": 11.573,
      "longitude": 104.89
    },
    "contact": {
      "name": "John Sender",
      "phone": "+85512345678"
    },
    "scheduledAt": "2026-05-18T10:00:00Z"
  },
  "dropoff": {
    "location": {
      "address": "Sen Sok, Phnom Penh",
      "latitude": 11.62,
      "longitude": 104.88
    },
    "contact": {
      "name": "David Recipient",
      "phone": "+85598765432"
    }
  },
  "payment": {
    "payer": "SENDER",
    "method": "CASH",
    "estimatedCost": 5.50
  },
  "notes": "Please call upon arrival"
}
```

**Response (201 Created):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "senderId": "507f1f77bcf86cd799439010",
  "vehicleType": "MOTORCYCLE",
  "items": [...],
  "pickup": {...},
  "dropoff": {...},
  "payment": {
    "payer": "SENDER",
    "method": "CASH",
    "estimatedCost": 5.50,
    "actualCost": null,
    "isPaid": false
  },
  "status": "DRAFT",
  "assignedDriverId": null,
  "notes": "Please call upon arrival",
  "createdAt": "2026-05-18T08:30:00Z",
  "updatedAt": "2026-05-18T08:30:00Z"
}
```

**Validation Rules:**
- All fields are required except `notes` and optional nested fields
- At least 1 item must be provided
- `scheduledAt` must be a future date/time
- Coordinates must be valid (lat: -90 to 90, lng: -180 to 180)
- Cambodian phone numbers format required

---

### 2. Get All Packages (for current user)
```
GET /api/v1/packages?page=1&limit=20&status=DRAFT&sortBy=createdAt&order=desc
Authorization: Bearer <token>
```

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 20 | Items per page (max: 100) |
| `status` | string | - | Filter by status (DRAFT, PENDING, etc.) |
| `sortBy` | string | createdAt | Field to sort by |
| `order` | string | desc | Sort order: asc or desc |

**Response (200 OK):**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "status": "DRAFT",
      ...
    }
  ],
  "total": 42,
  "page": 1
}
```

---

### 3. Get Single Package
```
GET /api/v1/packages/:id
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "senderId": "507f1f77bcf86cd799439010",
  "status": "DRAFT",
  ...full package object...
}
```

**Errors:**
- `400` — Invalid package ID format
- `404` — Package not found
- `403` — Not authorized (only sender can view)

---

### 4. Update Package
```
PATCH /api/v1/packages/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body (all fields optional):**
```json
{
  "vehicleType": "CAR",
  "items": [
    {
      "name": "Updated items",
      "type": "FRAGILE",
      "quantity": 2
    }
  ],
  "pickup": {
    "location": { "address": "...", "latitude": 11.57, "longitude": 104.89 },
    "contact": { "name": "John", "phone": "+85512345678" },
    "scheduledAt": "2026-05-19T14:00:00Z"
  },
  "payment": {
    "payer": "RECIPIENT",
    "method": "ABA_QR",
    "estimatedCost": 7.00
  },
  "notes": "Updated instructions"
}
```

**Constraints:**
- ❌ Can ONLY update packages in `DRAFT` status
- ✅ Partial updates supported
- ✅ Can update any field

**Response (200 OK):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "status": "DRAFT",
  ...updated package...
}
```

---

### 5. Delete Package
```
DELETE /api/v1/packages/:id
Authorization: Bearer <token>
```

**Constraints:**
- ❌ Can ONLY delete packages in `DRAFT` status
- ✅ Once submitted (PENDING), deletion blocked

**Response (204 No Content)** (empty body)

**Errors:**
- `400` — Invalid package ID or wrong status
- `404` — Package not found
- `403` — Not authorized (only sender can delete)

---

### 6. Submit Package for Delivery
```
POST /api/v1/packages/:id/submit
Authorization: Bearer <token>
```

**Purpose:**
- Officially request a driver
- Changes status from `DRAFT` → `PENDING`
- Package becomes immutable after submission

**Constraints:**
- ✅ Must be in `DRAFT` status
- ✅ Triggers matching system (future driver assignment)

**Response (200 OK):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "status": "PENDING",
  ...package object...
}
```

---

### 7. Cancel Package
```
POST /api/v1/packages/:id/cancel
Authorization: Bearer <token>
```

**Purpose:**
- Cancel delivery request
- Changes status to `CANCELLED`
- Refund eligibility (future feature)

**Constraints:**
- ✅ Can cancel `DRAFT` or `PENDING` packages
- ❌ Cannot cancel once ASSIGNED or IN_TRANSIT

**Response (200 OK):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "status": "CANCELLED",
  ...package object...
}
```

---

## Workflow Example

### Scenario: Customer ordering a delivery

```
1. CREATE (DRAFT)
   POST /api/v1/packages
   → Customer fills in all details, not yet submitted
   → Status: DRAFT (editable, deletable)

2. EDIT (DRAFT)
   PATCH /api/v1/packages/{id}
   → Customer changes pickup time or vehicle type
   → Status: DRAFT (still editable)

3. SUBMIT (DRAFT → PENDING)
   POST /api/v1/packages/{id}/submit
   → Customer confirms and requests driver
   → Status: PENDING (immutable, not deletable)
   → System looks for available drivers (future)

4. DRIVER ACCEPTS (future)
   → Status: ASSIGNED

5. PICKUP (future)
   → Status: IN_TRANSIT

6. DELIVERY (future)
   → Status: DELIVERED
```

### Scenario: Customer cancels

```
1. CREATE (DRAFT)
   POST /api/v1/packages

2. CANCEL (DRAFT → CANCELLED)
   POST /api/v1/packages/{id}/cancel
   → Status: CANCELLED
   → Can be used for refund/audit tracking (future)
```

---

## Error Responses

All errors follow NestJS standard format:

```json
{
  "statusCode": 400,
  "message": "Description of error",
  "error": "Bad Request"
}
```

### Common Errors

| Status | Message | Cause |
|--------|---------|-------|
| 400 | Invalid package ID | Malformed MongoDB ObjectId |
| 400 | Pickup scheduled time must be in the future | Scheduled date is in the past |
| 400 | Cannot update package in PENDING status | Trying to edit submitted package |
| 400 | Cannot delete package in PENDING status | Trying to delete submitted package |
| 400 | Only DRAFT packages can be submitted | Already submitted or delivered |
| 404 | Package not found | ID doesn't exist |
| 403 | You do not have permission to view this package | Not the sender |
| 403 | You do not have permission to update this package | Not the sender |

---

## Database Schema

### Package Document Structure

```typescript
{
  _id: ObjectId,
  senderId: ObjectId (ref: User),
  
  vehicleType: enum[MOTORCYCLE, TUKTUKT, CAR, TRUCK],
  
  items: [{
    name: string,
    type: enum[DOCUMENT, FRAGILE, FOOD, ELECTRONICS, CLOTHING, OTHER],
    quantity: number,
    note?: string
  }],
  
  pickup: {
    location: {
      address: string,
      latitude: number,
      longitude: number
    },
    contact: {
      name: string,
      phone: string
    },
    scheduledAt: Date,
    actualPickupAt?: Date
  },
  
  dropoff: {
    location: {
      address: string,
      latitude: number,
      longitude: number
    },
    contact: {
      name: string,
      phone: string
    },
    estimatedDeliveryAt?: Date,
    actualDeliveryAt?: Date
  },
  
  payment: {
    payer: enum[SENDER, RECIPIENT],
    method: enum[CASH, ABA_QR, MOBILE_BANKING],
    estimatedCost?: number,
    actualCost?: number,
    isPaid: boolean
  },
  
  status: enum[DRAFT, PENDING, ASSIGNED, IN_TRANSIT, DELIVERED, CANCELLED, FAILED],
  assignedDriverId?: ObjectId (ref: User),
  notes?: string,
  
  createdAt: Date,
  updatedAt: Date
}
```

---

## Indexes for Performance

```
✓ { senderId: 1, createdAt: -1 }  — List user's packages
✓ { status: 1 }                    — Filter by status
✓ { assignedDriverId: 1 }          — Find by driver (future)
```

---

## Future Extensions

This module is designed to be extended:

1. **Delivery Module** — Driver assignment, GPS tracking, delivery confirmation
2. **Pricing Module** — Dynamic cost calculation based on distance, weight, urgency
3. **Rating Module** — Customer & driver reviews
4. **Payment Processing** — ABA QR, mobile banking integration
5. **Notifications** — SMS/Email updates for drivers and customers
6. **Analytics** — Delivery statistics, performance metrics

---

## Implementation Notes

### Why DRAFT Status?

Separates "preparation" from "submission":
- **DRAFT**: Customer preparing, can edit/delete freely
- **PENDING**: Official request sent, immutable for consistency with potential driver matches

### Authorization Strategy

- Only **sender** can view/edit/delete their packages
- Uses `JwtAuthGuard` for all endpoints
- `senderId` auto-populated from `CurrentUser` decorator

### Validation Approach

- **DTOs** with `class-validator` for input validation
- **Service layer** for business logic validation
- **Coordinate validation** ensures valid lat/lng ranges
- **Time validation** ensures future pickup dates

### Separation of Concerns

```
Controller   → HTTP handling, auth guards
Service      → Business logic, validation, DB queries
Schema       → Data structure definition
DTO          → Input/output validation
```

---

## Testing the API

### 1. Create a package
```bash
curl -X POST http://localhost:3000/api/v1/packages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleType": "MOTORCYCLE",
    "items": [{"name": "Docs", "type": "DOCUMENT", "quantity": 1}],
    "pickup": {...},
    "dropoff": {...},
    "payment": {...}
  }'
```

### 2. List your packages
```bash
curl http://localhost:3000/api/v1/packages \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Update a package
```bash
curl -X PATCH http://localhost:3000/api/v1/packages/:id \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vehicleType": "CAR"}'
```

### 4. Submit for delivery
```bash
curl -X POST http://localhost:3000/api/v1/packages/:id/submit \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## File Structure

```
src/modules/packages/
├── packages.controller.ts    — API endpoints
├── packages.service.ts       — Business logic & CRUD
├── packages.module.ts        — Module setup
└── dto/
    └── create-package.dto.ts — Request/response validation

src/shared/schemas/
└── package.schema.ts         — MongoDB schema & enums
```

---

**Last Updated**: May 18, 2026  
**Version**: 1.0.0  
**Status**: Ready for Production
