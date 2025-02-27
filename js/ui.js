/**
 * UI Controller
 * Handles DOM manipulation and UI interactions
 */
class UIController {
    constructor(taskManager) {
      this.taskManager = taskManager;
      this.taskListElement = document.getElementById('task-list');
      this.progressGridElement = document.getElementById('progress-grid');
      this.currentMonthYearElement = document.getElementById('current-month-year');
      this.taskFormElement = document.getElementById('task-form');
      this.taskNameInput = document.getElementById('task-name');
      
      this.isEditing = false;
      this.editingTaskId = null;
      
      // Initialize UI and event listeners
      this.init();
    }
  
    /**
     * Initialize UI and event listeners
     */
    init() {
      // Set initial view mode
      this.viewMode = 'all'; // 'all' or 'single'
      this.selectedTaskId = null;
      
      // Render initial state
      this.renderCurrentMonth();
      this.renderTaskList();
      this.updateTaskSelector();
      
      // Set up event listeners
      this.setupEventListeners();
    }
  
    /**
     * Set up all event listeners
     */
    setupEventListeners() {
      // Task form submission
      this.taskFormElement.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleTaskFormSubmit();
      });
      
      // Month navigation
      document.getElementById('prev-month').addEventListener('click', () => {
        this.taskManager.previousMonth();
        this.renderCurrentMonth();
      });
      
      document.getElementById('next-month').addEventListener('click', () => {
        this.taskManager.nextMonth();
        this.renderCurrentMonth();
      });
      
      // Event delegation for task list actions
      this.taskListElement.addEventListener('click', (e) => {
        const taskItem = e.target.closest('.task-item');
        if (!taskItem) return;
        
        const taskId = taskItem.dataset.taskId;
        
        if (e.target.classList.contains('btn-edit')) {
          this.startEditingTask(taskId);
        } else if (e.target.classList.contains('btn-delete')) {
          this.deleteTask(taskId);
        } else {
          // When clicking on a task item (not on buttons), show single task view
          this.showSingleTaskView(taskId);
        }
      });
      
      // View toggle buttons
      document.getElementById('all-tasks-view').addEventListener('click', () => {
        this.showAllTasksView();
      });
      
      document.getElementById('single-task-view').addEventListener('click', () => {
        this.showSingleTaskView();
      });
      
      // Task selector dropdown
      document.getElementById('task-selector').addEventListener('change', (e) => {
        const taskId = e.target.value;
        if (taskId) {
          this.selectedTaskId = taskId;
          this.renderProgressGrid();
        }
      });
    }
    
    /**
     * Show all tasks view
     */
    showAllTasksView() {
      this.viewMode = 'all';
      document.getElementById('all-tasks-view').classList.add('active');
      document.getElementById('single-task-view').classList.remove('active');
      document.getElementById('task-selector-container').style.display = 'none';
      this.renderProgressGrid();
    }
    
    /**
     * Show single task view
     * @param {string} taskId - Optional task ID to select
     */
    showSingleTaskView(taskId = null) {
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
      if (!this.selectedTaskId && this.taskManager.getAllTasks().length > 0) {
        this.selectedTaskId = this.taskManager.getAllTasks()[0].id;
        document.getElementById('task-selector').value = this.selectedTaskId;
      }
      
      this.renderProgressGrid();
    }
    
    /**
     * Update the task selector dropdown
     */
    updateTaskSelector() {
      const taskSelector = document.getElementById('task-selector');
      const tasks = this.taskManager.getAllTasks();
      
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
    }
  
    /**
     * Render the current month view
     */
    renderCurrentMonth() {
      const { month, year, monthName } = this.taskManager.getCurrentMonthInfo();
      this.currentMonthYearElement.textContent = `${monthName} ${year}`;
      
      this.renderProgressGrid();
    }
  
    /**
     * Render the list of tasks
     */
    renderTaskList() {
      const tasks = this.taskManager.getAllTasks();
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
      
      tasks.forEach(task => {
        // Clone template
        const taskElement = template.content.cloneNode(true);
        const taskItem = taskElement.querySelector('.task-item');
        
        // Set task data
        taskItem.dataset.taskId = task.id;
        taskItem.querySelector('.task-name').textContent = task.name;
        
        // Add mini progress indicator (last 7 days)
        this.renderMiniProgress(taskItem.querySelector('.task-progress-mini'), task.id);
        
        this.taskListElement.appendChild(taskItem);
      });
    }
  
    /**
     * Render mini progress indicator for a task (last 7 days)
     * @param {HTMLElement} container - Container element
     * @param {string} taskId - Task ID
     */
    renderMiniProgress(container, taskId) {
      container.innerHTML = '';
      
      // Get last 7 days
      const today = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const dateStr = this.taskManager.formatDate(date);
        
        const level = this.taskManager.getCompletionLevel(taskId, dateStr);
        
        const cell = document.createElement('div');
        cell.className = `mini-cell level-${level}`;
        container.appendChild(cell);
      }
    }
  
    /**
     * Render the progress grid
     */
    renderProgressGrid() {
      this.progressGridElement.innerHTML = '';
      
      const days = this.taskManager.getDaysInMonth();
      let tasks = this.taskManager.getAllTasks();
      
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
      
      // Filter tasks if in single task view
      if (this.viewMode === 'single' && this.selectedTaskId) {
        tasks = tasks.filter(task => task.id === this.selectedTaskId);
      }
      
      // Create cells for each task and day
      tasks.forEach(task => {
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
        days.forEach(day => {
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
            const level = this.taskManager.getCompletionLevel(task.id, day.dateStr);
            cell.classList.add(`level-${level}`);
            
            // Add today indicator
            if (day.isToday) {
              cell.classList.add('today');
            }
            
            // Add click handler to toggle completion
            cell.addEventListener('click', () => {
              this.toggleTaskCompletion(task.id, day.dateStr, cell);
            });
            
            this.progressGridElement.appendChild(cell);
          }
        });
      });
    }
  
    /**
     * Toggle task completion level
     * @param {string} taskId - Task ID
     * @param {string} dateStr - Date string
     * @param {HTMLElement} cellElement - Cell element
     */
    toggleTaskCompletion(taskId, dateStr, cellElement) {
      // Remove old level class
      for (let i = 0; i <= 4; i++) {
        cellElement.classList.remove(`level-${i}`);
      }
      
      // Update level in data and UI
      const newLevel = this.taskManager.toggleCompletionLevel(taskId, dateStr);
      cellElement.classList.add(`level-${newLevel}`);
      
      // Update mini progress if needed
      const taskItem = this.taskListElement.querySelector(`.task-item[data-task-id="${taskId}"]`);
      if (taskItem) {
        this.renderMiniProgress(taskItem.querySelector('.task-progress-mini'), taskId);
      }
    }
  
    /**
     * Handle task form submission
     */
    handleTaskFormSubmit() {
      const taskName = this.taskNameInput.value.trim();
      
      if (!taskName) {
        alert('Please enter a task name');
        return;
      }
      
      try {
        if (this.isEditing) {
          // Update existing task
          this.taskManager.updateTask(this.editingTaskId, { name: taskName });
          this.cancelEditingTask();
        } else {
          // Create new task
          this.taskManager.createTask(taskName);
        }
        
        // Reset form
        this.taskNameInput.value = '';
        
        // Update UI
        this.renderTaskList();
        this.updateTaskSelector();
        this.renderProgressGrid();
      } catch (error) {
        alert(`Error: ${error.message}`);
      }
    }
  
    /**
     * Start editing a task
     * @param {string} taskId - Task ID
     */
    startEditingTask(taskId) {
      const task = this.taskManager.getAllTasks().find(t => t.id === taskId);
      
      if (!task) {
        return;
      }
      
      this.isEditing = true;
      this.editingTaskId = taskId;
      this.taskNameInput.value = task.name;
      this.taskNameInput.focus();
      
      // Change button text
      const submitButton = this.taskFormElement.querySelector('button[type="submit"]');
      submitButton.textContent = 'Update Task';
      
      // Add cancel button if it doesn't exist
      if (!this.taskFormElement.querySelector('.btn-cancel')) {
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'btn btn-cancel';
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', () => this.cancelEditingTask());
        
        submitButton.parentNode.insertBefore(cancelButton, submitButton.nextSibling);
      }
    }
  
    /**
     * Cancel editing a task
     */
    cancelEditingTask() {
      this.isEditing = false;
      this.editingTaskId = null;
      this.taskNameInput.value = '';
      
      // Restore button text
      const submitButton = this.taskFormElement.querySelector('button[type="submit"]');
      submitButton.textContent = 'Add Task';
      
      // Remove cancel button
      const cancelButton = this.taskFormElement.querySelector('.btn-cancel');
      if (cancelButton) {
        cancelButton.remove();
      }
    }
  
    /**
     * Delete a task
     * @param {string} taskId - Task ID
     */
    deleteTask(taskId) {
      const confirmDelete = confirm('Are you sure you want to delete this task and all its progress data?');
      
      if (confirmDelete) {
        this.taskManager.deleteTask(taskId);
        
        // Update UI
        this.renderTaskList();
        this.renderProgressGrid();
        
        // Cancel editing if deleting the task being edited
        if (this.isEditing && this.editingTaskId === taskId) {
          this.cancelEditingTask();
        }
      }
    }
  }