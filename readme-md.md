# Task Progress Tracker

A simple, offline-capable web application for tracking your daily tasks and habits. This application allows you to visually monitor your consistency with a GitHub-inspired contribution grid visualization.

## Features

- Add, edit, and delete tasks
- Track task completion with a 5-level progress system (none, low, medium, high, complete)
- View your progress on a monthly calendar grid
- Works completely offline
- Data stored locally in your browser
- No account or server needed
- Responsive design for mobile and desktop

## Live Demo

You can try the app directly by visiting [this GitHub Pages link](#).

## Installation

### Option 1: Use directly in browser

1. Go to the [GitHub Pages demo](#) 
2. Start using the app immediately - no installation required!

### Option 2: Download and run locally

1. Download the [latest release](https://github.com/yourusername/task-progress-tracker/releases) or clone this repository:

```
git clone https://github.com/yourusername/task-progress-tracker.git
```

2. Open the `index.html` file in your web browser.

That's it! No server or build process required.

## How to Use

1. **Add a task**: Enter a task name in the input field and click "Add Task"
2. **Track progress**: Click on a cell in the calendar grid to cycle through completion levels
3. **Edit a task**: Click the edit button (✏️) next to a task name
4. **Delete a task**: Click the delete button (🗑️) next to a task name
5. **Navigate months**: Use the arrow buttons at the top to move between months

## Privacy

- All your data is stored locally in your browser using localStorage
- No data is sent to any server
- Your data remains private to your device

## Browser Support

The app works in all modern browsers that support:
- localStorage API
- CSS Grid Layout
- ES6 JavaScript features

## Development

This project is built with plain HTML, CSS, and JavaScript, with no external dependencies.

### Project Structure

```
task-progress-tracker/
├── css/
│   ├── normalize.css
│   └── styles.css
├── js/
│   ├── app.js
│   ├── storage.js
│   ├── taskManager.js
│   └── ui.js
├── img/
├── index.html
├── manifest.json
└── service-worker.js
```

## Contributing

Contributions are welcome! Feel free to submit a pull request or open an issue.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
