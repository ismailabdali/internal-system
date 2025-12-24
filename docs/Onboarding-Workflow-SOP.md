# Onboarding Workflow Standard Operating Procedure (SOP)

## Overview
This document describes the onboarding workflow that starts in HR and fans out to IT sub-approvals for systems, email, and devices.

## Workflow Overview

The onboarding process creates a **parent request** with multiple **child requests** that are automatically assigned to the appropriate IT admins.

## Workflow Lifecycle

### Parent Onboarding Request States

1. **HR_SUBMITTED** - Created by HR Admin
2. **IT_IN_PROGRESS** - Handed to IT (when children are created)
3. **WAITING_APPROVALS** - System/email/device approvals pending (implicit state)
4. **COMPLETED** - Auto-completed when all children are completed

## Who Can Create Onboarding

- **HR_ADMIN** - Can create onboarding requests
- **SUPER_ADMIN** - Can create onboarding requests

## Onboarding Requirements

When HR creates an onboarding request, they specify:

1. **Email Needed** (checkbox)
   - Creates child request: `ONBOARDING_EMAIL`
   - Assigned to: `IT_DEVICES_EMAIL_ADMIN`

2. **Device Needed** (checkbox)
   - Creates child request: `ONBOARDING_DEVICE`
   - Assigned to: `IT_DEVICES_EMAIL_ADMIN`
   - Requires device type selection

3. **Systems Requested** (multi-select)
   - Creates one child request per selected system
   - Child type: `ONBOARDING_SYSTEM`
   - Assigned to: Corresponding system admin role
   - Available systems:
     - Microsoft 365 → IT_M365_ADMIN
     - Power BI Pro → IT_BI_ADMIN
     - Aconex → IT_ACONEX_ADMIN
     - Autodesk → IT_AUTODESK_ADMIN
     - Primavera P6 → IT_P6_ADMIN
     - RiskHive → IT_RISK_ADMIN

## Child Request Types

### ONBOARDING_EMAIL
- **Type**: `ONBOARDING_EMAIL`
- **Assigned Role**: `IT_DEVICES_EMAIL_ADMIN`
- **Purpose**: Email account setup
- **Parent**: Links to parent onboarding request via `parent_request_id`

### ONBOARDING_DEVICE
- **Type**: `ONBOARDING_DEVICE`
- **Assigned Role**: `IT_DEVICES_EMAIL_ADMIN`
- **Purpose**: Device setup and configuration
- **Parent**: Links to parent onboarding request

### ONBOARDING_SYSTEM
- **Type**: `ONBOARDING_SYSTEM`
- **Assigned Role**: System-specific admin (e.g., IT_M365_ADMIN)
- **Purpose**: System access provisioning
- **Parent**: Links to parent onboarding request
- **System Key**: Stored in `system_key` field

## Auto-Complete Logic

### When a Child Completes
1. System admin or devices/email admin marks their child request as **COMPLETED**
2. System checks if all children of the parent are completed
3. If all children are completed:
   - Parent onboarding request automatically updates to:
     - `status`: COMPLETED
     - `workflow_status`: COMPLETED
     - `current_step`: COMPLETED
   - Action is logged in `request_actions` table

### Completion Requirements
- All required child requests must be COMPLETED:
  - Email child (if email_needed = true)
  - Device child (if device_needed = true)
  - All system children (one per selected system)

## Visibility Rules

### HR_ADMIN
- Can view onboarding **parent requests** (`type = 'ONBOARDING'` AND `parent_request_id IS NULL`)
- Can create onboarding requests
- Cannot directly view children (but can see them when viewing parent details)

### IT_ADMIN (Super IT Admin)
- Can view **ALL** onboarding requests (parent + all children)
- Can view and update any onboarding request
- Has full visibility for oversight

### System Admins (IT_M365_ADMIN, etc.)
- Can view **ONLY** onboarding system children assigned to their role
- Can view requests where `assigned_role = their_role` AND `type = 'ONBOARDING_SYSTEM'`
- Can complete their assigned system children
- Cannot see other system children or parent directly

### IT_DEVICES_EMAIL_ADMIN
- Can view **ONLY** onboarding email and device children assigned to their role
- Can view requests where `assigned_role = 'IT_DEVICES_EMAIL_ADMIN'` AND `type IN ('ONBOARDING_EMAIL', 'ONBOARDING_DEVICE')`
- Can complete their assigned email/device children

### Normal Employees
- Cannot create onboarding requests
- Cannot view onboarding requests (unless they created it, which shouldn't happen)

## Data Model

### Parent Onboarding Request
- `type`: 'ONBOARDING'
- `assigned_role`: 'IT_ADMIN' (for coordination)
- `workflow_status`: 'HR_SUBMITTED' → 'IT_IN_PROGRESS' → 'COMPLETED'
- `request_scope`: 'ONBOARDING'
- `parent_request_id`: NULL

### Child Requests
- `type`: 'ONBOARDING_EMAIL', 'ONBOARDING_DEVICE', or 'ONBOARDING_SYSTEM'
- `assigned_role`: Specific admin role (IT_DEVICES_EMAIL_ADMIN or system admin)
- `parent_request_id`: ID of parent onboarding request
- `system_key`: System identifier (for ONBOARDING_SYSTEM only)
- `request_scope`: 'ONBOARDING'

### Onboarding Requests Table
- `request_id`: Links to parent request
- `email_needed`: INTEGER (0 or 1)
- `device_needed`: INTEGER (0 or 1)
- `systems_json`: JSON array of system keys (e.g., ["M365", "P6"])
- Standard fields: employee_name, position, department, location, start_date, device_type, vpn_required, notes

## Example Workflow

### Scenario: HR creates onboarding with Email + Device + M365 + P6

1. **HR Admin creates onboarding**
   - Employee: John Doe
   - Email Needed: ✓
   - Device Needed: ✓ (Device: Business Laptop)
   - Systems: Microsoft 365, Primavera P6
   - Parent request created: `type = 'ONBOARDING'`, `status = 'IN_PROGRESS'`, `workflow_status = 'IT_IN_PROGRESS'`

2. **System creates child requests** (atomically in transaction)
   - Child 1: `ONBOARDING_EMAIL` → assigned to `IT_DEVICES_EMAIL_ADMIN`
   - Child 2: `ONBOARDING_DEVICE` → assigned to `IT_DEVICES_EMAIL_ADMIN`
   - Child 3: `ONBOARDING_SYSTEM` (M365) → assigned to `IT_M365_ADMIN`
   - Child 4: `ONBOARDING_SYSTEM` (P6) → assigned to `IT_P6_ADMIN`

3. **Admins see their assigned children**
   - `devices@housing.gov.om` sees: Email child, Device child
   - `m365@housing.gov.om` sees: M365 system child
   - `p6@housing.gov.om` sees: P6 system child
   - `it@housing.gov.om` sees: Parent + all children

4. **Admins complete their children**
   - Devices admin completes Email child → Status: COMPLETED
   - Devices admin completes Device child → Status: COMPLETED
   - M365 admin completes M365 child → Status: COMPLETED
   - P6 admin completes P6 child → Status: COMPLETED

5. **Parent auto-completes**
   - System detects all children are COMPLETED
   - Parent automatically updates: `status = 'COMPLETED'`, `workflow_status = 'COMPLETED'`
   - Onboarding workflow complete!

## API Endpoints

### Create Onboarding
- **Endpoint**: `POST /api/onboarding`
- **Required Role**: HR_ADMIN or SUPER_ADMIN
- **Request Body**:
  ```json
  {
    "employeeName": "John Doe",
    "position": "Engineer",
    "startDate": "2024-01-15",
    "emailNeeded": true,
    "deviceNeeded": true,
    "deviceType": "Business Laptop",
    "systemsRequested": ["M365", "P6"],
    "vpnRequired": false,
    "notes": "Standard setup"
  }
  ```
- **Response**: Returns parent request with `childRequests` array

### View Onboarding Details
- **Endpoint**: `GET /api/requests/:id`
- **For Parent**: Returns `children` array with all child requests
- **For Child**: Returns `parent` object with parent request details

### Complete Child Request
- **Endpoint**: `PATCH /api/requests/:id/status`
- **Body**: `{ "status": "COMPLETED" }`
- **Auto-triggers**: Parent completion check

## Notes
- All child requests are created atomically in a single transaction
- Parent cannot be manually completed - only auto-completes when all children are done
- IT_ADMIN has full visibility for oversight and coordination
- System admins work independently on their assigned children
- Action history is maintained for audit trail

