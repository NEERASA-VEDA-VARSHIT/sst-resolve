# SST Resolve v2.1 - Implementation Plan

## 📋 PRD Summary
WhatsApp-first support ecosystem with escalation, rating, and advanced admin features.

## 🎯 Implementation Phases

### Phase 1: Foundation & Schema ✅ (In Progress)
- [x] Update database schema with escalation, rating, ticket limits
- [ ] Generate and apply migration
- [ ] Add "awaiting_student_response" status support
- [ ] Add comment types (internal_note vs student_visible)

### Phase 2: Student Features
- [ ] Reply restriction (only when status = "awaiting_student_response")
- [ ] Escalation UI and logic
- [ ] Rating system (1-10 scale, blocker for new tickets)
- [ ] Red nudge indicator on dashboard for active queries
- [ ] Happy/Unhappy feedback after resolution

### Phase 3: Admin Features
- [ ] "Ask Question" → sets status to "awaiting_student_response"
- [ ] Internal notes (team-only) vs student-facing comments
- [ ] Super admin notes (highlighted)
- [ ] Reassignment functionality with Slack updates
- [ ] Category-wise ticket counters on admin dashboard
- [ ] Escalation tracking component for super admin
- [ ] Auto-escalation after n days of inactivity

### Phase 4: WhatsApp Integration
- [ ] Enhance WhatsApp bot with new features
- [ ] WhatsApp notifications for ticket updates
- [ ] Dashboard link in WhatsApp messages

### Phase 5: Advanced Features
- [ ] Ticket limits enforcement (3/week per user)
- [ ] Auto-escalation on Slack when no response in x days
- [ ] SLA reminders and countdowns
- [ ] Escalation counter and tracking UI

## 🚀 Current Status
Starting Phase 1 - Database schema updated, migration generated.

