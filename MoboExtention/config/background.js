let currentProxy = null;
let connectionState = "disconnected";
let retryCount = 0;
let reconnectTimer = null;
let ipFetchInterval = null;
let nativeMessagingPort = null;

let settings = {
    autoConnectLastUsed: false,
    showNotifications: true,
    clearCookiesOnDisconnect: true,
    connectionTimeout: 30,
    maxRetries: 5
};

function loadSettings(callback) {
    chrome.storage.local.get({
        autoConnectLastUsed: false,
        showNotifications: true,
        clearCookiesOnDisconnect: true,
        connectionTimeout: 30,
        maxRetries: 5
    }, (storedSettings) => {
        settings = storedSettings;
        if (callback) callback();
    });
}

chrome.storage.onChanged.addListener((changes) => {
    for (let key in changes) {
        if (settings.hasOwnProperty(key)) {
            settings[key] = changes[key].newValue;
        }
    }
});

function updateConnectionState(state) {
    connectionState = state;
    chrome.storage.local.set({ connectedStatus: state });
    chrome.runtime.sendMessage({ type: "status-update", state });
}

function sendToast(message) {
    if (settings.showNotifications) {
        chrome.runtime.sendMessage({ type: "toast", message });
    }
}

function getUUID(proxy) {
    if (!proxy) return null;
    if (proxy.uuid) return proxy.uuid;
    const fallbackId = `${proxy.host}-${proxy.port}-${proxy.username || 'noauth'}`;
    return fallbackId;
}

function applyProxy(proxy) {
    console.log("[Proxy] Applying configuration for:", proxy.name || proxy.host);

    if (!proxy.scheme || !proxy.host || !proxy.port) {
        console.error("[Proxy] Invalid proxy configuration:", proxy);
        sendToast("Invalid proxy configuration");
        return false;
    }

    const config = {
        mode: "fixed_servers",
        rules: {
            singleProxy: {
                scheme: proxy.scheme,
                host: proxy.host,
                port: parseInt(proxy.port)
            },
            bypassList: ["<local>"]
        }
    };

    if (proxy.scheme === 'socks5' && (proxy.username || proxy.password)) {
        sendToast("Warning: SOCKS5 with authentication may not work correctly due to Chrome limitations.");
    }

    chrome.proxy.settings.set({ value: config, scope: "regular" }, () => {
        if (chrome.runtime.lastError) {
            console.error("[Proxy] Failed to set proxy:", chrome.runtime.lastError);
            sendToast("Failed to configure proxy: " + chrome.runtime.lastError.message);
        } else {
            console.log("[Proxy] Configuration applied successfully");
        }
    });

    return true;
}

function clearProxyConfig(callback) {
    chrome.proxy.settings.clear({ scope: "regular" }, () => {
        if (settings.clearCookiesOnDisconnect) {
            chrome.browsingData.remove({
                "since": 0
            }, { cookies: true }, () => {
                if (callback) callback();
            });
        } else {
            if (callback) callback();
        }
    });
}

function testProxyConnection(callback) {
    console.log("[Connection Test] Starting test...");

    chrome.proxy.settings.get({ incognito: false }, (config) => {
        if (chrome.runtime.lastError) {
            console.error("[Connection Test] Failed to get proxy settings:", chrome.runtime.lastError);
            callback(false);
            return;
        }

        if (!config || !config.value || config.value.mode !== 'fixed_servers') {
            console.log("[Connection Test] Proxy not properly configured");
            callback(false);
            return;
        }

        console.log("[Connection Test] Proxy settings confirmed, testing connection...");

        const testUrl = "https://www.google.com/generate_204";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            console.log("[Connection Test] Timeout after", settings.connectionTimeout, "seconds");
        }, settings.connectionTimeout * 1000);

        fetch(testUrl, {
            signal: controller.signal,
            method: 'HEAD',
            mode: 'no-cors'
        })
            .then(() => {
                clearTimeout(timeoutId);
                console.log("[Connection Test] Connection successful!");
                callback(true);
            })
            .catch((err) => {
                clearTimeout(timeoutId);
                if (err.name === 'AbortError') {
                    console.log("[Connection Test] Connection timeout");
                } else {
                    console.log("[Connection Test] Connection failed:", err.message);
                }
                callback(false);
            });
    });
}

chrome.webRequest.onAuthRequired.addListener(
    (details, callback) => {
        console.log("[Auth] Authentication required for:", details.url);
        if (currentProxy?.username && currentProxy?.password) {
            console.log("[Auth] Providing credentials for user:", currentProxy.username);
            callback({
                authCredentials: {
                    username: currentProxy.username,
                    password: currentProxy.password
                }
            });
        } else {
            console.log("[Auth] No credentials available");
            sendToast("Proxy requires authentication but no credentials provided");
            callback({});
        }
    },
    { urls: ["<all_urls>"] },
    ["asyncBlocking"]
);

async function fetchPublicIp() {
    console.log("[IP Detector] Attempting to fetch public IP from ipwho.is...");

    try {
        const response = await fetch('https://ipwho.is/');
        if (!response.ok) {
            throw new Error(`Failed to fetch from ipwho.is`);
        }
        const data = await response.json();

        if (!data.success) {
            throw new Error(`IPWHOIS API error: ${data.message}`);
        }

        const publicIp = data.ip || 'Unknown';
        const locationCountry = data.country || 'Unknown';

        console.log("[IP Detector] Public IP detected:", publicIp);
        console.log("[IP Detector] Location detected:", locationCountry);

        await chrome.storage.local.set({ publicIp: publicIp, location: locationCountry });

        if (ipFetchInterval) {
            clearInterval(ipFetchInterval);
            ipFetchInterval = null;
        }
    } catch (err) {
        console.error(`[IP Detector] Error fetching from ipwho.is:`, err);
        await chrome.storage.local.set({ publicIp: 'Fetching failed...', location: 'Fetching failed...' });
    }
}

function trackDataUsage(uuid) {
    chrome.webRequest.onCompleted.addListener(
        (details) => {
            const sizeHeader = details.responseHeaders?.find(h => h.name.toLowerCase() === "content-length");
            const bytes = sizeHeader ? parseInt(sizeHeader.value) || 0 : 0;

            chrome.storage.local.get("dataUsage", (res) => {
                const usage = res.dataUsage || {};
                const current = usage[uuid] || { down: 0 };
                current.down += bytes;
                usage[uuid] = current;
                chrome.storage.local.set({ dataUsage: usage });
            });
        },
        { urls: ["<all_urls>"] },
        ["responseHeaders"]
    );
}

function attemptConnection(proxy, callback) {
    if (!proxy.uuid) {
        proxy.uuid = crypto.randomUUID();
    }

    console.log("[Connection] Attempting to connect to proxy:", proxy.name || proxy.host);

    currentProxy = proxy;
    const uuid = getUUID(proxy);
    const now = Date.now();

    clearTimeout(reconnectTimer);
    clearProxyConfig(() => {
        updateConnectionState('connecting');
        sendToast(`Connecting to ${proxy.name || proxy.host}...`);
        applyProxy(proxy);
        trackDataUsage(uuid);

        if (ipFetchInterval) {
            clearInterval(ipFetchInterval);
        }

        setTimeout(() => {
            console.log("[Connection] Starting connection test...");
            testProxyConnection(success => {
                if (success) {
                    retryCount = 0;
                    saveLastUsed(proxy);

                    chrome.storage.local.set({
                        connectedProxy: proxy,
                        connectedStatus: 'connected',
                        publicIp: 'Fetching...',
                        location: 'Fetching...',
                        [`startTime-${uuid}`]: now,
                        connectingProxy: null
                    }, () => {
                        updateConnectionState('connected');
                        chrome.runtime.sendMessage({
                            type: 'toast',
                            message: 'Proxy connected successfully!'
                        });

                        fetchPublicIp();
                        ipFetchInterval = setInterval(fetchPublicIp, 5000);

                        callback?.({ success: true });
                    });
                } else {
                    retryCount++;
                    console.log(`[Connection] Failed attempt ${retryCount}/${settings.maxRetries}`);

                    if (retryCount <= settings.maxRetries) {
                        updateConnectionState('reconnecting');
                        sendToast(`Connection failed. Retrying (${retryCount}/${settings.maxRetries})...`);
                        reconnectTimer = setTimeout(() => attemptConnection(proxy, callback), 5000);
                    } else {
                        updateConnectionState('disconnected');
                        chrome.storage.local.remove(['connectedProxy', 'connectingProxy']);
                        clearProxyConfig(() => {
                            currentProxy = null;
                            sendToast('Could not connect to proxy after multiple attempts ❌');
                            console.log("[Connection] Failed after", settings.maxRetries, "attempts");
                            callback?.({ success: false });
                        });
                    }
                }
            });
        }, 2000);
    });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "set-proxy") {
        retryCount = 0;
        attemptConnection(msg.proxy, sendResponse);
        return true;
    }

    if (msg.type === "clear-proxy") {
        clearTimeout(reconnectTimer);
        clearInterval(ipFetchInterval);
        ipFetchInterval = null;
        chrome.storage.local.remove(["connectedProxy", "publicIp", "location"]);

        if (currentProxy) {
            const uuid = getUUID(currentProxy);
            chrome.storage.local.get(`startTime-${uuid}`, data => {
                const startTime = data[`startTime-${uuid}`];
                if (startTime) {
                    saveConnectedMetadata(currentProxy, startTime, () => {
                        chrome.storage.local.remove(`startTime-${uuid}`, () => {
                            finalizeDisconnect(sendResponse);
                        });
                    });
                } else {
                    finalizeDisconnect(sendResponse);
                }
            });
        } else {
            finalizeDisconnect(sendResponse);
        }

        return true;
    }

    if (msg.type === "refresh-ip") {
        console.log("[IP Detector] Refresh requested by user.");
        fetchPublicIp();
    }

    if (msg.type === "start-local-service") {
        console.log("[Native Messaging] Received request to start local service.");
        startLocalService(msg.config);
    }

    return false;
});

function finalizeDisconnect(sendResponse) {
    currentProxy = null;
    clearProxyConfig(() => {
        chrome.storage.local.set({ connectedStatus: "disconnected", connectingProxy: null }, () => {
            chrome.runtime.sendMessage({ type: "status-update", state: "disconnected" });
            sendToast("Disconnected");
            sendResponse({ success: true });
        });
    });
}

function saveConnectedMetadata(proxy, startTime, callback) {
    const uuid = getUUID(proxy);
    if (!uuid) return;

    const duration = Date.now() - startTime;

    chrome.storage.local.get(["totalConnected", "lastUsed"], (res) => {
        const totalConnected = res.totalConnected || {};
        const lastUsed = res.lastUsed || {};

        totalConnected[uuid] = (totalConnected[uuid] || 0) + duration;
        lastUsed[uuid] = {
            lastUsed: Date.now(),
            totalConnectedTime: totalConnected[uuid]
        };

        chrome.storage.local.set({ totalConnected, lastUsed }, () => {
            callback?.();
        });
    });
}

function saveLastUsed(proxy) {
    const uuid = getUUID(proxy);
    chrome.storage.local.get(["lastUsed", "totalConnected"], data => {
        const lastUsed = data.lastUsed || {};
        lastUsed[uuid] = {
            lastUsed: Date.now(),
            totalConnectedTime: (data.totalConnected?.[uuid]) || 0
        };
        chrome.storage.local.set({ lastUsed });
    });
}

function migrateProxies(callback) {
    chrome.storage.local.get(["proxies"], data => {
        if (data.proxies && data.proxies.length > 0) {
            let needsMigration = false;
            const migratedProxies = data.proxies.map(proxy => {
                if (!proxy.uuid) {
                    needsMigration = true;
                    return {
                        ...proxy,
                        uuid: crypto.randomUUID()
                    };
                }
                return proxy;
            });

            if (needsMigration) {
                chrome.storage.local.set({ proxies: migratedProxies }, () => {
                    callback && callback();
                });
            } else {
                callback && callback();
            }
        } else {
            const defaultProxy = {
                "uuid": "cbf4b43a-1a71-40bd-a9de-ef13836d82b0",
                "name": "LocalProxy",
                "scheme": "socks5",
                "host": "127.0.0.1",
                "port": "10828",
                "username": "",
                "password": ""
            };
            chrome.storage.local.set({ proxies: [defaultProxy] }, () => {
                callback && callback();
            });
        }
    });
}

function startLocalService(config) {
    if (nativeMessagingPort) {
        console.log("[Native Messaging] Port already connected. Disconnecting and reconnecting.");
        nativeMessagingPort.disconnect();
        nativeMessagingPort = null;
    }

    try {
        nativeMessagingPort = chrome.runtime.connectNative('com.your_company.v2ray_host');
        nativeMessagingPort.onMessage.addListener(onNativeMessage);
        nativeMessagingPort.onDisconnect.addListener(onNativeDisconnect);

        nativeMessagingPort.postMessage({
            command: "start-service",
            config: JSON.stringify(config)
        });

        sendToast("Attempting to start local proxy service...");
    } catch (e) {
        console.error("[Native Messaging] Failed to connect to native application:", e);
        sendToast("Error: Could not connect to local proxy service. Please ensure the native application is installed.");
    }
}

function onNativeMessage(message) {
    console.log("[Native Messaging] Received message from native app:", message);
    if (message.status === "success") {
        sendToast("Local proxy service started successfully.");
    } else {
        sendToast(`Local proxy service failed to start: ${message.error}`);
    }
}

function onNativeDisconnect() {
    console.log("[Native Messaging] Disconnected from native application.");
    if (chrome.runtime.lastError) {
        console.error("[Native Messaging] Disconnection error:", chrome.runtime.lastError.message);
    }
    nativeMessagingPort = null;
}

function reinitializeState() {
    loadSettings(() => {
        migrateProxies(() => {
            if (settings.autoConnectLastUsed) {
                chrome.storage.local.get(["lastUsed"], data => {
                    if (data.lastUsed) {
                        chrome.storage.local.get(["proxies"], proxyData => {
                            const proxy = proxyData.proxies?.find(p => p.uuid === data.lastUsed);
                            if (proxy) {
                                attemptConnection(proxy);
                            }
                        });
                    }
                });
            }
        });
    });
}

chrome.runtime.onStartup.addListener(reinitializeState);
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      chrome.storage.local.set({ theme: 'dark' });
      migrateProxies(() => {
        chrome.tabs.create({ url: chrome.runtime.getURL('config/options.html') });
      });
    } else if (details.reason === 'update') {
        const previousVersion = details.previousVersion;
        const currentVersion = chrome.runtime.getManifest().version;
        if (previousVersion && previousVersion !== currentVersion && currentVersion === '2.0') {
            chrome.storage.local.set({ showWhatsNew: true });
            chrome.tabs.create({ url: chrome.runtime.getURL('config/options.html') });
        }
    }
});

loadSettings(() => {
    migrateProxies(() => {
        chrome.storage.local.get(["connectedStatus", "connectingProxy"], (data) => {
            if ((data.connectedStatus === "connecting" || data.connectedStatus === "reconnecting") && !currentProxy) {
                console.log("[Startup] Cleaning up stale connection state");
                chrome.storage.local.set({ connectedStatus: "disconnected", connectingProxy: null });
            }
        });
    });
});