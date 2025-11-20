// Clean duplicate/broken category fields with single-letter slugs
console.log(`
🔧 CLEANUP SCRIPT FOR DUPLICATE FIELDS

Based on the console output, you have 3 broken fields with single-letter slugs:
- ID: 1, Name: "issueType", Slug: "i"
- ID: 2, Name: "location", Slug: "l"  
- ID: 3, Name: "Description", Slug: "d"

These need to be deleted from the database.

📋 SQL COMMAND TO RUN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DELETE FROM category_fields WHERE id IN (1, 2, 3);

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ After running this, your Maintenance subcategory will have only 3 fields:
   - Location (slug: location) - text
   - Issue Type (slug: issue_type) - select  
   - Description (slug: description) - textarea

🎯 How to run this:
   1. Open your database client (pgAdmin, TablePlus, or psql)
   2. Connect to your database
   3. Run the SQL command above
   4. Refresh your ticket form page

OR you can run it via psql:
   psql "YOUR_DATABASE_URL" -c "DELETE FROM category_fields WHERE id IN (1, 2, 3);"
`);

