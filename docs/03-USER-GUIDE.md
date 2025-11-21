# SST-Resolve: User Guide

## 📖 Table of Contents

1. [Getting Started](#getting-started)
2. [Student Guide](#student-guide)
3. [Admin Guide](#admin-guide)
4. [Super Admin Guide](#super-admin-guide)
5. [FAQ](#faq)

---

## 🚀 Getting Started

### Accessing the System

1. Navigate to the SST-Resolve URL (provided by your institution)
2. Click **"Sign In"** / **"Get Started"**
3. Sign in using your institutional email or OAuth provider
4. Complete your profile (if first-time user)

### First-Time Setup

**For Students:**
- Your profile is auto-created from CSV import
- Verify your details (roll number, hostel, room, etc.)
- You can immediately start creating tickets

**For Admins:**
- Contact super admin to assign your role
- Specify your domain (Hostel/College) and scope (specific area)
- You'll see tickets assigned to your domain/scope

---

## 👨‍🎓 Student Guide

### Creating a Ticket

1. **Navigate to Dashboard**
   - Click **"New Ticket"** button (top-right)
   - Or go directly to `/student/dashboard/ticket/new`

2. **Select Category**
   - Choose main category (e.g., Hostel, Food, Academics)
   - Select subcategory (e.g., Maintenance, Room Issue)
   - Pick sub-subcategory if applicable

3. **Fill Details**
   - **Title**: Brief, descriptive (e.g., "Broken ceiling fan in Room 204")
   - **Description**: Detailed explanation of the issue
   - **Location**: Auto-filled or manual entry
   - **Category-Specific Fields**: 
     - Room number (for hostel issues)
     - Course name (for academic queries)
     - Date of incident, etc.

4. **Attach Files** (Optional)
   - Click **"Upload"** button
   - Supported formats: Images (JPG, PNG), Documents (PDF)
   - Max size: 4MB per file
   - Max files: 5

5. **Review & Submit**
   - Check all information
   - Click **"Submit Ticket"**
   - Note the **Ticket ID** (e.g., #1234)

### Tracking Your Tickets

**Dashboard View:**
- **All Tickets**: See all your tickets
- **Active Status**: Color-coded badges
  - 🟡 **Open**: Not yet acknowledged
  - 🔵 **In Progress**: Admin is working on it
  - 🟠 **Awaiting Student**: Admin needs your input
  - 🔴 **Escalated**: Moved to higher authority
  - ✅ **Resolved**: Issue fixed

**Filters & Search:**
- **Status Filter**: Show only open/resolved/etc.
- **Category Filter**: Filter by category
- **Date Range**: Find tickets from specific period
- **Search**: Search by title/description
- **Sort By**: Newest, oldest, recently updated

### Viewing Ticket Details

Click on any ticket to see:
- **Full Description**: Complete issue details
- **Status Timeline**: Visual progress tracker
- **Assigned Admin**: Who's handling your ticket
- **Expected TAT**: When it should be resolved
- **Comments**: Communication thread
- **Attachments**: Your uploaded files
- **Activity Log**: All updates and changes

### Responding to Admin

When admin requests information (status: **Awaiting Student**):
1. Open the ticket
2. Scroll to **"Comments"** section
3. Type your response
4. Click **"Add Comment"**
5. Status automatically changes back to **"In Progress"**

### Rating & Feedback

After ticket is resolved:
1. You'll see a **"Rate this resolution"** prompt
2. Give a star rating (1-5 stars)
3. Provide optional written feedback
4. Click **"Submit Feedback"**
5. This helps improve service quality

### Reopening a Ticket

If issue persists after resolution:
1. Open the resolved ticket
2. Click **"Reopen Ticket"** button
3. Explain why it needs reopening
4. Ticket status changes to **"Reopened"**
5. Admin is notified

### Best Practices for Students

✅ **DO:**
- Be specific in title and description
- Include all relevant details upfront
- Attach photos/documents when helpful
- Respond promptly to admin questions
- Rate tickets after resolution

❌ **DON'T:**
- Create duplicate tickets for same issue
- Use abusive or inappropriate language
- Spam with unnecessary updates
- Expect instant resolution (check TAT)
- Share sensitive info (passwords, etc.)

---

## 👨‍💼 Admin Guide

### Dashboard Overview

**Main Sections:**
1. **My Tickets**: Tickets assigned to you
2. **Today Pending**: Urgent tickets due today
3. **Escalated**: Tickets requiring attention
4. **Analytics**: Your performance metrics

**Key Metrics:**
- Total tickets assigned
- Open tickets count
- In-progress count
- Resolution rate
- Average response time

### Managing Tickets

**Acknowledging a Ticket:**
1. Open new ticket from **"My Tickets"** list
2. Review details thoroughly
3. Click **"Acknowledge"** button
4. Set expected TAT (if not auto-set)
5. Status changes to **"In Progress"**

**Updating Status:**
- **Awaiting Student**: When you need more info
  - Add comment explaining what's needed
  - Student gets notification
- **In Progress**: Actively working on it
- **Escalated**: Send to higher authority
  - Specify escalation reason
  - Select escalation level
- **Resolved**: Issue is fixed
  - Add resolution notes
  - Student can rate and provide feedback

**Adding Comments:**
1. Open ticket
2. Scroll to comments section
3. Type your message
4. Choose visibility:
   - **Student Visible**: Student can see
   - **Internal Note**: Admin-only
5. Click **"Add Comment"**

**Assigning to Others:**
1. Open ticket
2. Click **"Reassign"** button
3. Select admin from dropdown (filtered by domain/scope)
4. Add reassignment reason
5. Confirm

### Filtering & Search

**Quick Filters:**
- **Status**: All, Open, In Progress, Resolved
- **Category**: Filter by ticket category
- **Location**: Filter by hostel/building
- **TAT**: Due today, upcoming, overdue
- **Escalated**: Show only escalated tickets

**Advanced Search:**
- Search by ticket ID
- Search by student name/roll number
- Date range filtering
- Combined filters

**Sorting Options:**
- Newest first
- Oldest first
- Due date (urgent first)
- Status priority

### Today's Pending View

Shows tickets requiring immediate attention:
- Tickets with TAT due today
- **Overdue** tickets highlighted in red
- Sorted by urgency (overdue first)

**Action Items:**
1. Address overdue tickets immediately
2. Update status if work is in progress
3. Request extension if needed (notify super admin)

### Escalation Management

**When to Escalate:**
- Issue beyond your authority/expertise
- Requires policy decision
- Needs higher budget approval
- Persistent unresolved issue

**How to Escalate:**
1. Open ticket
2. Click **"Escalate"** button
3. Select escalation level (1-3)
4. Explain reason for escalation
5. System auto-assigns to next level admin
6. Original admin is still notified of updates

**Escalation Levels:**
- **Level 1**: Senior admin in same domain
- **Level 2**: Domain head/ Department head
- **Level 3**: Super admin / Institutional authority

### Bulk Operations (Groups)

For related tickets (e.g., WiFi outage affecting many students):
1. Go to **"Groups"** page
2. Click **"Create Group"**
3. Name the group (e.g., "Block-A WiFi Outage")
4. Select tickets to group
5. Update all at once:
   - Single status change applies to all
   - Single comment broadcasts to all
   - Efficient for mass issues

### Analytics Dashboard

**Personal Metrics:**
- Tickets assigned this week/month
- Resolution rate
- Average resolution time
- Student satisfaction rating
- Status distribution

**Insights:**
- Trending categories (common issues)
- Peak hours (when mosttickets come)
- Resolution patterns
- Performance trends

### Best Practices for Admins

✅ **DO:**
- Acknowledge tickets within SLA
- Communicate clearly with students
- Update ticket status regularly
- Escalate when truly needed
- Document resolution steps
- Close tickets promptly

❌ **DON'T:**
- Ignore assigned tickets
- Reassign without valid reason
- Mark resolved without confirmation
- Use internal notes for student-facing info
- Let tickets breach TAT repeatedly

---

## 👑 Super Admin Guide

### System Configuration

#### Managing ticket Statuses
**Location**: `/superadmin/settings/ticket-statuses`

1. **View All Statuses**
   - See complete list with progress %, colors
   - Active/inactive flag
   - Final state designation

2. **Create New Status**
   - Click **"Add Status"**
   - Fill form:
     - **Value**: `ON_HOLD` (uppercase, no spaces, permanent)
     - **Label**: `On Hold` (display name, editable)
     - **Description**: Optional explanation
     - **Progress %**: 0-100
     - **Badge Color**: default/secondary/destructive/outline
     - **Active**: Show in UI?
     - **Final**: Terminal state?
   - Click **"Create"**

3. **Edit Status**
   - Click pencil icon
   - Modify any field except `value`
   - Click **"Update"**

4. **Delete Status**
   - Click trash icon
   - **WARNING**: Can only delete if zero tickets use it
   - System shows ticket count before deletion
   - Confirm deletion

5. **Reorder Statuses**
   - Use up/down arrows
   - Changes dropdown order across entire app

#### Managing Categories

1. **Create Category**
   - Name, slug, description
   - Icon & color for UI
   - Assign default POC/admin
   - Set SLA hours

2. **Configure Subcategories**
   - Add subcategories under each category
   - Assign specific admin if different from parent

3. **Define Custom Fields**
   - Add fields specific to subcategory
   - Field types: text, number, date, select, boolean
   - Set as required/optional
   - Define validation rules

4. **Profile Field Configuration**
   - Choose which student fields to collect per category
   - Make fields editable/read-only

### User & Role Management

#### Assigning Roles

1. **Navigate to User Management**
2. **Select User** (by email/name)
3. **Assign Role**:
   - Student
   - Admin (POC)
   - Senior Admin
   - Super Admin
   - Committee Member
4. **Set Domain & Scope** (for admins):
   - Domain: `Hostel` or `College`
   - Scope: `Neeladri`, `Computer Science`, etc.
5. **Save Assignment**

#### Managing Staff

1. **Add Staff Member**
   - Import from Clerk
   - Set domain/scope
   - Assign default categories

2. **Configure Escalation Rules**
   - Define escalation chain
   - Set escalation levels per domain
   - Assign staff to each level

### Data Management

#### Student CSV Import  

1. Navigate to **"Import Students"**
2. Download template CSV
3. Fill with student data:
   - Roll number (required, unique)
   - Name, email
   - Hostel, room number
   - Class section, batch
4. Upload CSV
5. Review mapping
6. Click **"Import"**
7. System creates user accounts automatically

#### Bulk Operations

- Export tickets to CSV
- Bulk status updates
- Mass reassignment
- Archive old tickets

### System Analytics

**Global Dashboard:**
- Total tickets (all time, this week, today)
- Resolution rate across all admins
- Average TAT by category
- Top-performing admins
- Most common issues
- Student satisfaction scores

**Reports:**
- Domain-wise breakdown
- Category performance
- Time-series analysis
- Export to CSV/PDF

### System Settings

#### Notification Configuration
- Email templates
- Slack webhook URLs
- Notification frequency
- Escalation reminders

#### SLA Rules
- Default SLAs per category
- Auto-escalation thresholds
- Extension approval workflow

#### Rate Limiting
- Tickets per student per week
- Prevent ticket spam

### Audit & Monitoring

**Audit Log:**
- All critical actions logged
- User, timestamp, action, changes
- Searchable and exportable

**System Health:**
- Database performance
- API response times
- Error rates
- User activity patterns

### Best Practices for Super Admins

✅ **DO:**
- Regularly review category performance
- Update SLAs based on actual resolution times
- Monitor admin workload and rebalance
- Add new categories as needs arise
- Archive inactive categories/statuses
- Keep role assignments current
- Review analytics monthly

❌ **DON'T:**
- Delete statuses with active tickets
- Change critical fields without backup
- Overload single admin with too many tickets
- Ignore escalation patterns
- Let inactive users accumulate

---

## ❓ FAQ

### Students

**Q: How long will my ticket take to resolve?**
A: Every category has an SLA (Service Level Agreement). You'll see the expected TAT when you create the ticket. Typical range: 24-72 hours.

**Q: Can I cancel a ticket?**
A: No direct cancellation to maintain accountability. Instead, add a comment explaining it's no longer needed and ask admin to close it.

**Q: Why is my ticket taking so long?**
A: Check if status is "Awaiting Student" - admin may need info from you. If overdue, it auto-escalates to higher authority.

**Q: Can I submit tickets for others?**
A: No, tickets must be submitted individually. Exception: roommates can submit separate tickets for shared issues.

**Q: What if I'm not satisfied with the resolution?**
A: Rate it honestly and explain in feedback. You can also reopen the ticket if issue persists.

### Admins

**Q: How do I get tickets assigned to me?**
A: Auto-assignment based on your domain/scope. Super admin configures which categories route to you.

**Q: Can I delegate a ticket to my junior?**
A: Not through reassignment (unless they're also in the system). Use internal notes to coordinate offline.

**Q: What if I can't resolve within TAT?**
A: Update ticket with progress, request extension via super admin, or escalate.

**Q: How do I handle duplicate tickets?**
A: Group them together. Update all via group operation. Advise students in comments.

**Q: What's the difference between internal notes and comments?**
A: Internal notes are admin-only. Comments are visible to students (unless marked internal).

### Super Admins

**Q: Can I change a status value after creation?**
A: No, the value field is immutable to preserve data integrity. You can change label, color, progress, etc.

**Q: How do I delete a status that has tickets?**
A: You can't. First update all tickets to use a different status via SQL, then delete.

**Q: What happens when I deactivate a status?**
A: It disappears from dropdowns but existing tickets keep it. Good for deprecating old statuses.

**Q: Can I export all system data?**
A: Yes, via API or direct database export. Use for backups and external analysis.

**Q: How do I handle category restructuring?**
A: Create new categories, migrate tickets gradually, archive old categories once empty.

---

## 🆘 Getting Help

- **Technical Issues**: Contact super admin or system administrator
- **Feature Requests**: Submit via feedback form or raise a ticket
- **Training**: Request admin training session from super admin
- **Documentation**: Refer to these guides or in-app help tooltips

---

**Last Updated**: 2025-11-19  
**Version**: 2.0
