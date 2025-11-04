const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const readline = require('readline');

class AdvancedAutoLogin {
    constructor() {
        this.LOGIN_URL = "http://hotspot2.stymsta.sch.id/login";
        this.CONFIG_FILE = path.join(__dirname, "config.json");
        this.SESSION_FILE = path.join(__dirname, "session.json");
        this.LOG_FILE = path.join(__dirname, "login.log");
        this.retryCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 5000;
        this.checkInterval = 15 * 60 * 1000;
        this.isRunning = false;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async showWelcome() {
        console.clear();
        console.log("AUTO LOGIN HOTSPOT");
        console.log("");
        
        await this.showRequirements();
        return await this.checkRequirements();
    }

    async showRequirements() {
        console.log("SYSTEM REQUIREMENTS:");
        console.log("1. Termux (updated)");
        console.log("2. Internet connection");
        console.log("3. Hotspot login credentials");
        console.log("4. Storage permission for Termux");
        console.log("5. Node.js installed");
        console.log("");
    }

    async checkRequirements() {
        console.log("CHECKING REQUIREMENTS...");
        console.log("");

        const checks = {
            nodejs: this.checkNodeJS(),
            internet: this.checkInternetConnection(),
            storage: this.checkStoragePermission(),
            dependencies: this.checkDependencies()
        };

        const results = await Promise.allSettled([
            checks.nodejs,
            checks.internet,
            checks.storage,
            checks.dependencies
        ]);

        let allPassed = true;

        if (results[0].status === 'fulfilled' && results[0].value) {
            console.log("PASS - Node.js is installed");
        } else {
            console.log("FAIL - Node.js is not installed");
            allPassed = false;
        }

        if (results[1].status === 'fulfilled' && results[1].value) {
            console.log("PASS - Internet connection available");
        } else {
            console.log("WARN - No internet connection");
        }

        if (results[2].status === 'fulfilled' && results[2].value) {
            console.log("PASS - Storage permission granted");
        } else {
            console.log("FAIL - Storage permission might be restricted");
            allPassed = false;
        }

        if (results[3].status === 'fulfilled' && results[3].value) {
            console.log("PASS - Dependencies installed");
        } else {
            console.log("Installing dependencies...");
            await this.installDependencies();
        }

        console.log("");

        if (!allPassed) {
            console.log("SOME REQUIREMENTS ARE NOT MET");
            await this.showFixInstructions();
            return false;
        }

        console.log("ALL REQUIREMENTS MET");
        return true;
    }

    async checkNodeJS() {
        try {
            const version = process.version;
            return version !== undefined;
        } catch (error) {
            return false;
        }
    }

    async checkInternetConnection() {
        try {
            await axios.get("http://www.google.com", { timeout: 5000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    async checkStoragePermission() {
        try {
            await fs.access(__dirname);
            const testFile = path.join(__dirname, ".test-permission");
            await fs.writeFile(testFile, "test");
            await fs.unlink(testFile);
            return true;
        } catch (error) {
            return false;
        }
    }

    async checkDependencies() {
        try {
            require("axios");
            return true;
        } catch (error) {
            return false;
        }
    }

    async installDependencies() {
        try {
            console.log("Installing axios...");
            const { execSync } = require('child_process');
            execSync('npm install axios', { stdio: 'inherit' });
            console.log("Dependencies installed successfully");
            return true;
        } catch (error) {
            console.log("Failed to install dependencies");
            return false;
        }
    }

    async showFixInstructions() {
        console.log("FIX INSTRUCTIONS:");
        console.log("For Termux:");
        console.log("  pkg update && pkg upgrade");
        console.log("  pkg install nodejs git -y");
        console.log("  termux-setup-storage");
        console.log("");
        console.log("For Storage Permission:");
        console.log("  - Open Termux");
        console.log("  - Run: termux-setup-storage");
        console.log("  - Grant permission when prompted");
        
        await this.waitForUser("Press Enter to continue...");
    }

    async setupWizard() {
        console.log("SETUP WIZARD");
        console.log("Let's configure your auto login system...");
        
        let config = {
            username: "",
            password: "",
            settings: {
                enableNotifications: true,
                autoRetry: true,
                checkConnection: true,
                logToFile: true
            }
        };

        config.username = await this.askQuestion("Enter your hotspot username: ");
        config.password = await this.askQuestion("Enter your hotspot password: ");
        
        console.log("SETTINGS SUMMARY:");
        console.log(`Username: ${config.username}`);
        console.log(`Password: ${config.password.replace(/./g, '*')}`);
        console.log(`Auto Retry: ${config.settings.autoRetry ? 'Yes' : 'No'}`);
        console.log(`Check Connection: ${config.settings.checkConnection ? 'Yes' : 'No'}`);
        
        const confirm = await this.askQuestion("Save this configuration? (y/n): ");
        
        if (confirm.toLowerCase() === 'y') {
            await this.saveConfig(config);
            console.log("Configuration saved successfully");
            return config;
        } else {
            console.log("Configuration cancelled");
            return null;
        }
    }

    async askQuestion(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer);
            });
        });
    }

    async waitForUser(message = "Press Enter to continue...") {
        return new Promise((resolve) => {
            this.rl.question(message, () => {
                resolve();
            });
        });
    }

    async saveConfig(config) {
        try {
            await fs.writeFile(this.CONFIG_FILE, JSON.stringify(config, null, 2));
            return true;
        } catch (error) {
            console.error("Failed to save config:", error.message);
            return false;
        }
    }

    async loadConfig() {
        try {
            const configData = await fs.readFile(this.CONFIG_FILE, "utf8");
            return JSON.parse(configData);
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log("No configuration found. Starting setup wizard...");
                const config = await this.setupWizard();
                if (config) {
                    return config;
                } else {
                    throw new Error("Setup cancelled by user");
                }
            }
            throw error;
        }
    }

    async showMainMenu() {
        console.clear();
        console.log("MAIN MENU");
        console.log("");
        
        const status = await this.getServiceStatus();
        console.log(`CURRENT STATUS: ${status}`);
        console.log("");

        console.log("1. Start Auto Login Service");
        console.log("2. Stop Service");
        console.log("3. Configuration Settings");
        console.log("4. View Logs");
        console.log("5. Test Login");
        console.log("6. System Info");
        console.log("7. Help & Tutorial");
        console.log("8. Exit");
        console.log("");

        const choice = await this.askQuestion("Select an option (1-8): ");

        switch (choice) {
            case '1':
                await this.startService();
                break;
            case '2':
                await this.stopService();
                break;
            case '3':
                await this.showConfigMenu();
                break;
            case '4':
                await this.showLogs();
                break;
            case '5':
                await this.testLogin();
                break;
            case '6':
                await this.showSystemInfo();
                break;
            case '7':
                await this.showHelp();
                break;
            case '8':
                await this.exitApp();
                return;
            default:
                console.log("Invalid option. Please try again.");
                await this.waitForUser();
        }

        await this.showMainMenu();
    }

    async getServiceStatus() {
        if (this.isRunning) {
            return "RUNNING";
        } else {
            return "STOPPED";
        }
    }

    async startService() {
        if (this.isRunning) {
            console.log("Service is already running!");
            await this.waitForUser();
            return;
        }

        try {
            const config = await this.loadConfig();
            console.log("Starting service...");
            
            this.isRunning = true;
            this.loginInterval = setInterval(() => {
                this.executeLogin(config);
            }, this.checkInterval);

            await this.executeLogin(config);
            
            console.log("Service started successfully!");
            console.log(`Auto login every ${this.checkInterval/60000} minutes`);
            this.logToFile("Service started");

        } catch (error) {
            console.log(`Failed to start service: ${error.message}`);
        }
        
        await this.waitForUser();
    }

    async stopService() {
        if (!this.isRunning) {
            console.log("Service is not running!");
            await this.waitForUser();
            return;
        }

        if (this.loginInterval) {
            clearInterval(this.loginInterval);
        }
        this.isRunning = false;
        console.log("Service stopped successfully!");
        this.logToFile("Service stopped");
        await this.waitForUser();
    }

    async showConfigMenu() {
        console.clear();
        console.log("CONFIGURATION");
        console.log("");

        try {
            const config = await this.loadConfig();
            console.log("Current Configuration:");
            console.log(`Username: ${config.username}`);
            console.log(`Password: ${config.password.replace(/./g, '*')}`);
            console.log(`Auto Retry: ${config.settings.autoRetry ? 'Yes' : 'No'}`);
            console.log(`Check Connection: ${config.settings.checkConnection ? 'Yes' : 'No'}`);
            console.log(`Log to File: ${config.settings.logToFile ? 'Yes' : 'No'}`);
            console.log("");

            console.log("1. Edit Username");
            console.log("2. Edit Password");
            console.log("3. Toggle Auto Retry");
            console.log("4. Toggle Connection Check");
            console.log("5. Reset Configuration");
            console.log("6. Back to Main Menu");
            console.log("");

            const choice = await this.askQuestion("Select an option (1-6): ");

            switch (choice) {
                case '1':
                    const newUsername = await this.askQuestion("New username: ");
                    config.username = newUsername;
                    await this.saveConfig(config);
                    console.log("Username updated!");
                    break;
                case '2':
                    const newPassword = await this.askQuestion("New password: ");
                    config.password = newPassword;
                    await this.saveConfig(config);
                    console.log("Password updated!");
                    break;
                case '3':
                    config.settings.autoRetry = !config.settings.autoRetry;
                    await this.saveConfig(config);
                    console.log(`Auto Retry: ${config.settings.autoRetry ? 'Enabled' : 'Disabled'}`);
                    break;
                case '4':
                    config.settings.checkConnection = !config.settings.checkConnection;
                    await this.saveConfig(config);
                    console.log(`Connection Check: ${config.settings.checkConnection ? 'Enabled' : 'Disabled'}`);
                    break;
                case '5':
                    const confirm = await this.askQuestion("Are you sure you want to reset configuration? (y/n): ");
                    if (confirm.toLowerCase() === 'y') {
                        await fs.unlink(this.CONFIG_FILE);
                        console.log("Configuration reset. Please restart the app.");
                        await this.waitForUser();
                        process.exit(0);
                    }
                    break;
                case '6':
                    return;
                default:
                    console.log("Invalid option");
            }

            await this.waitForUser();
            await this.showConfigMenu();

        } catch (error) {
            console.log(`Error loading configuration: ${error.message}`);
            await this.waitForUser();
        }
    }

    async showLogs() {
        try {
            const logs = await fs.readFile(this.LOG_FILE, "utf8");
            console.clear();
            console.log("LOGS");
            console.log("");
            console.log(logs || "No logs available");
        } catch (error) {
            console.log("No logs found or error reading logs");
        }
        
        await this.waitForUser();
    }

    async testLogin() {
        console.log("Testing login...");
        
        try {
            const config = await this.loadConfig();
            const result = await this.executeLogin(config, true);
            
            if (result.success) {
                console.log("Login test successful!");
            } else {
                console.log("Login test failed!");
            }
        } catch (error) {
            console.log(`Test failed: ${error.message}`);
        }
        
        await this.waitForUser();
    }

    async showSystemInfo() {
        console.clear();
        console.log("SYSTEM INFO");
        console.log("");
        
        console.log(`Node.js Version: ${process.version}`);
        console.log(`Platform: ${process.platform}`);
        console.log(`Architecture: ${process.arch}`);
        console.log(`Current Directory: ${__dirname}`);
        console.log(`Service Status: ${this.isRunning ? 'Running' : 'Stopped'}`);
        
        try {
            const config = await this.loadConfig();
            console.log(`Username: ${config.username}`);
            console.log(`Auto Retry: ${config.settings.autoRetry}`);
        } catch (error) {
            console.log("Config: Not loaded");
        }
        
        await this.waitForUser();
    }

    async showHelp() {
        console.clear();
        console.log("HELP & TUTORIAL");
        console.log("");
        
        console.log("HOW TO USE:");
        console.log("1. Configure your username/password in Configuration menu");
        console.log("2. Start the service - it will auto login every 15 minutes");
        console.log("3. Service runs in background while Termux is open");
        console.log("4. Use 'Test Login' to verify credentials");
        console.log("");
        
        console.log("TERMUX SETUP:");
        console.log("pkg update && pkg upgrade");
        console.log("pkg install nodejs git -y");
        console.log("termux-setup-storage");
        console.log("git clone https://github.com/dvalgtr/auto-lofi.git");
        console.log("cd auto-lofi");
        console.log("node autolofi.js");
        console.log("");
        
        console.log("AUTO START:");
        console.log("Add to ~/.bashrc:");
        console.log('echo "cd /path/to/app && node app.js start" >> ~/.bashrc');
        console.log("");
        
        await this.waitForUser();
    }

    async exitApp() {
        console.log("Thank you for using Auto Login Hotspot!");
        if (this.isRunning) {
            await this.stopService();
        }
        this.rl.close();
        process.exit(0);
    }

    async executeLogin(config, isTest = false) {
        const timestamp = new Date().toLocaleString();
        const logMessage = `[${timestamp}] ${isTest ? 'TEST ' : ''}Login attempt`;
        
        if (!isTest) {
            this.logToFile(logMessage);
        }

        console.log(logMessage);

        for (let attempt = 1; attempt <= (config.settings.autoRetry ? this.maxRetries : 1); attempt++) {
            try {
                const response = await axios.post(this.LOGIN_URL, {
                    username: config.username,
                    password: config.password
                }, {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent": "Mozilla/5.0 (Linux; Android 10; Termux)"
                    },
                    timeout: 10000
                });

                if (response.status === 200) {
                    const successMsg = `Login successful (Attempt ${attempt})`;
                    console.log(successMsg);
                    if (!isTest) {
                        this.logToFile(successMsg);
                    }
                    return { success: true, attempt };
                }
            } catch (error) {
                const errorMsg = `Attempt ${attempt} failed: ${error.message}`;
                console.log(errorMsg);
                if (!isTest) {
                    this.logToFile(errorMsg);
                }
                
                if (attempt < this.maxRetries && config.settings.autoRetry) {
                    console.log(`Retrying in ${this.retryDelay/1000}s...`);
                    await this.delay(this.retryDelay);
                }
            }
        }

        const failureMsg = "All login attempts failed";
        console.log(failureMsg);
        if (!isTest) {
            this.logToFile(failureMsg);
        }
        return { success: false };
    }

    logToFile(message) {
        fs.appendFile(this.LOG_FILE, message + '\n').catch(() => {});
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    const app = new AdvancedAutoLogin();
    
    try {
        const requirementsMet = await app.showWelcome();
        
        if (requirementsMet) {
            await app.showMainMenu();
        } else {
            console.log("Please fix the requirements and restart the application.");
            await app.waitForUser("Press Enter to exit...");
            process.exit(1);
        }
    } catch (error) {
        console.error("Fatal error:", error);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    console.log("Received shutdown signal. Goodbye!");
    process.exit(0);
});

if (require.main === module) {
    main().catch(console.error);
}

module.exports = AdvancedAutoLogin;