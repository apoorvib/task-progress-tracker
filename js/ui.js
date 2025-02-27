/**
 * UI Controller
 * Handles DOM manipulation and UI interactions
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
      if (!this.taskSelectorElement) console.error('Missing element: task-selector');
      
      this.isEditing = false;
      this.editingTaskId = null;
      
      // Initialize UI and event listeners
      this.init();
    }
  
    /**
     * Initialize UI and event listeners
     */
    init() {
      try {
        console.log('Initializing UI...');
        
        // Set initial view mode
        this.viewMode = 'all'; // 'all' or 'single'
        this.selectedTaskId = null;
        
        // Render initial state
        this.renderCurrentMonth();
        this.renderTaskList();
        this.updateTaskSelector();
        
        // Set up event listeners
        this.setupEventListeners();
        
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
          this.taskFormElement.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('Form submitted');
            this.handleTaskFormSubmit();
          });
        }
        
        // Month navigation
        const prevMonthButton = document.getElementById('prev-month');
        const nextMonthButton = document.getElementById('next-month');
        
        if (prevMonthButton) {
          console.log('Adding prev month button listener');
          prevMonthButton.addEventListener('click', () => {
            console.log('Previous month clicked');
            this.taskManager.previousMonth();
            this.renderCurrentMonth();
          });
        } else {
          console.error('Missing element: prev-month');
        }
        
        if (nextMonthButton) {
          console.log('Adding next month button listener');
          nextMonthButton.addEventListener('click', () => {
            console.log('Next month clicked');
            this.taskManager.nextMonth();
            this.renderCurrentMonth();
          });
        } else {
          console.error('Missing element: next-month');
        }
        
        // Event delegation for task list actions
        if (this.taskListElement) {
          console.log('Adding task list click delegation');
          this.taskListElement.addEventListener('click', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;
            
            const taskId = taskItem.dataset.taskId;
            console.log('Task item clicked:', taskId);
            
            if (e.target.classList.contains('btn-edit')) {
              console.log('Edit button clicked');
              this.startEditingTask(taskId);
            } else if (e.target.classList.contains('btn-delete')) {
              console.log('Delete button clicked');
              this.deleteTask(taskId);
            } else {
              // When clicking on a task item (not on buttons), show single task view
              console.log('Task item body clicked - showing single task view');
              this.showSingleTaskView(taskId);
            }
          });
        }
        
        // View toggle buttons
        const allTasksViewButton = document.getElementById('all-tasks-view');
        const singleTaskViewButton = document.getElementById('single-task-view');
        
        if (allTasksViewButton) {
          console.log('Adding all tasks view button listener');
          allTasksViewButton.addEventListener('click', () => {
            console.log('All tasks view clicked');
            this.showAllTasksView();
          });
        } else {
          console.error('Missing element: all-tasks-view');
        }
        
        if (singleTaskViewButton) {
          console.log('Adding single task view button listener');
          singleTaskViewButton.addEventListener('click', () => {
            console.log('Single task view clicked');
            this.showSingleTaskView();
          });
        } else {
          console.error('Missing element: single-task-view');
        }
        
        // Task selector dropdown
        if (this.taskSelectorElement) {
          console.log('Adding task selector change listener');
          this.taskSelectorElement.addEventListener('change', (e) => {
            const taskId = e.target.value;
            console.log('Task selector changed:', taskId);
            if (taskId) {
              this.selectedTaskId = taskId;
              this.renderProgressGrid();
            }
          });
        }
        
        console.log('Event listeners set up successfully');
      } catch (error) {
        console.error('Error setting up event listeners:', error);
      }
    }
    
    /**
     * Show all tasks view
     */
    showAllTasksView() {
      console.log('Showing all tasks view');
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
      try {
        console.log('Updating task selector');
        const taskSelector = document.getElementById('task-selector');
        if (!taskSelector) {
          console.error('Task selector element not found');
          return;
        }
        
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
        
        console.log('Task selector updated with', tasks.length, 'tasks');
      } catch (error) {
        console.error('Error updating task selector:', error);
      }
    }
  
    /**
     * Render the current month view
     */
    renderCurrentMonth() {
      try {
        console.log('Rendering current month');
        const { month, year, monthName } = this.taskManager.getCurrentMonthInfo();
        if (this.currentMonthYearElement) {
          this.currentMonthYearElement.textContent = `${monthName} ${year}`;
        }
        
        this.renderProgressGrid();
      } catch (error) {
        console.error('Error rendering current month:', error);
      }
    }
  
    /**
     * Render the list of tasks
     */
    renderTaskList() {
      try {
        console.log('Rendering task list');
        if (!this.taskListElement) {
          console.error('Task list element not found');
          return;
        }
        
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
    renderMiniProgress(container, taskId) {
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
          
          const level = this.taskManager.getCompletionLevel(taskId, dateStr);
          
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
    renderProgressGrid() {
      try {
        console.log('Rendering progress grid');
        if (!this.progressGridElement) {
          console.error('Progress grid element not found');
          return;
        }
        
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
        
        console.log('View mode:', this.viewMode, 'Selected task:', this.selectedTaskId);
        
        // Filter tasks if in single task view
        if (this.viewMode === 'single' && this.selectedTaskId) {
          tasks = tasks.filter(task => task.id === this.selectedTaskId);
        }
        
        console.log('Rendering grid with', tasks.length, 'tasks and', days.length, 'days');
        
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
                console.log('Cell clicked - toggling completion');
                this.toggleTaskCompletion(task.id, day.dateStr, cell);
              });
              
              this.progressGridElement.appendChild(cell);
            }
          });
        });
        
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
    toggleTaskCompletion(taskId, dateStr, cellElement) {
      try {
        console.log('Toggling task completion:', taskId, dateStr);
        
        // Remove old level class
        for (let i = 0; i <= 4; i++) {
          cellElement.classList.remove(`level-${i}`);
        }
        
        // Update level in data and UI
        const newLevel = this.taskManager.toggleCompletionLevel(taskId, dateStr);
        console.log('New completion level:', newLevel);
        cellElement.classList.add(`level-${newLevel}`);
        
        // Update mini progress if needed
        const taskItem = this.taskListElement.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (taskItem) {
          this.renderMiniProgress(taskItem.querySelector('.task-progress-mini'), taskId);
        }
      } 
      catch (error) {
        console.error('Error toggling task completion:', error);
      }
    }
}