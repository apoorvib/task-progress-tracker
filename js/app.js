/**
 * Main Application
 * Initializes and connects all components
 */
(function() {
    // Initialize the application when the DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
      initApp();
    });
  
    /**
     * Initialize the application
     */
    function initApp() {
      // Initialize storage service
      const storage = new TaskStorage();
      
      // Initialize task manager with storage service
      const taskManager = new TaskManager(storage);
      
      // Initialize UI controller with task manager
      const uiController = new UIController(taskManager);
      
      // Log initialization status
      console.log('Task Progress Tracker initialized');
      
      // Check for browser support
      checkBrowserSupport();
    }
  
    /**
     * Check for browser support of required features
     */
    function checkBrowserSupport() {
      // Check for localStorage support
      if (!storageAvailable('localStorage')) {
        showError('Your browser does not support localStorage. The app will not be able to save your data.');
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
        return false;
      }
    }
  
    /**
     * Show error message to the user
     * @param {string} message - Error message
     */
    function showError(message) {
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