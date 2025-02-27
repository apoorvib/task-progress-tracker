/**
 * Storage Service
 * Handles all localStorage operations for the Task Progress Tracker
 */
class TaskStorage {
    constructor() {
      this.TASKS_KEY = 'taskProgress_tasks';
      this.initializeStorage();
      console.log('TaskStorage initialized');
      
      // Log current storage state
      const tasks = this.getAllTasks();
      console.log(`Found ${tasks.length} tasks in storage`);
    }
  
    /**
     * Initialize storage if empty
     */
    initializeStorage() {
      try {
        if (!localStorage.getItem(this.TASKS_KEY)) {
          console.log('Initializing empty tasks array in localStorage');
          localStorage.setItem(this.TASKS_KEY, JSON.stringify([]));
        }
      } catch (error) {
        console.error('Error initializing storage:', error);
        throw new Error('Failed to initialize storage');
      }
    }
  
    /**
     * Get all tasks from localStorage
     * @returns {Array} Array of task objects
     */
    getAllTasks() {
      try {
        const tasksJSON = localStorage.getItem(this.TASKS_KEY);
        if (!tasksJSON) {
          console.warn('No tasks found in localStorage, returning empty array');
          return [];
        }
        
        const tasks = JSON.parse(tasksJSON);
        if (!Array.isArray(tasks)) {
          console.warn('Tasks data is not an array, resetting to empty array');
          localStorage.setItem(this.TASKS_KEY, JSON.stringify([]));
          return [];
        }
        
        return tasks;
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
        console.log('Saving task:', task);
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
        
        // Add task to array
        tasks.push(task);
        
        // Save to localStorage
        const result = this.saveTasksToStorage(tasks);
        if (!result) {
          throw new Error('Failed to save tasks to localStorage');
        }
        
        console.log('Task saved successfully, ID:', task.id);
        return task;
      } catch (error) {
        console.error('Error saving task:', error);
        throw new Error('Failed to save task: ' + error.message);
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
        console.log('Updating task:', taskId, updatedTask);
        const tasks = this.getAllTasks();
        const index = tasks.findIndex(task => task.id === taskId);
        
        if (index === -1) {
          console.warn('Task not found for update:', taskId);
          return null;
        }
        
        // Ensure ID remains the same and preserve created date
        updatedTask.id = taskId;
        updatedTask.created = tasks[index].created;
        
        // Preserve completions if not provided in update
        if (!updatedTask.completions && tasks[index].completions) {
          updatedTask.completions = tasks[index].completions;
        }
        
        // Update the task
        tasks[index] = { ...tasks[index], ...updatedTask };
        
        // Save to localStorage
        const result = this.saveTasksToStorage(tasks);
        if (!result) {
          throw new Error('Failed to save updated tasks to localStorage');
        }
        
        console.log('Task updated successfully');
        return tasks[index];
      } catch (error) {
        console.error('Error updating task:', error);
        throw new Error('Failed to update task: ' + error.message);
      }
    }
  
    /**
     * Delete a task by ID
     * @param {string} taskId - ID of the task to delete
     * @returns {boolean} True if deleted, false if not found
     */
    deleteTask(taskId) {
      try {
        console.log('Deleting task:', taskId);
        const tasks = this.getAllTasks();
        const filteredTasks = tasks.filter(task => task.id !== taskId);
        
        if (filteredTasks.length === tasks.length) {
          console.warn('Task not found for deletion:', taskId);
          return false; // Task not found
        }
        
        // Save to localStorage
        const result = this.saveTasksToStorage(filteredTasks);
        if (!result) {
          throw new Error('Failed to save tasks after deletion');
        }
        
        console.log('Task deleted successfully');
        return true;
      } catch (error) {
        console.error('Error deleting task:', error);
        throw new Error('Failed to delete task: ' + error.message);
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
        const task = tasks.find(task => task.id === taskId);
        
        if (!task) {
          console.warn('Task not found by ID:', taskId);
        }
        
        return task || null;
      } catch (error) {
        console.error('Error retrieving task by ID:', error);
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
        console.log('Saving completion:', taskId, date, level);
        const task = this.getTaskById(taskId);
        
        if (!task) {
          console.warn('Task not found for saving completion:', taskId);
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
        throw new Error('Failed to save completion: ' + error.message);
      }
    }
  
    /**
     * Get completion status for a task on a specific date
     * @param {string} taskId - ID of the task
     * @param {string} date - Date string in YYYY-MM-DD format
     * @returns {number} Completion level (0-4), defaults to 0
     */
    getCompletionForDate(taskId, date) {
      try {
        const task = this.getTaskById(taskId);
        
        if (!task || !task.completions || !task.completions[date]) {
          return 0; // Default to level 0 (incomplete)
        }
        
        return task.completions[date];
      } catch (error) {
        console.error('Error getting completion for date:', error);
        return 0; // Default to level 0 on error
      }
    }
  
    /**
     * Save tasks array to localStorage
     * @private
     * @param {Array} tasks - Array of task objects
     * @returns {boolean} True if saved successfully
     */
    saveTasksToStorage(tasks) {
      try {
        const tasksJSON = JSON.stringify(tasks);
        localStorage.setItem(this.TASKS_KEY, tasksJSON);
        return true;
      } catch (error) {
        console.error('Error saving tasks to localStorage:', error);
        return false;
      }
    }
  
    /**
     * Generate a unique ID for a task
     * @returns {string} Unique ID
     */
    generateUniqueId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
  }