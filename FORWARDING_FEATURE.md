# Forwarding Feature Implementation

## Overview
Added a new **"Forward"** feature that is separate from **"Escalate"**. This allows admins to send tickets to the next level admin without marking them as escalated.

## Key Differences

### Escalate
- **Purpose**: Urgent issues requiring immediate attention
- **Behavior**: 
  - Increments `escalation_level`
  - Changes status to `ESCALATED`
  - Notifies super admins
  - Creates urgency flag
- **Use Case**: Critical issues, SLA breaches, complex problems

### Forward
- **Purpose**: Normal workflow progression to higher authority
- **Behavior**:
  - Reassigns to next level admin (senior_admin or super_admin)
  - Does NOT change status to ESCALATED
  - Does NOT increment escalation_level
  - Maintains current ticket status
- **Use Case**: Requires approval, beyond current admin's scope, needs senior review

## Implementation Details

### API Endpoint
- **Path**: `/api/tickets/[id]/forward`
- **Method**: POST
- **Auth**: Admin only
- **Body**: 
  ```json
  {
    "reason": "Optional reason for forwarding",
    "targetAdminId": 123 // Optional: manually specify target
  }
  ```

### Auto-Assignment Logic
1. Finds current admin's domain
2. Looks for senior_admin or super_admin in same domain
3. Priority: senior_admin > super_admin
4. Falls back to any super_admin if none found in domain

### UI Changes
- Added "Forward" button in AdminActions component
- Icon: ArrowUpRight (↗)
- Positioned between "Reassign" and "Escalate"
- Dialog with optional reason field

## Files Modified
1. `src/app/api/tickets/[id]/forward/route.ts` - New API endpoint
2. `src/components/tickets/AdminActions.tsx` - Added Forward button and handler

## Usage
1. Admin opens a ticket
2. Clicks "Forward" button
3. Optionally enters reason
4. System finds next level admin
5. Ticket is reassigned
6. Notification sent via outbox event

## Benefits
- Clear separation between normal workflow and urgent escalation
- Maintains ticket status during reassignment
- Preserves escalation tracking for true emergencies
- Better workflow management
