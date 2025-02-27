/**
 * Modified TaskManager class to work with IndexedDB
 * This file replaces your existing taskManager.js
 */

class TaskManager {
    constructor(storage) {
      this.storage = storage;
      this.currentDate = new Date();
      this.currentMonth = this.currentDate.getMonth();
      this.currentYear = this.currentDate.getFullYear();
    }
  
    /**
     * Get all tasks
     * @returns {Promise<Array>} Promise that resolves with an array of task objects
     */
    async getAllTasks() {
      return this.storage.getAllTasks();
    }
  
    /**
     * Create a new task
     * @param {string} name - Name of the task
     * @returns {Promise<Object>} Promise that resolves with the created task
     */
    async createTask(name) {
      if (!name || name.trim() === '') {
        throw new Error('Task name cannot be empty');
      }
  
      const task = {
        name: name.trim(),
        completions: {},
        created: new Date().toISOString()
      };
  
      return this.storage.saveTask(task);
    }
  
    /**
     * Update a task
     * @param {string} taskId - ID of the task to update
     * @param {Object} taskData - Updated task data
     * @returns {Promise<Object|null>} Promise that resolves with the updated task or null if not found
     */
    async updateTask(taskId, taskData) {
      return this.storage.updateTask(taskId, taskData);
    }
  
    /**
     * Delete a task
     * @param {string} taskId - ID of the task to delete
     * @returns {Promise<boolean>} Promise that resolves with true if deleted, false if not found
     */
    async deleteTask(taskId) {
      return this.storage.deleteTask(taskId);
    }
  
    /**
     * Toggle completion level for a task on a specific date
     * @param {string} taskId - ID of the task
     * @param {string} dateStr - Date string in YYYY-MM-DD format
     * @returns {Promise<number>} Promise that resolves with the new completion level
     */
    async toggleCompletionLevel(taskId, dateStr) {
      const currentLevel = await this.storage.getCompletionForDate(taskId, dateStr);
      const newLevel = (currentLevel + 1) % 5; // Cycle through 0-4
      
      await this.storage.saveCompletion(taskId, dateStr, newLevel);
      return newLevel;
    }
  
    /**
     * Get completion level for a task on a specific date
     * @param {string} taskId - ID of the task
     * @param {string} dateStr - Date string in YYYY-MM-DD format
     * @returns {Promise<number>} Promise that resolves with the completion level (0-4)
     */
    async getCompletionLevel(taskId, dateStr) {
      return this.storage.getCompletionForDate(taskId, dateStr);
    }
  
    /**
     * Navigate to previous month
     */
    previousMonth() {
      this.currentMonth--;
      if (this.currentMonth < 0) {
        this.currentMonth = 11;
        this.currentYear--;
      }
      return this.getCurrentMonthInfo();
    }
  
    /**
     * Navigate to next month
     */
    nextMonth() {
      this.currentMonth++;
      if (this.currentMonth > 11) {
        this.currentMonth = 0;
        this.currentYear++;
      }
      return this.getCurrentMonthInfo();
    }
  
    /**
     * Get current month and year
     * @returns {Object} Object with month and year
     */
    getCurrentMonthInfo() {
      return {
        month: this.currentMonth,
        year: this.currentYear,
        monthName: this.getMonthName(this.currentMonth)
      };
    }
  
    /**
     * Get month name by index
     * @param {number} monthIndex - Month index (0-11)
     * @returns {string} Month name
     */
    getMonthName(monthIndex) {
      const monthNames = [
        'January', 'February', 'March', 'April', 
        'May', 'June', 'July', 'August',
        'September', 'October', 'November', 'December'
      ];
      return monthNames[monthIndex];
    }
  
    /**
     * Get days in the current month
     * @returns {Array} Array of day objects with date and status info
     */
    getDaysInMonth() {
      const year = this.currentYear;
      const month = this.currentMonth;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayOfMonth = new Date(year, month, 1).getDay();
      
      // Adjust day index (0-6) to our grid (0 = Monday, 6 = Sunday)
      const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
      
      const days = [];
      
      // Add empty cells for days before the 1st of the month
      for (let i = 0; i < adjustedFirstDay; i++) {
        days.push({ empty: true });
      }
      
      // Add days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = this.formatDate(date);
        const isToday = this.isToday(date);
        
        days.push({
          date: date,
          day: day,
          dateStr: dateStr,
          isToday: isToday
        });
      }
      
      return days;
    }
  
    /**
     * Format date to YYYY-MM-DD string
     * @param {Date} date - Date object
     * @returns {string} Formatted date string
     */
    formatDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  
    /**
     * Check if a date is today
     * @param {Date} date - Date to check
     * @returns {boolean} True if the date is today
     */
    isToday(date) {
      const today = new Date();
      return date.getDate() === today.getDate() &&
             date.getMonth() === today.getMonth() &&
             date.getFullYear() === today.getFullYear();
    }
  
    /**
     * Add sample tasks for demonstration
     * @returns {Promise<boolean>} Promise that resolves with true if sample tasks were added
     */
    async addSampleTasks() {
      const existingTasks = await this.getAllTasks();
      
      // Only add sample tasks if there are no existing tasks
      if (existingTasks.length > 0) {
        return false;
      }
      
      const sampleTasks = [
        { name: 'Morning Exercise' },
        { name: 'Read for 30 minutes' },
        { name: 'Write in journal' },
        { name: 'Drink 8 glasses of water' },
        { name: 'Meditate' }
      ];
      
      // Create sample tasks
      for (const taskData of sampleTasks) {
        await this.createTask(taskData.name);
      }
      
      // Add some sample completions for the past few days
      const today = new Date();
      const createdTasks = await this.getAllTasks();
      
      for (let i = 0; i < createdTasks.length; i++) {
        // Add random completions for the past 10 days
        for (let d = 0; d < 10; d++) {
          const date = new Date();
          date.setDate(today.getDate() - d);
          const dateStr = this.formatDate(date);
          
          // Add a random completion level (more likely to be higher for recent days)
          const randomLevel = Math.min(
            Math.floor(Math.random() * 5),
            Math.floor(Math.random() * (5 - Math.min(d/3, 3)))
          );
          
          if (randomLevel > 0) {
            await this.storage.saveCompletion(createdTasks[i].id, dateStr, randomLevel);
          }
        }
      }
      
      return true;
    }
  
    /**
     * Export all data
     * @returns {Promise<Object>} Promise that resolves with exported data
     */
    async exportData() {
      return this.storage.exportData();
    }
  
    /**
     * Import data
     * @param {Object} data - Data to import
     * @returns {Promise<boolean>} Promise that resolves with true if successful
     */
    async importData(data) {
      return this.storage.importData(data);
    }
  }