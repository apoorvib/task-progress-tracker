/**
 * Modified UIController class to work with async IndexedDB storage
 * This file replaces your existing ui.js
 */

class UIController {
    constructor(taskManager) {
      console.log('Initializing UI Controller...');
      this.taskManager = taskManager;
      
      // Cache DOM elements
      this.taskListElement = document.getElementById('task-list');
      this.progressGridElement = document.getElementById('progress-grid');
      this.currentMonthYearElement = document.getElementById('current-month-year');
      this.taskFormElement = document.getElementById('task-form');
      this.taskNameInput = document.getElementById('task-name');
      this.taskSelectorElement = document.getElementById('task-selector');
      
      // Check for missing elements
      if (!this.taskListElement) console.error('Missing element: task-list');
      if (!this.progressGridElement) console.error('Missing element: progress-grid');
      if (!this.currentMonthYearElement) console.error('Missing element: current-month-year');
      if (!this.taskFormElement) console.error('Missing element: task-form');
      if (!this.taskNameInput) console.error('Missing element: task-name');
      
      this.isEditing = false;
      this.editingTaskId = null;
      
      // Initialize UI and event listeners
      this.init();
    }
  
    /**
     * Initialize UI and event listeners
     */
    async init() {
      try {
        console.log('Initializing UI...');
        
        // Set initial view mode
        this.viewMode = 'all'; // 'all' or 'single'
        this.selectedTaskId = null;
        
        // Render initial state
        await this.renderCurrentMonth();
        await this.renderTaskList();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Add data export/import functionality
        this.addDataControls();
        
        console.log('UI initialized successfully');
      } catch (error) {
        console.error('Error initializing UI:', error);
      }
    }
  
    /**
     * Set up all event listeners
     */
    setupEventListeners() {
      try {
        console.log('Setting up event listeners...');
        
        // Task form submission
        if (this.taskFormElement) {
          console.log('Adding task form submit listener');
          this.taskFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Form submitted');
            await this.handleTaskFormSubmit();
          });
        }
        
        // Month navigation
        const prevMonthButton = document.getElementById('prev-month');
        const nextMonthButton = document.getElementById('next-month');
        
        if (prevMonthButton) {
          console.log('Adding prev month button listener');
          prevMonthButton.addEventListener('click', async () => {
            console.log('Previous month clicked');
            this.taskManager.previousMonth();
            await this.renderCurrentMonth();
          });
        } else {
          console.error('Missing element: prev-month');
        }
        
        if (nextMonthButton) {
          console.log('Adding next month button listener');
          nextMonthButton.addEventListener('click', async () => {
            console.log('Next month clicked');
            this.taskManager.nextMonth();
            await this.renderCurrentMonth();
          });
        } else {
          console.error('Missing element: next-month');
        }
        
        // Event delegation for task list actions
        if (this.taskListElement) {
          console.log('Adding task list click delegation');
          this.taskListElement.addEventListener('click', async (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;
            
            const taskId = taskItem.dataset.taskId;
            console.log('Task item clicked:', taskId);
            
            if (e.target.classList.contains('btn-edit')) {
              console.log('Edit button clicked');
              await this.startEditingTask(taskId);
            } else if (e.target.classList.contains('btn-delete')) {
              console.log('Delete button clicked');
              await this.deleteTask(taskId);
            } else {
              // When clicking on a task item (not on buttons), show single task view
              console.log('Task item body clicked - showing single task view');
              await this.showSingleTaskView(taskId);
            }
          });
        }
        
        // View toggle buttons
        const allTasksViewButton = document.getElementById('all-tasks-view');
        const singleTaskViewButton = document.getElementById('single-task-view');
        
        if (allTasksViewButton) {
          console.log('Adding all tasks view button listener');
          allTasksViewButton.addEventListener('click', async () => {
            console.log('All tasks view clicked');
            await this.showAllTasksView();
          });
        }
        
        if (singleTaskViewButton) {
          console.log('Adding single task view button listener');
          singleTaskViewButton.addEventListener('click', async () => {
            console.log('Single task view clicked');
            await this.showSingleTaskView();
          });
        }
        
        // Task selector dropdown
        const taskSelector = document.getElementById('task-selector');
        if (taskSelector) {
          console.log('Adding task selector change listener');
          taskSelector.addEventListener('change', async (e) => {
            const taskId = e.target.value;
            console.log('Task selector changed:', taskId);
            if (taskId) {
              this.selectedTaskId = taskId;
              await this.renderProgressGrid();
            }
          });
        }
        
        console.log('Event listeners set up successfully');
      } catch (error) {
        console.error('Error setting up event listeners:', error);
      }
    }
    
    /**
     * Add data export/import controls to the UI
     */
    addDataControls() {
      try {
        // Find the tasks panel to add our controls to
        const tasksPanel = document.querySelector('.tasks-panel');
        if (!tasksPanel) {
          console.error('Could not find tasks panel for data controls');
          return;
        }
        
        // Create the data controls container
        const dataControls = document.createElement('div');
        dataControls.className = 'data-controls';
        dataControls.innerHTML = `
          <h3>Data Management</h3>
          <div class="data-buttons">
            <button id="export-data" class="btn-secondary">Export Data</button>
            <div class="import-container">
              <label for="import-file" class="btn-secondary">Import Data</label>
              <input type="file" id="import-file" accept=".json" style="display: none;">
            </div>
          </div>
          <p class="data-info">Data is stored in IndexedDB and persists even when clearing browser cache.</p>
        `;
        
        // Append to the tasks panel
        tasksPanel.appendChild(dataControls);
        
        // Add event listeners
        const exportBtn = document.getElementById('export-data');
        const importFileInput = document.getElementById('import-file');
        
        if (exportBtn) {
          exportBtn.addEventListener('click', async () => {
            await this.exportData();
          });
        }
        
        if (importFileInput) {
          importFileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
              await this.importData(e.target.files[0]);
            }
          });
        }
        
        // Add basic styles for data controls
        const style = document.createElement('style');
        style.textContent = `
          .data-controls {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            padding: 16px;
            margin-top: 16px;
          }
          .data-buttons {
            display: flex;
            gap: 16px;
            margin-bottom: 8px;
          }
          .btn-secondary {
            background-color: #f0f0f0;
            color: #333;
            border: 1px solid #ddd;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
          }
          .btn-secondary:hover {
            background-color: #e0e0e0;
          }
          .data-info {
            color: #666;
            font-size: 0.875rem;
            margin: 4px 0 0;
          }
        `;
        document.head.appendChild(style);
      } catch (error) {
        console.error('Error adding data controls:', error);
      }
    }
    
    /**
     * Export data to a JSON file
     */
    async exportData() {
      try {
        // Get data from the task manager
        const exportData = await this.taskManager.exportData();
        
        // Convert to JSON string
        const dataStr = JSON.stringify(exportData, null, 2);
        
        // Create a blob and download link
        const blob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        // Create a temporary anchor element to trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `task-progress-backup-${this.formatDateForFilename(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        
        console.log('Data exported successfully');
        alert('Data exported successfully!');
      } catch (error) {
        console.error('Error exporting data:', error);
        alert('Error exporting data: ' + error.message);
      }
    }
    
    /**
     * Import data from a JSON file
     * @param {File} file - The JSON file to import
     */
    async importData(file) {
      if (!file) {
        alert('Please select a valid file');
        return;
      }
      
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const importedData = JSON.parse(event.target.result);
          
          // Validate the imported data
          if (!Array.isArray(importedData.tasks)) {
            throw new Error('Invalid backup file: Tasks data is missing or invalid');
          }
          
          // Confirm import
          if (confirm('This will replace your current data. Continue?')) {
            // Import the data
            await this.taskManager.importData(importedData.tasks);
            
            alert('Data imported successfully! The page will now reload.');
            
            // Reload the page to show the imported data
            window.location.reload();
          }
        } catch (error) {
          console.error('Error importing data:', error);
          alert('Error importing data: ' + error.message);
        }
      };
      
      reader.onerror = () => {
        alert('Error reading the file');
      };
      
      reader.readAsText(file);
    }
    
    /**
     * Format a date for a filename (YYYY-MM-DD)
     * @param {Date} date - The date to format
     * @returns {string} Formatted date string
     */
    formatDateForFilename(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    /**
     * Show all tasks view
     */
    async showAllTasksView() {
      console.log('Showing all tasks view');
      this.viewMode = 'all';
      document.getElementById('all-tasks-view').classList.add('active');
      document.getElementById('single-task-view').classList.remove('active');
      document.getElementById('task-selector-container').style.display = 'none';
      await this.renderProgressGrid();
    }
    
    /**
     * Show single task view
     * @param {string} taskId - Optional task ID to select
     */
    async showSingleTaskView(taskId = null) {
      console.log('Showing single task view, taskId:', taskId);
      this.viewMode = 'single';
      document.getElementById('all-tasks-view').classList.remove('active');
      document.getElementById('single-task-view').classList.add('active');
      document.getElementById('task-selector-container').style.display = 'flex';
      
      // If a task ID is provided, select it in the dropdown
      if (taskId) {
        this.selectedTaskId = taskId;
        document.getElementById('task-selector').value = taskId;
      }
      
      // If no task is selected yet, use the first one
      if (!this.selectedTaskId) {
        const tasks = await this.taskManager.getAllTasks();
        if (tasks.length > 0) {
          this.selectedTaskId = tasks[0].id;
          document.getElementById('task-selector').value = this.selectedTaskId;
        }
      }
      
      await this.renderProgressGrid();
    }
    
    /**
     * Update the task selector dropdown
     */
    async updateTaskSelector() {
      try {
        console.log('Updating task selector');
        const taskSelector = document.getElementById('task-selector');
        if (!taskSelector) {
          console.error('Task selector element not found');
          return;
        }
        
        const tasks = await this.taskManager.getAllTasks();
        
        // Clear current options (except the placeholder)
        while (taskSelector.options.length > 1) {
          taskSelector.remove(1);
        }
        
        // Add task options
        tasks.forEach(task => {
          const option = document.createElement('option');
          option.value = task.id;
          option.textContent = task.name;
          taskSelector.appendChild(option);
        });
        
        console.log('Task selector updated with', tasks.length, 'tasks');
      } catch (error) {
        console.error('Error updating task selector:', error);
      }
    }
  
    /**
     * Render the current month view
     */
    async renderCurrentMonth() {
      try {
        console.log('Rendering current month');
        const { month, year, monthName } = this.taskManager.getCurrentMonthInfo();
        if (this.currentMonthYearElement) {
          this.currentMonthYearElement.textContent = `${monthName} ${year}`;
        }
        
        await this.renderProgressGrid();
      } catch (error) {
        console.error('Error rendering current month:', error);
      }
    }
  
    /**
     * Render the list of tasks
     */
    async renderTaskList() {
      try {
        console.log('Rendering task list');
        if (!this.taskListElement) {
          console.error('Task list element not found');
          return;
        }
        
        const tasks = await this.taskManager.getAllTasks();
        this.taskListElement.innerHTML = '';
        
        if (tasks.length === 0) {
          const emptyMessage = document.createElement('li');
          emptyMessage.className = 'empty-message';
          emptyMessage.textContent = 'No tasks yet. Add your first task!';
          this.taskListElement.appendChild(emptyMessage);
          return;
        }
        
        // Get template
        const template = document.getElementById('task-item-template');
        if (!template) {
          console.error('Task item template not found');
          
          // Fallback if template is not available
          tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = 'task-item';
            li.dataset.taskId = task.id;
            li.innerHTML = `
              <div class="task-details">
                <span class="task-name">${task.name}</span>
                <div class="task-actions">
                  <button class="btn-edit" aria-label="Edit task">✏️</button>
                  <button class="btn-delete" aria-label="Delete task">🗑️</button>
                </div>
              </div>
              <div class="task-progress-mini"></div>
            `;
            this.taskListElement.appendChild(li);
            this.renderMiniProgress(li.querySelector('.task-progress-mini'), task.id);
          });
          
          return;
        }
        
        for (const task of tasks) {
          // Clone template
          const taskElement = template.content.cloneNode(true);
          const taskItem = taskElement.querySelector('.task-item');
          
          // Set task data
          taskItem.dataset.taskId = task.id;
          taskItem.querySelector('.task-name').textContent = task.name;
          
          // Add mini progress indicator (last 7 days)
          this.taskListElement.appendChild(taskItem);
          await this.renderMiniProgress(taskItem.querySelector('.task-progress-mini'), task.id);
        }
        
        await this.updateTaskSelector();
        
        console.log('Task list rendered with', tasks.length, 'tasks');
      } catch (error) {
        console.error('Error rendering task list:', error);
      }
    }
  
    /**
     * Render mini progress indicator for a task (last 7 days)
     * @param {HTMLElement} container - Container element
     * @param {string} taskId - Task ID
     */
    async renderMiniProgress(container, taskId) {
      try {
        if (!container) {
          console.error('Mini progress container not found');
          return;
        }
        
        container.innerHTML = '';
        
        // Get last 7 days
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(today.getDate() - i);
          const dateStr = this.taskManager.formatDate(date);
          
          const level = await this.taskManager.getCompletionLevel(taskId, dateStr);
          
          const cell = document.createElement('div');
          cell.className = `mini-cell level-${level}`;
          container.appendChild(cell);
        }
      } catch (error) {
        console.error('Error rendering mini progress:', error);
      }
    }
  
    /**
     * Render the progress grid
     */
    async renderProgressGrid() {
      try {
        console.log('Rendering progress grid');
        if (!this.progressGridElement) {
          console.error('Progress grid element not found');
          return;
        }
        
        this.progressGridElement.innerHTML = '';
        
        const days = this.taskManager.getDaysInMonth();
        let tasks = await this.taskManager.getAllTasks();
        
        if (tasks.length === 0) {
          const emptyMessage = document.createElement('div');
          emptyMessage.className = 'empty-grid-message';
          emptyMessage.textContent = 'Add tasks to start tracking your progress';
          emptyMessage.style.gridColumn = '1 / -1';
          emptyMessage.style.textAlign = 'center';
          emptyMessage.style.padding = '2rem';
          emptyMessage.style.color = 'var(--text-secondary)';
          this.progressGridElement.appendChild(emptyMessage);
          return;
        }
        
        console.log('View mode:', this.viewMode, 'Selected task:', this.selectedTaskId);
        
        // Filter tasks if in single task view
        if (this.viewMode === 'single' && this.selectedTaskId) {
          tasks = tasks.filter(task => task.id === this.selectedTaskId);
        }
        
        console.log('Rendering grid with', tasks.length, 'tasks and', days.length, 'days');
        
        // Create cells for each task and day
        for (const task of tasks) {
          // Add task label (visible on smaller screens)
          const taskLabel = document.createElement('div');
          taskLabel.className = 'task-row-label';
          taskLabel.textContent = task.name;
          this.progressGridElement.appendChild(taskLabel);
          
          // Create task row
          const taskRow = document.createElement('div');
          taskRow.className = 'task-row';
          taskRow.dataset.taskId = task.id;
          
          // Add cells for each day
          for (const day of days) {
            if (day.empty) {
              // Empty cell for days before the start of the month
              const emptyCell = document.createElement('div');
              emptyCell.className = 'progress-cell empty';
              this.progressGridElement.appendChild(emptyCell);
            } else {
              // Regular cell for days in the month
              const cell = document.createElement('div');
              cell.className = 'progress-cell';
              cell.dataset.date = day.dateStr;
              cell.dataset.taskId = task.id;
              
              // Add date number to cell
              const dateLabel = document.createElement('span');
              dateLabel.className = 'cell-date';
              dateLabel.textContent = day.day;
              cell.appendChild(dateLabel);
              
              // Check completion level
              const level = await this.taskManager.getCompletionLevel(task.id, day.dateStr);
              cell.classList.add(`level-${level}`);
              
              // Add today indicator
              if (day.isToday) {
                cell.classList.add('today');
              }
              
              // Add click handler to toggle completion
              cell.addEventListener('click', async () => {
                console.log('Cell clicked - toggling completion');
                await this.toggleTaskCompletion(task.id, day.dateStr, cell);
              });
              
              this.progressGridElement.appendChild(cell);
            }
          }
        }
        
        console.log('Progress grid rendered successfully');
      } catch (error) {
        console.error('Error rendering progress grid:', error);
      }
    }
  
    /**
     * Toggle task completion level
     * @param {string} taskId - Task ID
     * @param {string} dateStr - Date string
     * @param {HTMLElement} cellElement - Cell element
     */
    async toggleTaskCompletion(taskId, dateStr, cellElement) {
      try {
        console.log('Toggling task completion:', taskId, dateStr);
        
        // Remove old level class
        for (let i = 0; i <= 4; i++) {
          cellElement.classList.remove(`level-${i}`);
        }
        
        // Update level in data and UI
        const newLevel = await this.taskManager.toggleCompletionLevel(taskId, dateStr);
        console.log('New completion level:', newLevel);
        cellElement.classList.add(`level-${newLevel}`);
        
        // Update mini progress if needed
        const taskItem = this.taskListElement.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (taskItem) {
          await this.renderMiniProgress(taskItem.querySelector('.task-progress-mini'), taskId);
        }
      } catch (error) {
        console.error('Error toggling task completion:', error);
      }
    }
  
    /**
     * Handle task form submission
     */
    async handleTaskFormSubmit() {
      try {
        console.log('Handling task form submission');
        const taskName = this.taskNameInput.value.trim();
        
        if (!taskName) {
          alert('Please enter a task name');
          return;
        }
        
        if (this.isEditing) {
          // Update existing task
          console.log('Updating existing task:', this.editingTaskId);
          await this.taskManager.updateTask(this.editingTaskId, { name: taskName });
          this.cancelEditingTask();
        } else {
          // Create new task
          console.log('Creating new task:', taskName);
          const newTask = await this.taskManager.createTask(taskName);
          console.log('Task created:', newTask);
        }
        
        // Reset form
        this.taskNameInput.value = '';
        
        // Update UI
        await this.renderTaskList();
        await this.renderProgressGrid();
        
        console.log('Task form submission handled successfully');
      } catch (error) {
        console.error('Error handling task form submission:', error);
        alert(`Error: ${error.message}`);
      }
    }
  
    /**
     * Start editing a task
     * @param {string} taskId - Task ID
     */
    async startEditingTask(taskId) {
      try {
        console.log('Starting task editing:', taskId);
        const tasks = await this.taskManager.getAllTasks();
        const task = tasks.find(t => t.id === taskId);
        
        if (!task) {
          console.warn('Task not found for editing:', taskId);
          return;
        }
        
        this.isEditing = true;
        this.editingTaskId = taskId;
        this.taskNameInput.value = task.name;
        this.taskNameInput.focus();
        
        // Change button text
        const submitButton = this.taskFormElement.querySelector('button[type="submit"]');
        if (submitButton) {
          submitButton.textContent = 'Update Task';
        }
        
        // Add cancel button if it doesn't exist
        if (!this.taskFormElement.querySelector('.btn-cancel')) {
          const cancelButton = document.createElement('button');
          cancelButton.type = 'button';
          cancelButton.className = 'btn btn-cancel';
          cancelButton.textContent = 'Cancel';
          cancelButton.addEventListener('click', () => this.cancelEditingTask());
          
          if (submitButton) {
            submitButton.parentNode.insertBefore(cancelButton, submitButton.nextSibling);
          } else {
            this.taskFormElement.appendChild(cancelButton);
          }
        }
        
        console.log('Task editing started');
      } catch (error) {
        console.error('Error starting task editing:', error);
      }
    }
  
    /**
     * Cancel editing a task
     */
    cancelEditingTask() {
      try {
        console.log('Canceling task editing');
        this.isEditing = false;
        this.editingTaskId = null;
        this.taskNameInput.value = '';
        
        // Restore button text
        const submitButton = this.taskFormElement.querySelector('button[type="submit"]');
        if (submitButton) {
          submitButton.textContent = 'Add Task';
        }
        
        // Remove cancel button
        const cancelButton = this.taskFormElement.querySelector('.btn-cancel');
        if (cancelButton) {
          cancelButton.remove();
        }
        
        console.log('Task editing canceled');
      } catch (error) {
        console.error('Error canceling task editing:', error);
      }
    }
  
    /**
     * Delete a task
     * @param {string} taskId - Task ID
     */
    async deleteTask(taskId) {
      try {
        console.log('Deleting task:', taskId);
        const confirmDelete = confirm('Are you sure you want to delete this task and all its progress data?');
        
        if (confirmDelete) {
          await this.taskManager.deleteTask(taskId);
          
          // If the deleted task was the selected task in single view, reset selection
          if (this.selectedTaskId === taskId) {
            this.selectedTaskId = null;
            
            // If there are other tasks, select the first one
            const remainingTasks = await this.taskManager.getAllTasks();
            if (remainingTasks.length > 0) {
              this.selectedTaskId = remainingTasks[0].id;
            } else if (this.viewMode === 'single') {
              // Switch back to all tasks view if no tasks remain
              await this.showAllTasksView();
            }
          }
          
          // Update UI
          await this.renderTaskList();
          await this.renderProgressGrid();
          
          // Cancel editing if deleting the task being edited
          if (this.isEditing && this.editingTaskId === taskId) {
            this.cancelEditingTask();
          }
          
          console.log('Task deleted successfully');
        }
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  }