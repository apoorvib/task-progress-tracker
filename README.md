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
- Progressive Web App (PWA) support for mobile installation

## Live Demo

This project isn't currently hosted online.

## Installation

### Option 1: Use directly in browser

1. If you've deployed the app, visit its URL
2. Start using the app immediately - no installation required!
3. For mobile devices, you can install it as a Progressive Web App by:
   - On Android: Tap the menu button and select "Add to Home Screen"
   - On iOS: Tap the share button and select "Add to Home Screen"

### Option 2: Download and run locally

1. Download the source code or clone this repository:

```
git clone https://github.com/apoorvib/task-progress-tracker.git
```

2. Open the `index.html` file in your web browser.

That's it! No server, build process, or dependencies required.

## How to Use

1. **Add a task**: Enter a task name in the input field and click "Add Task"
2. **Track progress**: Click on a cell in the calendar grid to cycle through completion levels:
   - Level 0 (Gray): No progress
   - Level 1 (Light Green): Low progress
   - Level 2 (Medium Green): Medium progress 
   - Level 3 (Dark Green): High progress
   - Level 4 (Darkest Green): Complete
3. **Edit a task**: Click the edit button (✏️) next to a task name
4. **Delete a task**: Click the delete button (🗑️) next to a task name
5. **Navigate months**: Use the arrow buttons at the top to move between months
6. **Filter tasks**: Use the "All Tasks" and "Single Task" buttons to change your view
7. **Backup data**: Use the Export/Import buttons in the Data Management section

## Task Management

- Each task can be tracked daily with five different progress levels
- Tasks display a mini-progress view showing your consistency over the last 7 days
- The main grid provides a monthly view of all your progress
- Click on any day in the grid to cycle through progress levels

## Data Storage

- Your data is stored in your browser's IndexedDB database
- IndexedDB data typically persists even when clearing cookies and browser cache
- For additional safety, use the Export button to download a backup of your data
- If needed, use the Import button to restore from a previously exported file

## Offline Capability

This app works completely offline with:
- Service Worker for offline access
- IndexedDB for data persistence
- PWA configuration for mobile installation

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
│   ├── normalize.css       # CSS reset for consistency across browsers
│   └── styles.css          # Main stylesheet with custom variables and components
├── js/
│   ├── app.js              # Application initialization and error handling
│   ├── indexedDB-storage.js # Persistent storage implementation using IndexedDB
│   ├── taskManager.js      # Task data manipulation and business logic
│   └── ui.js               # DOM manipulation and event handling
├── img/
│   ├── icon-192.svg        # App icon for smaller displays
│   └── icon-512.svg        # App icon for larger displays
├── index.html              # Main HTML structure
├── manifest.json           # PWA configuration
├── service-worker.js       # Offline capabilities
├── LICENSE.md              # MIT License details
└── README.md               # Application documentation
```

## Technical Details

- Built with vanilla JavaScript - no frameworks or libraries
- Uses IndexedDB for persistent data storage
- Async/await patterns for smooth user experience
- CSS Grid for responsive layout and calendar visualization
- CSS custom properties for easy theming
- Progressive Web App capabilities for offline use
- Event delegation pattern for efficient event handling

## Customization

The application uses CSS custom properties (variables) for easy customization:

- Color scheme can be modified in the `:root` section of `styles.css`
- Task levels use the variables `--level-0` through `--level-4` for the progress colors
- Layout and spacing use standardized variables for consistency

## Contributing

Contributions are welcome! Feel free to submit a pull request or open an issue.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
