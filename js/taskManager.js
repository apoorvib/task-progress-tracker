/**
 * Task Manager
 * Handles business logic for tasks and their completions
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
     * @returns {Array} Array of task objects
     */
    getAllTasks() {
      return this.storage.getAllTasks();
    }
  
    /**
     * Create a new task
     * @param {string} name - Name of the task
     * @returns {Object} Created task
     */
    createTask(name) {
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
     * @returns {Object|null} Updated task or null if not found
     */
    updateTask(taskId, taskData) {
      return this.storage.updateTask(taskId, taskData);
    }
  
    /**
     * Delete a task
     * @param {string} taskId - ID of the task to delete
     * @returns {boolean} True if deleted, false if not found
     */
    deleteTask(taskId) {
      return this.storage.deleteTask(taskId);
    }
  
    /**
     * Toggle completion level for a task on a specific date
     * @param {string} taskId - ID of the task
     * @param {string} dateStr - Date string in YYYY-MM-DD format
     * @returns {number} New completion level
     */
    toggleCompletionLevel(taskId, dateStr) {
      const currentLevel = this.storage.getCompletionForDate(taskId, dateStr);
      const newLevel = (currentLevel + 1) % 5; // Cycle through 0-4
      
      this.storage.saveCompletion(taskId, dateStr, newLevel);
      return newLevel;
    }
  
    /**
     * Get completion level for a task on a specific date
     * @param {string} taskId - ID of the task
     * @param {string} dateStr - Date string in YYYY-MM-DD format
     * @returns {number} Completion level (0-4)
     */
    getCompletionLevel(taskId, dateStr) {
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
     * Get completion statistics for a task
     * @param {string} taskId - ID of the task
     * @returns {Object} Statistics object
     */
    getTaskStats(taskId) {
      const task = this.storage.getTaskById(taskId);
      
      if (!task) {
        return null;
      }
      
      const completions = task.completions || {};
      const completionDates = Object.keys(completions);
      const completionValues = Object.values(completions);
      
      // Total completed days (level > 0)
      const completedDays = completionValues.filter(level => level > 0).length;
      
      // Fully completed days (level === 4)
      const fullyCompletedDays = completionValues.filter(level => level === 4).length;
      
      // Current streak
      let currentStreak = 0;
      const today = this.formatDate(new Date());
      
      // Check for days going backward from today
      for (let i = 0; i < 1000; i++) { // Set a reasonable limit
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = this.formatDate(date);
        
        const level = completions[dateStr] || 0;
        
        if (level > 0) {
          currentStreak++;
        } else if (dateStr !== today) { // Allow today to be not completed yet
          break;
        }
      }
      
      return {
        totalDays: completionDates.length,
        completedDays: completedDays,
        fullyCompletedDays: fullyCompletedDays,
        currentStreak: currentStreak,
        completionRate: completionDates.length ? Math.round((completedDays / completionDates.length) * 100) : 0
      };
    }
    /**
     * Add sample tasks for demonstration
     * @returns {boolean} True if sample tasks were added
     */
    addSampleTasks()
    {
        const existingTasks = this.getAllTasks();
        
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
        sampleTasks.forEach(task => {
        this.createTask(task.name);
        });
        
        // Add some sample completions for the past few days
        const today = new Date();
        const createdTasks = this.getAllTasks();
        
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
            this.storage.saveCompletion(createdTasks[i].id, dateStr, randomLevel);
            }
        }
        }
        
        return true;
    }
}