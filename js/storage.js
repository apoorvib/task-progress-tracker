/**
 * Storage Service
 * Handles all localStorage operations for the Task Progress Tracker
 */
class TaskStorage {
    constructor() {
      this.TASKS_KEY = 'taskProgress_tasks';
      this.initializeStorage();
    }
  
    /**
     * Initialize storage if empty
     */
    initializeStorage() {
      if (!localStorage.getItem(this.TASKS_KEY)) {
        localStorage.setItem(this.TASKS_KEY, JSON.stringify([]));
      }
    }
  
    /**
     * Get all tasks from localStorage
     * @returns {Array} Array of task objects
     */
    getAllTasks() {
      try {
        return JSON.parse(localStorage.getItem(this.TASKS_KEY)) || [];
      } catch (error) {
        console.error('Error retrieving tasks from storage:', error);
        return [];
      }
    }
  
    /**
     * Save a new task to localStorage
     * @param {Object} task - Task object to save
     * @returns {Object} Saved task with generated ID
     */
    saveTask(task) {
      try {
        const tasks = this.getAllTasks();
        
        // Generate a unique ID if not provided
        if (!task.id) {
          task.id = this.generateUniqueId();
        }
        
        // Set creation date if not provided
        if (!task.created) {
          task.created = new Date().toISOString();
        }
        
        // Initialize completions object if not provided
        if (!task.completions) {
          task.completions = {};
        }
        
        tasks.push(task);
        localStorage.setItem(this.TASKS_KEY, JSON.stringify(tasks));
        return task;
      } catch (error) {
        console.error('Error saving task:', error);
        throw new Error('Failed to save task');
      }
    }
  
    /**
     * Update an existing task
     * @param {string} taskId - ID of the task to update
     * @param {Object} updatedTask - Updated task data
     * @returns {Object|null} Updated task or null if not found
     */
    updateTask(taskId, updatedTask) {
      try {
        const tasks = this.getAllTasks();
        const index = tasks.findIndex(task => task.id === taskId);
        
        if (index === -1) {
          return null;
        }
        
        // Ensure ID remains the same and preserve created date
        updatedTask.id = taskId;
        updatedTask.created = tasks[index].created;
        
        // Update the task
        tasks[index] = { ...tasks[index], ...updatedTask };
        localStorage.setItem(this.TASKS_KEY, JSON.stringify(tasks));
        
        return tasks[index];
      } catch (error) {
        console.error('Error updating task:', error);
        throw new Error('Failed to update task');
      }
    }
  
    /**
     * Delete a task by ID
     * @param {string} taskId - ID of the task to delete
     * @returns {boolean} True if deleted, false if not found
     */
    deleteTask(taskId) {
      try {
        const tasks = this.getAllTasks();
        const filteredTasks = tasks.filter(task => task.id !== taskId);
        
        if (filteredTasks.length === tasks.length) {
          return false; // Task not found
        }
        
        localStorage.setItem(this.TASKS_KEY, JSON.stringify(filteredTasks));
        return true;
      } catch (error) {
        console.error('Error deleting task:', error);
        throw new Error('Failed to delete task');
      }
    }
  
    /**
     * Get a task by ID
     * @param {string} taskId - ID of the task to retrieve
     * @returns {Object|null} Task object or null if not found
     */
    getTaskById(taskId) {
      try {
        const tasks = this.getAllTasks();
        return tasks.find(task => task.id === taskId) || null;
      } catch (error) {
        console.error('Error retrieving task:', error);
        return null;
      }
    }
  
    /**
     * Save completion status for a task on a specific date
     * @param {string} taskId - ID of the task
     * @param {string} date - Date string in YYYY-MM-DD format
     * @param {number} level - Completion level (0-4)
     * @returns {Object|null} Updated task or null if not found
     */
    saveCompletion(taskId, date, level) {
      try {
        const task = this.getTaskById(taskId);
        
        if (!task) {
          return null;
        }
        
        // Initialize completions object if needed
        if (!task.completions) {
          task.completions = {};
        }
        
        // Set completion level for the date
        task.completions[date] = level;
        
        return this.updateTask(taskId, task);
      } catch (error) {
        console.error('Error saving completion:', error);
        throw new Error('Failed to save completion status');
      }
    }
  
    /**
     * Get completion status for a task on a specific date
     * @param {string} taskId - ID of the task
     * @param {string} date - Date string in YYYY-MM-DD format
     * @returns {number} Completion level (0-4), defaults to 0
     */
    getCompletionForDate(taskId, date) {
      const task = this.getTaskById(taskId);
      
      if (!task || !task.completions || !task.completions[date]) {
        return 0; // Default to level 0 (incomplete)
      }
      
      return task.completions[date];
    }
  
    /**
     * Generate a unique ID for a task
     * @returns {string} Unique ID
     */
    generateUniqueId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
  }