/**
 * Main Application
 * Initializes and connects all components - adapted for IndexedDB
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
  async function initApp() {
    try {
      // Check for browser support before proceeding
      if (!window.indexedDB) {
        showError('Your browser does not support IndexedDB. The app will not be able to save your data.');
        return;
      }
      
      console.log('Initializing IndexedDB storage...');
      // Initialize storage service (IndexedDB)
      const storage = new IndexedDBStorage();
      
      console.log('Initializing task manager...');
      // Initialize task manager with storage service
      const taskManager = new TaskManager(storage);
      
      // Add sample tasks if this is the first time using the app
      try {
        const hasSampleTasks = await storage.getSetting('hasSampleTasks');
        if (hasSampleTasks !== 'true') {
          console.log('First run detected, adding sample tasks...');
          await taskManager.addSampleTasks();
          await storage.saveSetting('hasSampleTasks', 'true');
        }
      } catch (error) {
        console.error('Error checking for sample tasks:', error);
      }
      
      console.log('Initializing UI controller...');
      // Initialize UI controller with task manager
      const uiController = new UIController(taskManager);
      
      // Log initialization status
      console.log('Task Progress Tracker initialized successfully');
    } catch (error) {
      console.error('Error initializing app:', error);
      showError('Error initializing app: ' + error.message);
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