# Employee Attendance & Operations Tracker

A responsive, admin-facing attendance dashboard for Karthik and Koushik.

## Current frontend

- Daily attendance: Present / Absent
- Separate check-in, sales closing (2:00 PM), and final logout times
- Sales closing does not imply the employee has finished all work for the day
- Absence reason category and optional remarks
- Free-text whereabouts timeline; no GPS and no location dropdowns
- Attendance history and month-level CSV export (Excel-compatible)
- Responsive laptop and mobile layout

## Files

- `index.html` — app structure
- `styles.css` — responsive visual design
- `app.js` — dashboard behavior and local demo storage
- `config.js` — backend endpoint configuration

## Current mode: local demo

The frontend currently saves demo records in this browser's local storage. This is not yet connected to the Google Sheet, and browser-local data is not shared across devices.

## Connect the Google Sheets backend

1. In the Google Sheet **Employee Attendance & Operations Tracker**, open Extensions → Apps Script.
2. Add server-side API handlers for reading and writing attendance, whereabouts, absences, and audit records.
3. Deploy the Apps Script project as a Web App with access restricted to the administrator account.
4. Copy the deployed Web App URL.
5. Set `API_URL` in `config.js` to that URL.
6. Ensure the server validates the administrator identity and permitted actions. Do not rely on a client-side email or hidden UI as access control.

The backend should support authenticated reads and writes. The current `syncSnapshot` call is a placeholder integration contract; a production Apps Script implementation should validate and persist records server-side rather than blindly trusting an incoming browser snapshot.

## Publish with GitHub Pages

In GitHub, open Settings → Pages. Select **Deploy from a branch**, choose `main` and `/ (root)`, then save. GitHub will show the published site URL after deployment.

## Important

Do not enter live employee records in demo mode. Local storage is only for previewing the interface. Use the connected, access-restricted backend for operational records.