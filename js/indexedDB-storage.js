/**
 * IndexedDB Storage Service for Task Progress Tracker
 * This is a replacement for localStorage that provides more persistent storage
 * 
 * Create a new file called indexedDB-storage.js and include it in your HTML
 * before the other JavaScript files
 */

class IndexedDBStorage {
    constructor() {
      this.DB_NAME = 'TaskProgressDB';
      this.DB_VERSION = 1;
      this.TASKS_STORE = 'tasks';
      this.SETTINGS_STORE = 'settings';
      this.db = null;
      
      // Initialize the database
      this.initDB();
    }
    
    /**
     * Initialize the IndexedDB database
     * @returns {Promise} Promise that resolves when the database is ready
     */
    async initDB() {
      if (this.db) {
        return Promise.resolve(this.db);
      }
      
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
        
        // Create object stores when database is first created or upgraded
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          // Create tasks store if it doesn't exist
          if (!db.objectStoreNames.contains(this.TASKS_STORE)) {
            // Use id as the key path
            const tasksStore = db.createObjectStore(this.TASKS_STORE, { keyPath: 'id' });
            // Create an index on the task name for searching
            tasksStore.createIndex('name', 'name', { unique: false });
            // Create an index on the creation date
            tasksStore.createIndex('created', 'created', { unique: false });
          }
          
          // Create settings store if it doesn't exist
          if (!db.objectStoreNames.contains(this.SETTINGS_STORE)) {
            db.createObjectStore(this.SETTINGS_STORE, { keyPath: 'key' });
          }
        };
        
        // Handle successful database open
        request.onsuccess = (event) => {
          this.db = event.target.result;
          console.log('IndexedDB initialized successfully');
          
          // Migrate data from localStorage if needed
          this.migrateFromLocalStorage();
          
          resolve(this.db);
        };
        
        // Handle database open errors
        request.onerror = (event) => {
          console.error('Error opening IndexedDB:', event.target.error);
          reject(event.target.error);
        };
      });
    }
    
    /**
     * Migrate data from localStorage to IndexedDB (if any exists)
     */
    async migrateFromLocalStorage() {
      try {
        // Check if we've already migrated
        const hasMigrated = await this.getSetting('localStorage_migrated');
        if (hasMigrated) {
          return;
        }
        
        // Check for tasks in localStorage
        const tasksJSON = localStorage.getItem('taskProgress_tasks');
        if (tasksJSON) {
          const tasks = JSON.parse(tasksJSON);
          if (Array.isArray(tasks) && tasks.length > 0) {
            console.log('Migrating data from localStorage to IndexedDB...');
            
            // Add all tasks from localStorage to IndexedDB
            for (const task of tasks) {
              await this.saveTask(task);
            }
            
            console.log(`Migrated ${tasks.length} tasks from localStorage`);
          }
        }
        
        // Mark migration as complete
        await this.saveSetting('localStorage_migrated', true);
        
        // Optionally clear localStorage after successful migration
        // localStorage.clear();
      } catch (error) {
        console.error('Error migrating from localStorage:', error);
      }
    }
    
    /**
     * Save a setting value
     * @param {string} key - Setting key
     * @param {any} value - Setting value
     * @returns {Promise} Promise that resolves when the setting is saved
     */
    async saveSetting(key, value) {
      await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.SETTINGS_STORE], 'readwrite');
        const store = transaction.objectStore(this.SETTINGS_STORE);
        
        const request = store.put({ key, value });
        
        request.onsuccess = () => resolve(true);
        request.onerror = (event) => {
          console.error('Error saving setting:', event.target.error);
          reject(event.target.error);
        };
      });
    }
    
    /**
     * Get a setting value
     * @param {string} key - Setting key
     * @returns {Promise} Promise that resolves with the setting value
     */
    async getSetting(key) {
      await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.SETTINGS_STORE], 'readonly');
        const store = transaction.objectStore(this.SETTINGS_STORE);
        
        const request = store.get(key);
        
        request.onsuccess = (event) => {
          const result = event.target.result;
          resolve(result ? result.value : null);
        };
        
        request.onerror = (event) => {
          console.error('Error getting setting:', event.target.error);
          reject(event.target.error);
        };
      });
    }
    
    /**
     * Get all tasks
     * @returns {Promise<Array>} Promise that resolves with an array of all tasks
     */
    async getAllTasks() {
      await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.TASKS_STORE], 'readonly');
        const store = transaction.objectStore(this.TASKS_STORE);
        
        const request = store.getAll();
        
        request.onsuccess = (event) => {
          resolve(event.target.result || []);
        };
        
        request.onerror = (event) => {
          console.error('Error getting all tasks:', event.target.error);
          reject(event.target.error);
        };
      });
    }
    
    /**
     * Save a task
     * @param {Object} task - Task object to save
     * @returns {Promise<Object>} Promise that resolves with the saved task
     */
    async saveTask(task) {
      await this.initDB();
      
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
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.TASKS_STORE], 'readwrite');
        const store = transaction.objectStore(this.TASKS_STORE);
        
        const request = store.put(task);
        
        request.onsuccess = () => {
          resolve(task);
        };
        
        request.onerror = (event) => {
          console.error('Error saving task:', event.target.error);
          reject(event.target.error);
        };
      });
    }
    
    /**
     * Get a task by ID
     * @param {string} taskId - ID of the task to retrieve
     * @returns {Promise<Object|null>} Promise that resolves with the task or null if not found
     */
    async getTaskById(taskId) {
      await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.TASKS_STORE], 'readonly');
        const store = transaction.objectStore(this.TASKS_STORE);
        
        const request = store.get(taskId);
        
        request.onsuccess = (event) => {
          resolve(event.target.result || null);
        };
        
        request.onerror = (event) => {
          console.error('Error getting task by ID:', event.target.error);
          reject(event.target.error);
        };
      });
    }
    
    /**
     * Update a task
     * @param {string} taskId - ID of the task to update
     * @param {Object} updatedTask - Updated task data
     * @returns {Promise<Object|null>} Promise that resolves with the updated task or null if not found
     */
    async updateTask(taskId, updatedTask) {
      await this.initDB();
      
      // Get the existing task
      const existingTask = await this.getTaskById(taskId);
      if (!existingTask) {
        return null;
      }
      
      // Ensure ID remains the same
      updatedTask.id = taskId;
      
      // Preserve created date
      updatedTask.created = existingTask.created;
      
      // Preserve completions if not provided
      if (!updatedTask.completions && existingTask.completions) {
        updatedTask.completions = existingTask.completions;
      }
      
      // Merge the existing task with the updated data
      const mergedTask = { ...existingTask, ...updatedTask };
      
      // Save the updated task
      return this.saveTask(mergedTask);
    }
    
    /**
     * Delete a task
     * @param {string} taskId - ID of the task to delete
     * @returns {Promise<boolean>} Promise that resolves with true if deleted, false if not found
     */
    async deleteTask(taskId) {
      await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.TASKS_STORE], 'readwrite');
        const store = transaction.objectStore(this.TASKS_STORE);
        
        // Check if the task exists
        const checkRequest = store.get(taskId);
        
        checkRequest.onsuccess = (event) => {
          if (!event.target.result) {
            // Task not found
            resolve(false);
            return;
          }
          
          // Task exists, delete it
          const deleteRequest = store.delete(taskId);
          
          deleteRequest.onsuccess = () => {
            resolve(true);
          };
          
          deleteRequest.onerror = (event) => {
            console.error('Error deleting task:', event.target.error);
            reject(event.target.error);
          };
        };
        
        checkRequest.onerror = (event) => {
          console.error('Error checking task existence:', event.target.error);
          reject(event.target.error);
        };
      });
    }
    
    /**
     * Save completion status for a task on a specific date
     * @param {string} taskId - ID of the task
     * @param {string} date - Date string in YYYY-MM-DD format
     * @param {number} level - Completion level (0-4)
     * @returns {Promise<Object|null>} Promise that resolves with the updated task or null if not found
     */
    async saveCompletion(taskId, date, level) {
      await this.initDB();
      
      // Get the task
      const task = await this.getTaskById(taskId);
      if (!task) {
        return null;
      }
      
      // Initialize completions object if needed
      if (!task.completions) {
        task.completions = {};
      }
      
      // Set completion level for the date
      task.completions[date] = level;
      
      // Save the updated task
      return this.saveTask(task);
    }
    
    /**
     * Get completion status for a task on a specific date
     * @param {string} taskId - ID of the task
     * @param {string} date - Date string in YYYY-MM-DD format
     * @returns {Promise<number>} Promise that resolves with the completion level (0-4)
     */
    async getCompletionForDate(taskId, date) {
      await this.initDB();
      
      // Get the task
      const task = await this.getTaskById(taskId);
      
      // Return the completion level or 0 if not set
      if (!task || !task.completions || !task.completions[date]) {
        return 0;
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
    
    /**
     * Export all data to a JSON object
     * @returns {Promise<Object>} Promise that resolves with the exported data
     */
    async exportData() {
      const tasks = await this.getAllTasks();
      
      return {
        tasks,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
    }
    
    /**
     * Import data from a JSON object
     * @param {Object} data - Data to import
     * @returns {Promise<boolean>} Promise that resolves with true if successful
     */
    async importData(data) {
      await this.initDB();
      
      if (!data || !Array.isArray(data.tasks)) {
        throw new Error('Invalid data format');
      }
      
      // Clear existing data
      await this.clearAllData();
      
      // Import tasks
      for (const task of data.tasks) {
        await this.saveTask(task);
      }
      
      return true;
    }
    
    /**
     * Clear all data from the database
     * @returns {Promise<boolean>} Promise that resolves with true if successful
     */
    async clearAllData() {
      await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.TASKS_STORE], 'readwrite');
        const store = transaction.objectStore(this.TASKS_STORE);
        
        const request = store.clear();
        
        request.onsuccess = () => {
          resolve(true);
        };
        
        request.onerror = (event) => {
          console.error('Error clearing data:', event.target.error);
          reject(event.target.error);
        };
      });
    }
  }
