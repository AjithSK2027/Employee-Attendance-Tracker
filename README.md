# Employee Attendance & Operations Tracker

A responsive, admin-facing attendance dashboard for Karthik and Koushik.

## Features

- Daily attendance: Present / Absent
- Separate check-in, sales closing (2:00 PM), and final logout times
- Sales closing does not mean the employee's full workday has ended
- Absence reason category and optional remarks
- Free-text whereabouts timeline; no GPS and no location dropdowns
- Attendance history, monthly summary, and CSV export
- Audit log written to the spreadsheet
- Responsive laptop and mobile layout

## Files

- `index.html` — app structure
- `styles.css` — responsive visual design
- `app.js` — dashboard behavior and API integration
- `config.js` — deployed Apps Script URL
- `Code.gs` — Google Apps Script backend

## Connect your existing Google Sheet

The spreadsheet **Employee Attendance & Operations Tracker** should already contain the tabs created by `setupAttendanceSystem`.

1. Open that spreadsheet.
2. Select **Extensions → Apps Script**.
3. In the Apps Script editor, open the existing script project.
4. Replace the editor contents with the complete contents of this repository's `Code.gs` file. If the original setup function is still needed, keep it in a separate file or add it back; do not run setup again over populated data.
5. Save the Apps Script project.
6. Run `testBackendSetup` once from the editor and approve the requested Google permissions. Confirm the log shows the administrator account and two employees.
7. Select **Deploy → New deployment → Web app**.
8. Set **Execute as: User accessing the web app**.
9. For access, choose **Anyone with a Google account** if that option is available. Do not choose unrestricted anonymous access. The spreadsheet itself should remain shared only with the administrator.
10. Deploy, authorize with `caffeineeighteen@gmail.com`, and copy the Web app URL ending in `/exec`.

The backend checks the signed-in Google account against `caffeineeighteen@gmail.com`. If Apps Script cannot return the signed-in account email, or if the deployment screen offers only unrestricted public access, stop and do not publish the endpoint; the access configuration needs to be resolved first.

## Add the endpoint to GitHub Pages

1. Open `config.js` in this repository.
2. Set `API_URL` to the deployed Web app URL, keeping the quotation marks.
3. Commit the change.
4. Wait for GitHub Pages to redeploy, then reload the dashboard.

Example:

```js
window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
};
```

The frontend uses JSONP for authenticated reads and a simple POST for writes because Apps Script ContentService does not provide configurable CORS headers. The dashboard verifies writes by reading the spreadsheet again.

## Important

- Do not enter live employee records until the backend connection shows **Connected**.
- Demo mode stores data only in the current browser.
- Do not use unrestricted public deployment. The server-side email check and spreadsheet permissions are required.
- If you change backend code after deployment, create a new deployment version or edit the existing deployment to point to the new version.
