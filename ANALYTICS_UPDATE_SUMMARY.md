# Admin Analytics Updates

## Changes Implemented

1.  **Subcategory Breakdown Fix**:
    - Updated **Super Admin Admin Detail Page** (`/superadmin/dashboard/analytics/admin/[id]`) and **Admin Analytics Page** (`/admin/dashboard/analytics`) to use `metadata.subcategory` for the category breakdown.
    - This ensures that tickets assigned to a parent category (e.g., "Hostel") but having a specific subcategory in metadata (e.g., "Room Change") are correctly grouped by the subcategory.
    - Fallback to `category_name` if `metadata.subcategory` is missing.

2.  **Super Admin Visibility Fix**:
    - Removed strict subcategory filter to ensure all tickets are counted in the breakdown.

3.  **Code Cleanup**:
    - Fixed a type error regarding `role` property access.
    - Simplified `TicketCard` props passing to resolve type mismatches.

## How to Verify

1.  **Super Admin Admin Detail**:
    - Go to `/superadmin/dashboard/analytics/admin/[id]`.
    - Verify that the **"Category Breakdown"** section now lists subcategories like "Room Change", "Water Related" instead of just "Hostel".

2.  **Admin Analytics**:
    - Go to `/admin/dashboard/analytics`.
    - Verify the breakdown matches the Super Admin view.
