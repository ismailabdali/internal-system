# IT Requests Standard Operating Procedure (SOP)

## Overview
This document describes the IT request workflow, routing rules, and role-based access control for the Internal System.

## IT Request Types & Categories

### Categories
1. **Support / Incident** - General IT support requests and incidents
2. **Devices & Materials** - Hardware and device requests
3. **Access & Permissions** - System access and permission requests
4. **Software / License** - Software installation and license requests

### Systems & Admin Roles

| System | Admin Role |
|--------|-----------|
| Microsoft 365 | IT_M365_ADMIN |
| Power BI Pro | IT_BI_ADMIN |
| Aconex | IT_ACONEX_ADMIN |
| Autodesk | IT_AUTODESK_ADMIN |
| Primavera P6 | IT_P6_ADMIN |
| RiskHive | IT_RISK_ADMIN |
| Devices & Email | IT_DEVICES_EMAIL_ADMIN |
| Super IT Admin | IT_ADMIN (oversees everything) |

## Routing Rules

### Request Assignment Logic

1. **Support / Incident**
   - Always assigned to: `IT_ADMIN`
   - System selection: Not applicable

2. **Devices & Materials**
   - Always assigned to: `IT_DEVICES_EMAIL_ADMIN`
   - System selection: Not applicable

3. **Access & Permissions**
   - If system selected: Assigned to corresponding system admin (e.g., M365 → IT_M365_ADMIN)
   - If no system selected: Assigned to `IT_ADMIN`

4. **Software / License**
   - If system selected: Assigned to corresponding system admin
   - If no system selected: Assigned to `IT_ADMIN`

## Visibility Rules

### IT_ADMIN (Super IT Admin)
- Can view **ALL** IT-related requests
- Can view onboarding parent requests and all children
- Can update any IT request
- Can update onboarding requests

### System Admins (IT_M365_ADMIN, IT_BI_ADMIN, etc.)
- Can view **ONLY** requests assigned to their role (`assigned_role = their_role`)
- Can view onboarding child requests assigned to them
- Can update requests assigned to their role
- Cannot view requests assigned to other system admins

### IT_DEVICES_EMAIL_ADMIN
- Can view **ONLY** requests assigned to `IT_DEVICES_EMAIL_ADMIN`
- Can view onboarding email and device child requests
- Can update requests assigned to their role

### Normal Employees
- Can view **ONLY** their own requests (filtered by `employee_id`)

## Request Completion

### Direct Completion
- System admins and devices/email admin can mark their assigned requests as **COMPLETED** directly
- No additional approval chain required
- Action history is logged in `request_actions` table

### Workflow Status
- IT requests follow workflow: `SUBMITTED` → `TRIAGE` → `IN_PROGRESS` → `COMPLETED`
- Status automatically maps to workflow step

## Data Model

### Requests Table Fields
- `type`: 'IT'
- `assigned_role`: Determined by routing rules
- `system_key`: System identifier (e.g., 'M365', 'P6') - nullable
- `request_scope`: 'IT' for IT requests

### IT Requests Table
- `category`: Request category
- `system_name`: Human-readable system name (legacy field)
- `impact`: Impact level
- `urgency`: Urgency level
- `asset_tag`: Asset identifier

## Example Scenarios

### Scenario 1: Employee requests Microsoft 365 access
1. Employee creates IT request
2. Category: "Access & Permissions"
3. System: "Microsoft 365" (systemKey: 'M365')
4. Request assigned to: `IT_M365_ADMIN`
5. IT_M365_ADMIN sees request in their list
6. IT_M365_ADMIN completes request → Status: COMPLETED

### Scenario 2: Employee requests device
1. Employee creates IT request
2. Category: "Devices & Materials"
3. Request assigned to: `IT_DEVICES_EMAIL_ADMIN`
4. IT_DEVICES_EMAIL_ADMIN sees request
5. IT_DEVICES_EMAIL_ADMIN completes request

### Scenario 3: Employee reports incident (no system)
1. Employee creates IT request
2. Category: "Support / Incident"
3. Request assigned to: `IT_ADMIN`
4. IT_ADMIN sees request and handles it

## Notes
- All IT requests are stored in the `requests` table with `type = 'IT'`
- System admins only see requests assigned to their specific role
- IT_ADMIN has visibility into all IT requests for oversight
- Request actions are logged for audit trail

