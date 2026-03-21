# Sales Team Member System + AI Route Optimization + CRM + Commission Engine

## Overview

Build a Sales Team Member system inside the Distribution Portal that enables:

- Admins to create and manage sales reps and managers
- Assignment of accounts, regions, and routes
- AI-generated route optimization with weekly rotation and freshness logic
- CRM activity tracking (notes, SMS, email, photos)
- Order attribution to reps
- Commission calculation and payout via Stripe
- Performance tracking and compliance monitoring

This system should function as a full operating system for a field sales team.

---

# 1. User Roles

## Admin
- Full system control
- Create/edit reps and managers
- Assign accounts, regions, and routes
- Configure commissions
- Approve and trigger Stripe payouts
- Access all dashboards and reports

## Sales Manager
- Oversees assigned reps and regions
- Assigns accounts and routes within scope
- Reviews and approves AI-generated routes
- Monitors performance and compliance
- Cannot access payouts or global system settings

## Sales Rep
- Access to assigned accounts and routes only
- Logs visits, notes, and uploads photos
- Sends SMS and email to accounts
- Views own performance and commissions

---

# 2. Sales Team Member Profile

### Required Fields
- id
- first_name
- last_name
- email
- phone
- role_type (admin, sales_manager, sales_rep)
- status (active, inactive, terminated)
- hire_date
- assigned_manager_id
- stripe_account_id
- default_commission_plan_id
- home_region_id

### Optional Fields
- profile_photo
- notes
- last_active_at
- onboarding_status

---

# 3. Account Assignment + Attribution

### Account Fields
- assigned_sales_member_id
- assigned_region_id
- assigned_route_id
- assignment_start_date
- assignment_end_date
- visit_frequency
- last_visit_date
- next_required_visit_date
- account_priority
- account_type

### Order Attribution Logic
- If account has assigned rep → attribute to that rep
- Else fallback to region rep
- Store attribution permanently on order

### Order Fields
- attributed_sales_member_id
- attribution_source
- attributed_region_id
- commission_status
- commission_amount

---

# 4. Regions, Routes, and Territories

## Region
- id
- name
- geo boundaries
- assigned reps

## Route
- id
- assigned_sales_member_id
- region_id
- frequency
- list of accounts
- expected stops

## Route Assignment
- Daily, weekly, monthly recurrence
- Admin assignable
- Template support

---

# 5. AI Route Optimization Engine

## Objective
Automatically generate optimized routes that maintain account coverage, prioritize high-value accounts, and rotate lower-priority accounts.

## Inputs
- account priority
- visit frequency
- last visit date
- revenue performance
- region/geography
- rep capacity
- missed visits

## Outputs

### Daily Routes
- optimized stop order
- prioritized accounts
- overdue flags

### Weekly Routes
- balanced schedule
- full coverage of required accounts

### Monthly Coverage
- rotation of accounts
- ensures no account is neglected

---

## Freshness + Rotation Logic

System must:
- track freshness_score (based on visits + orders)
- prioritize overdue accounts
- rotate low-priority accounts weekly
- maintain consistency for high-value accounts

---

## Admin Controls

- toggle AI vs manual vs hybrid routing
- approve/edit AI routes
- lock accounts into routes
- define constraints:
  - max stops/day
  - travel radius
  - visit frequency

---

## Rep Experience

Smart Route View:
- daily route
- tags:
  - High Value
  - Overdue
  - New Account
- reorder stops (limited)
- provide feedback:
  - skip account
  - increase frequency
  - mark as low value

---

## AI Data Models

### Account Additions
- freshness_score
- visit_compliance_score
- priority_score
- ai_recommended_visit_date

### Route Additions
- is_ai_generated
- ai_confidence_score
- generated_at

### New Table: ai_route_recommendations
- sales_member_id
- recommended_account_ids
- reasoning_summary
- confidence_score
- accepted_by_admin

---

# 6. Route Execution

Reps must be able to:
- mark stops complete or skipped
- log notes
- upload photos
- send SMS/email
- create follow-ups

### Required Fields (configurable)
- note required
- minimum photos required
- visit outcome
- follow-up date

---

# 7. CRM Activity Logging

### Activity Model
- account_id
- sales_member_id
- activity_type
- timestamp
- notes
- visit outcome
- next steps
- follow-up date
- attachments/photos

---

# 8. Messaging System

### Features
- SMS + email sending
- only to assigned accounts
- message templates

### Logging
- message body
- sender/recipient
- timestamp
- delivery status

---

# 9. Photo Upload System

### Required Types
- store exterior
- shelf display
- back bar
- optional competitor images

### Requirements
- mobile upload
- timestamp
- linked to visit/account/rep
- stored in object storage

---

# 10. Admin Assignment Tools

Admins and managers can:
- assign accounts individually or in bulk
- assign routes and regions
- transfer accounts
- view assignment history

---

# 11. Commission System

## Commission Plans
- flat per case
- % of revenue
- tiered models

## Commission Fields
- sales_member_id
- order_id
- commission_amount
- status
- approved_at
- paid_at
- stripe_payout_id

## States
- pending
- approved
- paid
- voided

---

## Stripe Payouts

Admins can:
- approve commissions
- batch payouts
- send payments via Stripe
- view payout history

---

# 12. Dashboards

## Admin Dashboard
- sales by rep
- revenue
- route completion
- note/photo compliance
- account coverage
- commissions

## Sales Manager Dashboard
- team performance
- route completion
- rep activity
- alerts for missed visits

## Rep Dashboard
- today’s route
- upcoming visits
- overdue tasks
- commission summary

---

# 13. Notifications

## Rep
- route reminders
- missing logs
- follow-ups
- commission updates

## Admin/Manager
- missed visits
- compliance issues
- payout approvals

---

# 14. Audit + Data Integrity

Track:
- assignment changes
- route changes
- CRM activity
- commissions and payouts
- attribution overrides

Ensure:
- historical attribution does not change
- commission calculations are immutable once recorded

---

# 15. API Requirements

## Admin
- manage reps
- assign accounts/routes
- manage commissions
- trigger payouts

## Rep
- fetch routes/accounts
- log visits
- upload photos
- send messages

## Order Hook
- assign rep on order creation
- trigger commission calculation

---

# 16. Business Rules

- reps only access assigned accounts
- attribution locked at time of order
- required visit fields enforced
- commissions require approval
- deactivated reps cannot receive assignments

---

# 17. Edge Cases

- account ownership changes
- shared territories
- rep exits with pending commissions
- skipped visits
- failed uploads
- payout failures
- returns affecting commissions

---

# 18. Acceptance Criteria

System is complete when:

1. Admin can create reps and managers  
2. Accounts and routes can be assigned  
3. AI routes are generated and editable  
4. Reps can complete routes with required logs  
5. Orders are correctly attributed  
6. Commissions are calculated and payable  
7. Stripe payouts function correctly  
8. Managers can oversee and adjust teams  
9. Dashboards reflect real performance  
10. All actions are auditable  

---

# 19. Build Phases

## Phase 1
- reps + accounts
- attribution
- basic routes
- notes + photos

## Phase 2
- AI routing
- messaging
- commission engine
- Stripe payouts

## Phase 3
- route optimization improvements
- geolocation tracking
- automation + recommendations
- advanced analytics

---