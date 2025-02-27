# Task Progress Tracker

A powerful, offline-capable web application for tracking your daily tasks and habits. Track your consistency with a visual color-coded grid inspired by GitHub's contribution chart.

## Features

- Add, edit, and delete tasks
- Track task completion with a 5-level progress system (none, low, medium, high, complete)
- View your progress on a monthly calendar grid
- Filter to view all tasks or focus on a single task
- Visual mini-tracker shows last 7 days for each task
- IndexedDB storage for persistent data that survives browser cache clearing
- Built-in data export/import for manual backups
- Works completely offline - no server required
- Responsive design for mobile and desktop devices

## Live Demo

You can try the app directly by visiting [GitHub Pages link](#).

## Installation

### Option 1: Use directly in browser

1. Go to the [GitHub Pages demo](#) 
2. Start using the app immediately - no installation required!

### Option 2: Download and run locally

1. Download the [latest release](https://github.com/yourusername/task-progress-tracker/releases) or clone this repository:

```
git clone https://github.com/apoorvib/task-progress-tracker.git
```

2. Open the `index.html` file in your web browser.

That's it! No server, build process, or dependencies required.

## How to Use

1. **Add a task**: Enter a task name in the input field and click "Add Task"
2. **Track progress**: Click on a cell in the calendar grid to cycle through completion levels
3. **Edit a task**: Click the edit button (✏️) next to a task name
4. **Delete a task**: Click the delete button (🗑️) next to a task name
5. **Navigate months**: Use the arrow buttons at the top to move between months
6. **Filter tasks**: Use the "All Tasks" and "Single Task" buttons to change your view
7. **Backup data**: Use the Export/Import buttons in the Data Management section

## Data Storage

- Your data is stored in your browser's IndexedDB database
- IndexedDB data typically persists even when clearing cookies and browser cache
- For additional safety, use the Export button to download a backup of your data
- If needed, use the Import button to restore from a previously exported file

## Browser Support

The app works in all modern browsers that support:
- IndexedDB (for data storage)
- CSS Grid Layout (for the calendar visualization)
- ES6+ JavaScript features

Supported browsers include:
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 16+
- Modern mobile browsers (iOS 11+, Android 5+)

## Project Structure

```
task-progress-tracker/
├── css/
│   ├── normalize.css
│   └── styles.css
├── js/
│   ├── app.js
│   ├── indexedDB-storage.js
│   ├── taskManager.js
│   └── ui.js
├── img/
│   ├── icon-192.svg
│   └── icon-512.svg
├── index.html
├── manifest.json
├── service-worker.js
├── LICENSE
└── README.md
```

## Technical Details

- Built with vanilla JavaScript - no frameworks or libraries
- Uses IndexedDB for persistent data storage
- Async/await patterns for smooth user experience
- CSS Grid for responsive layout and calendar visualization
- CSS custom properties for easy theming
- Progressive Web App capabilities for offline use

## Contributing

Contributions are welcome! Feel free to submit a pull request or open an issue.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
