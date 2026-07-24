# Taskora

> A modern productivity dashboard for organizing tasks, tracking progress, and staying on top of deadlines — built entirely with vanilla HTML, CSS, and JavaScript.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green.svg)

---

## Overview

Taskora is a full-featured task management platform inspired by tools like Trello, Notion, and Microsoft To Do — built from scratch with no frameworks, to demonstrate strong fundamentals in vanilla JavaScript, clean architecture, and UI design.

It includes a live dashboard, a kanban-style task board, real statistics derived from actual task data, a full month-view calendar, and browser-based due date reminders — all backed by a clean, layered data architecture.



## Features

**Dashboard** — live stats (total, completed, in progress, overdue), today's tasks, and a recent activity feed
**Task management** — full CRUD (create, read, update, delete), with title, category, priority (Low/Medium/High/Urgent), due dates, and status
**Search, filter & sort** — live search by title, filter by status, sort by priority or due date
**Task board** — kanban-style view with three columns (To do / In progress / Done)
**Statistics** — completion rate donut chart and priority/category breakdowns, computed live from real data
**Calendar** — full month-grid view with tasks plotted on their due dates, month navigation, and overdue highlighting
**Dark mode** — full theme toggle, persisted across sessions
**Browser reminders** — opt-in due date notifications via the Notification API
**Settings** — default priority, theme, reminders, and full data reset, all in one place
**Persistent storage** — all data survives refresh via `localStorage`, with a clean separation between storage, state, and rendering

## Tech stack

Deliberately built without a framework, to demonstrate fundamentals:

**HTML5** — semantic markup, accessible landmarks (`<main>`, `<aside>`, `<nav>`)
**CSS3** — custom properties (design tokens), CSS Grid/Flexbox, conic-gradient charts, dark theme via attribute selectors
**JavaScript (ES6+)** — no frameworks or libraries; vanilla DOM manipulation, `localStorage`, `Notification` API
**Git & GitHub** — version-controlled from initial commit onward

---

## Project structure

```
taskora/
├── index.html
├── README.md
├── .gitignore
│
├── css/
│   ├── base/          # reset, design tokens (variables), typography
│   ├── layout/         # sidebar, dashboard grid
│   ├── components/     # buttons, cards, modal, task cards, board, calendar, stats
│   ├── themes/          # dark mode overrides
│   └── polish.css       # visual refinement layer
│
└── js/
    ├── models/
    │   └── Task.js          # task factory — defines the shape of a task
    ├── data/
    │   └── taskStorage.js   # the only file that talks to localStorage
    └── main.js               # rendering, event handling, page routing
```

**Architecture notes:**
- All `localStorage` access is isolated to a single data layer (`taskStorage.js`), following a lightweight repository pattern — no other file touches storage directly.
- CSS is organized using an ITCSS-inspired structure (base → layout → components → themes), avoiding specificity conflicts as the project grows.
- The app is a single-page application with manual view-routing (`switchPage()`) — no router library needed for this scope.

---

## Getting started

1. Clone the repository:
   ```bash
   git clone https://github.com/Zunaira48/taskora.git
   ```
2. Open the folder in VS Code.
3. Run it with a local dev server — recommended: the **Live Server** VS Code extension (right-click `index.html` → "Open with Live Server").
4. No build step, no dependencies, no `npm install` required — it's pure HTML/CSS/JS.

---

## Roadmap

- [ ] Edit existing tasks (currently add/complete/delete only)
- [ ] Labels (separate from categories, already modeled in the data layer)
- [ ] Export/import tasks as JSON
- [ ] Responsive/mobile layout
- [ ] Backend integration with SQL Server via a Node.js/Express API, replacing `localStorage` with persistent, multi-device storage

---

## Author

Built by [Zunaira48](https://github.com/Zunaira48) as a portfolio project demonstrating vanilla JavaScript architecture, UI/UX design, and full-stack readiness.

---

## License

This project is licensed under the MIT License — free to use, modify, and learn from.