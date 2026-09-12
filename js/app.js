document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('current-year').textContent = new Date().getFullYear();
    try {
        const storage = new SyncStorage();
        new SyncUI(storage);
        await storage.initDB();
        const taskManager = new TaskManager(storage);
        const ui = new UIController(taskManager);
        await ui.ready;
        let refreshTimer;
        storage.addEventListener('datachange', () => {
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(async () => {
                await ui.loadViewSettings();
                await ui.renderTaskList();
                await ui.renderProgressGrid();
            }, 50);
        });
        await storage.startSync();
    } catch (error) {
        const status = document.getElementById('sync-status');
        status.textContent = `Storage unavailable: ${error.message}`;
        status.dataset.state = 'error';
        document.querySelectorAll('#task-form input, #task-form button').forEach(control => { control.disabled = true; });
    }
});
