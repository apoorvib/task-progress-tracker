/**
 * Main Application
 * Initializes and connects all components
 */
(function() {
  // Initialize the application when the DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded, initializing app...');
    initApp();
  });

  /**
   * Initialize the application
   */
  function initApp() {
    try {
      // Check for browser support before proceeding
      if (!storageAvailable('localStorage')) {
        showError('Your browser does not support localStorage. The app will not be able to save your data.');
        return;
      }
      
      console.log('Initializing storage...');
      // Initialize storage service
      const storage = new TaskStorage();
      
      console.log('Initializing task manager...');
      // Initialize task manager with storage service
      const taskManager = new TaskManager(storage);
      
      // Add sample tasks if this is the first time using the app
      const firstRun = localStorage.getItem('taskProgressFirstRun') !== 'false';
      if (firstRun) {
        console.log('First run detected, adding sample tasks...');
        taskManager.addSampleTasks();
        localStorage.setItem('taskProgressFirstRun', 'false');
      }
      
      console.log('Initializing UI controller...');
      // Initialize UI controller with task manager
      const uiController = new UIController(taskManager);
      
      // Test localStorage by saving and retrieving a test value
      try {
        localStorage.setItem('taskProgressTest', 'test');
        const testValue = localStorage.getItem('taskProgressTest');
        if (testValue !== 'test') {
          throw new Error('localStorage test failed');
        }
        localStorage.removeItem('taskProgressTest');
        console.log('localStorage test passed');
      } catch (e) {
        showError('Error accessing localStorage: ' + e.message);
      }
      
      // Log initialization status
      console.log('Task Progress Tracker initialized successfully');
    } catch (error) {
      console.error('Error initializing app:', error);
      showError('Error initializing app: ' + error.message);
    }
  }

  /**
   * Check if a type of storage is available
   * @param {string} type - Type of storage ('localStorage', 'sessionStorage')
   * @returns {boolean} True if available, false otherwise
   */
  function storageAvailable(type) {
    try {
      var storage = window[type],
          x = '__storage_test__';
      storage.setItem(x, x);
      storage.removeItem(x);
      return true;
    }
    catch(e) {
      console.error('Storage not available:', e);
      return false;
    }
  }

  /**
   * Show error message to the user
   * @param {string} message - Error message
   */
  function showError(message) {
    console.error('ERROR:', message);
    
    // Create error element
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.style.backgroundColor = '#f8d7da';
    errorElement.style.color = '#721c24';
    errorElement.style.padding = '1rem';
    errorElement.style.margin = '1rem';
    errorElement.style.borderRadius = '0.25rem';
    errorElement.style.textAlign = 'center';
    errorElement.textContent = message;
    
    // Insert at the top of the body
    document.body.insertBefore(errorElement, document.body.firstChild);
  }
})();