# Migration Checklist

- [ ] **GitHub Migration**
  - [x] Configure remote URL for new repository (`cermaqsj/reg`)
  - [/] Configure local git to use `cermaqsj` credentials for this folder
  - [/] Push code to new repository (Manual Upload via Chrome recommended)
- [ ] **Google Apps Script Migration**
  - [ ] Create new Google Spreadsheet
  - [ ] Copy `backend.gs` content to new Apps Script project
  - [ ] Run `setupSpreadsheet` to initialize database
  - [ ] Deploy as Web App and get new URL
- [ ] **Frontend Update**
  - [ ] Update `API_URL` in `app.js`
  - [ ] Update `API_URL` in `monitor.html`
  - [ ] Commit and push URL changes
