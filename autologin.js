const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");

class AdvancedAutoLogin {
    constructor() {
        this.LOGIN_URL = "http://hotspot2.stymsta.sch.id/login";
        this.CONFIG_FILE = path.join(__dirname, "config.json");
        this.SESSION_FILE = path.join(__dirname, "session.json");
        this.retryCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 5000;
        this.checkInterval = 15 * 60 * 1000;
        this.connectionCheckInterval = 5 * 60 * 1000;
        this.isRunning = false;
    }

    async loadConfig() {
        try {
            const configData = await fs.readFile(this.CONFIG_FILE, "utf8");
            const config = JSON.parse(configData);
            if (!config.username || !config.password) {
                throw new Error("Username or password not found in config");
            }
            return config;
        } catch (error) {
            if (error.code === 'ENOENT') {
                await this.createConfigTemplate();
                throw new Error("config.json file has been created. Please fill in your username and password.");
            }
            throw error;
        }
    }

    async createConfigTemplate() {
        const template = {
            username: "your_username_here",
            password: "your_password_here",
            settings: {
                enableNotifications: true,
                autoRetry: true,
                checkConnection: true,
                logToFile: true
            }
        };
        await fs.writeFile(this.CONFIG_FILE, JSON.stringify(template, null, 2));
        console.log("📁 config.json file has been created");
    }

    async saveSession(sessionData) {
        try {
            await fs.writeFile(this.SESSION_FILE, JSON.stringify({
                ...sessionData,
                lastLogin: new Date().toISOString()
            }, null, 2));
        } catch (error) {
            console.error("❌ Failed to save session:", error.message);
        }
    }

    async loadSession() {
        try {
            const sessionData = await fs.readFile(this.SESSION_FILE, "utf8");
            return JSON.parse(sessionData);
        } catch (error) {
            return null;
        }
    }

    async checkInternetConnection() {
        try {
            const response = await axios.get("http://www.google.com", { timeout: 10000 });
            return response.status === 200;
        } catch {
            return false;
        }
    }

    async loginWithRetry(loginData) {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`🔐 Trying to login... (Attempt ${attempt}/${this.maxRetries})`);
                const response = await axios.post(this.LOGIN_URL, loginData, {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    },
                    timeout: 15000,
                    validateStatus: status => status >= 200 && status < 500
                });

                if (response.status === 200) {
                    const sessionData = {
                        username: loginData.username,
                        loginTime: new Date().toISOString(),
                        attempt: attempt
                    };
                    await this.saveSession(sessionData);
                    this.retryCount = 0;
                    return {
                        success: true,
                        message: "✅ Login successful!",
                        attempt,
                        timestamp: new Date().toLocaleString()
                    };
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                console.error(`❌ Login attempt ${attempt} failed:`, error.message);
                if (attempt < this.maxRetries) {
                    console.log(`⏳ Waiting ${this.retryDelay / 1000} seconds before retrying...`);
                    await this.delay(this.retryDelay);
                } else {
                    return {
                        success: false,
                        message: `❌ All login attempts failed: ${error.message}`,
                        attempt,
                        timestamp: new Date().toLocaleString()
                    };
                }
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    log(message, type = "info") {
        const timestamp = new Date().toLocaleString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        if (this.config?.settings?.logToFile) {
            this.logToFile(logMessage);
        }
    }

    async logToFile(message) {
        try {
            const logFile = path.join(__dirname, "login.log");
            await fs.appendFile(logFile, `${message}\n`);
        } catch (error) {
            console.error("Failed to write log:", error.message);
        }
    }

    async getLoginStatus() {
        const session = await this.loadSession();
        if (!session) {
            return "Never logged in";
        }
        const lastLogin = new Date(session.lastLogin);
        const now = new Date();
        const diffMinutes = Math.floor((now - lastLogin) / (1000 * 60));
        return `Last login: ${lastLogin.toLocaleString()} (${diffMinutes} minutes ago)`;
    }

    async start() {
        if (this.isRunning) {
            this.log("Service already running", "warning");
            return;
        }
        this.isRunning = true;
        this.log("🚀 Starting Advanced Auto Login Service...");
        try {
            this.config = await this.loadConfig();
            this.log("✅ Config loaded successfully");
            const status = await this.getLoginStatus();
            this.log(`📊 ${status}`);
            await this.executeLogin();

            this.loginInterval = setInterval(() => {
                this.executeLogin();
            }, this.checkInterval);

            if (this.config.settings?.checkConnection) {
                this.connectionInterval = setInterval(async () => {
                    const isConnected = await this.checkInternetConnection();
                    if (!isConnected) {
                        this.log("🌐 Internet connection lost, retrying login...", "warning");
                        await this.executeLogin();
                    }
                }, this.connectionCheckInterval);
            }
            this.log(`✅ Service running. Auto login every ${this.checkInterval / 60000} minutes`);
        } catch (error) {
            this.log(`❌ Failed to start service: ${error.message}`, "error");
            this.isRunning = false;
        }
    }

    async executeLogin() {
        this.log("--- Starting login process ---");
        if (this.config.settings?.checkConnection) {
            const isConnected = await this.checkInternetConnection();
            if (!isConnected) {
                this.log("❌ No internet connection", "error");
                return;
            }
        }
        const loginData = {
            username: this.config.username,
            password: this.config.password
        };
        const result = await this.loginWithRetry(loginData);
        this.log(result.message);
        if (this.config.settings?.enableNotifications) {
            this.sendNotification(result);
        }
    }

    sendNotification(result) {
        if (result.success) {
            this.log("📢 Notification: Login successful!");
        } else {
            this.log("🚨 Notification: Login failed! Please check manually.");
        }
    }

    stop() {
        if (this.loginInterval) {
            clearInterval(this.loginInterval);
        }
        if (this.connectionInterval) {
            clearInterval(this.connectionInterval);
        }
        this.isRunning = false;
        this.log("🛑 Service stopped");
    }

    async restart() {
        this.log("🔄 Restarting service...");
        this.stop();
        await this.delay(2000);
        await this.start();
    }
}

function setupGracefulShutdown(loginService) {
    const shutdownSignals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    shutdownSignals.forEach(signal => {
        process.on(signal, () => {
            console.log(`\nReceived ${signal}, shutting down gracefully...`);
            loginService.stop();
            process.exit(0);
        });
    });

    process.on('uncaughtException', error => {
        console.error('Uncaught Exception:', error);
        loginService.stop();
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        loginService.stop();
        process.exit(1);
    });
}

async function showMenu(loginService) {
    console.log("\n" + "=".repeat(50));
    console.log("🤖 ADVANCED AUTO LOGIN SYSTEM");
    console.log("=".repeat(50));
    console.log("1. Start Service");
    console.log("2. Stop Service");
    console.log("3. Restart Service");
    console.log("4. Login Status");
    console.log("5. Login Now");
    console.log("6. Exit");
    console.log("=".repeat(50));

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question("Choose option (1-6): ", async (choice) => {
        switch (choice) {
            case '1':
                await loginService.start();
                break;
            case '2':
                loginService.stop();
                break;
            case '3':
                await loginService.restart();
                break;
            case '4':
                const status = await loginService.getLoginStatus();
                console.log(`📊 ${status}`);
                break;
            case '5':
                await loginService.executeLogin();
                break;
            case '6':
                loginService.stop();
                process.exit(0);
                return;
            default:
                console.log("❌ Invalid option");
        }
        readline.close();
        setTimeout(() => showMenu(loginService), 1000);
    });
}

async function main() {
    const loginService = new AdvancedAutoLogin();
    setupGracefulShutdown(loginService);

    if (process.argv.length > 2) {
        const command = process.argv[2];
        switch (command) {
            case 'start':
                await loginService.start();
                break;
            case 'stop':
                loginService.stop();
                break;
            case 'restart':
                await loginService.restart();
                break;
            case 'status':
                const status = await loginService.getLoginStatus();
                console.log(status);
                break;
            case 'login':
                await loginService.executeLogin();
                break;
            default:
                console.log("Usage: node script.js [start|stop|restart|status|login]");
                process.exit(1);
        }
    } else {
        await showMenu(loginService);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = AdvancedAutoLogin;
