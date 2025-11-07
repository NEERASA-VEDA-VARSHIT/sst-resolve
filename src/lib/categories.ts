export type CategoryNode = {
  id: string;
  title: string;
  children?: CategoryNode[];
  fields?: { id: string; label: string; type: "text" | "date" | "select"; options?: string[] }[];
};

export const CATEGORY_TREE: CategoryNode[] = [
  {
    id: "hostel",
    title: "Hostel",
    children: [
      {
        id: "hostel_location",
        title: "Choose Hostel",
        children: [
          { id: "hostel_neeladri", title: "Neeladri" },
          { id: "hostel_velankani", title: "Velankani" },
        ],
      },
      {
        id: "hostel_issue",
        title: "Issue Type",
        children: [
          {
            id: "hostel_mess",
            title: "Mess Quality Issues",
            fields: [
              { id: "meal", label: "Meal", type: "select", options: ["Breakfast", "Lunch", "Dinner"] },
              { id: "date", label: "Date", type: "date" },
              { id: "description", label: "Issue Description", type: "text" },
            ],
          },
          { id: "hostel_leave", title: "Leave Application" },
          {
            id: "hostel_maintenance",
            title: "Maintenance / Housekeeping",
            children: [
              { id: "plumbing", title: "Plumbing" },
              { id: "electrical", title: "Electrical" },
              { id: "painting", title: "Painting" },
              { id: "carpenter", title: "Carpenter" },
              { id: "pantry", title: "Pantry Area" },
            ],
          },
          { id: "hostel_wifi", title: "Wi-Fi Issues" },
          { id: "hostel_room_change", title: "Room Change Request" },
          { id: "hostel_other", title: "Other" },
        ],
      },
    ],
  },
  {
    id: "college",
    title: "College",
    children: [
      {
        id: "college_issue",
        title: "Issue Type",
        children: [
          {
            id: "college_mess",
            title: "Mess Quality Issues",
            children: [
              { 
                id: "college_mess_gsr", 
                title: "GSR",
                fields: [
                  { id: "meal", label: "Meal", type: "select", options: ["Breakfast", "Lunch", "Dinner"] },
                  { id: "date", label: "Date", type: "date" },
                  { id: "description", label: "Issue Description", type: "text" },
                ],
              },
              { 
                id: "college_mess_uniworld", 
                title: "Uniworld",
                fields: [
                  { id: "meal", label: "Meal", type: "select", options: ["Breakfast", "Lunch", "Dinner"] },
                  { id: "date", label: "Date", type: "date" },
                  { id: "description", label: "Issue Description", type: "text" },
                ],
              },
              { 
                id: "college_mess_tcb", 
                title: "TCB",
                fields: [
                  { id: "meal", label: "Meal", type: "select", options: ["Breakfast", "Lunch", "Dinner"] },
                  { id: "date", label: "Date", type: "date" },
                  { id: "description", label: "Issue Description", type: "text" },
                ],
              },
            ],
          },
          {
            id: "college_maintenance",
            title: "Maintenance / Housekeeping",
            fields: [
              { id: "description", label: "Description", type: "text" },
            ],
          },
          { id: "college_wifi", title: "Wi-Fi Issues" },
          { id: "college_other", title: "Other" },
        ],
      },
    ],
  },
];

export const LOCATIONS = {
  hostel: ["Neeladri", "Velankani"],
};

// Committee subcategories
export const COMMITTEE_SUBCATEGORIES = [
  "Student Welfare (Council)",
  "Mess Committee",
  "Transport",
  "Event",
  "Cultural Club",
  "Sports Club",
] as const;


