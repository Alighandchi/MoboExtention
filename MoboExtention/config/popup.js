document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const elements = {
        statusText: document.getElementById('statusText'),
        connectionTimer: document.getElementById('connectionTimer'),
        connectionButton: document.getElementById('connectionButton'),
        circleInner: document.getElementById('circleInner'),
        currentProxy: document.getElementById('currentProxy'),
        proxySelector: document.getElementById('proxySelector'),
        proxyName: document.getElementById('proxyName'),
        proxyAddress: document.getElementById('proxyAddress'),
        proxyFlag: document.getElementById('proxyFlag'),
        speedStats: document.getElementById('speedStats'),
        proxySelectionScreen: document.getElementById('proxySelectionScreen'),
        backBtn: document.getElementById('backBtn'),
        proxyList: document.getElementById('proxyList'),
        themeToggle: document.getElementById('themeToggle'),
        manageHeaderBtn: document.getElementById('manageHeaderBtn'),
        closeBtn: document.getElementById('closeBtn'),
        
        // New elements for IP address and refresh button
        ipRefreshContainer: document.getElementById('ip-refresh-container'),
        ipRefreshBtn: document.getElementById('ipRefreshBtn'),
        ipAddressDisplay: document.getElementById('ipAddressDisplay'),
        locationDisplay: document.getElementById('locationDisplay')
    };

    // State
    let connectionTimer = 0;
    let timerInterval = null;
    let selectedProxy = null;
    let proxies = [];
    let currentConnectionState = 'disconnected';
    let retryCount = 0;
    
    // Initialize theme
    function initTheme() {
        chrome.storage.local.get("theme", (data) => {
            const isDark = data.theme === "dark";
            document.body.classList.toggle("dark", isDark);
        });
    }

    // Theme toggle handler
    elements.themeToggle?.addEventListener("click", () => {
        const isDark = document.body.classList.toggle("dark");
        chrome.storage.local.set({ theme: isDark ? "dark" : "light" });
    });

    initTheme();

    // Toast notifications
    function showToast(message) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    }

    // Format time for display
    function formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Format duration from milliseconds
    function formatDuration(ms) {
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor((totalSec % 3600) / 60);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return `${h}h ${m}m ${s}s`;
    }

    // Build proxy string
    function buildProxyString(proxy) {
        const auth = proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : "";
        return `${proxy.scheme}://${auth}${proxy.host}:${proxy.port}`;
    }

    // Get country flag emoji
    function getCountryFlag(proxyName) {
        const flagMap = {
            'united states': '🇺🇸', 'us': '🇺🇸',
            'germany': '🇩🇪', 'de': '🇩🇪',
            'singapore': '🇸🇬', 'sg': '🇸🇬',
            'japan': '🇯🇵', 'jp': '🇯🇵',
            'united kingdom': '🇬🇧', 'uk': '🇬🇧',
            'france': '🇫🇷', 'fr': '🇫🇷'
        };
        
        const normalized = proxyName.toLowerCase();
        for (const [key, flag] of Object.entries(flagMap)) {
            if (normalized.includes(key)) return flag;
        }
        return '🌐';
    }

    // Start connection timer
    function startTimer(startTime) {
        if (timerInterval) clearInterval(timerInterval);
        
        const updateTimer = () => {
            const now = Date.now();
            const elapsed = Math.floor((now - startTime) / 1000);
            elements.connectionTimer.textContent = formatTime(elapsed);
            
            if (selectedProxy && selectedProxy.uuid) {
                chrome.storage.local.get(["dataUsage"], (res) => {
                    const usage = res.dataUsage && res.dataUsage[selectedProxy.uuid];
                    if (usage) {
                        const downloadSpeed = calculateSpeed(usage.down, now - startTime);
                        const uploadSpeed = calculateSpeed(usage.up || 0, now - startTime);
                        updateSpeedStats(downloadSpeed, uploadSpeed);
                    }
                });
            }
        };
        
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
    }

    // Stop connection timer
    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        connectionTimer = 0;
        elements.connectionTimer.textContent = '00:00:00';
    }

    // Calculate speed
    function calculateSpeed(bytes, timeMs) {
        const seconds = timeMs / 1000;
        const bytesPerSecond = bytes / seconds;
        return bytesPerSecond / (1024 * 1024); // Return in Mbps
    }

    // Update speed stats display
    function updateSpeedStats(downloadMbps, uploadMbps) {
        const downloadCard = elements.speedStats.querySelector('.speed-card:first-child .speed-value');
        const uploadCard = elements.speedStats.querySelector('.speed-card:last-child .speed-value');
        
        if (downloadCard) {
            downloadCard.innerHTML = `${downloadMbps.toFixed(2)} <span class="speed-unit">Mbps</span>`;
        }
        if (uploadCard) {
            uploadCard.innerHTML = `${uploadMbps.toFixed(2)} <span class="speed-unit">Mbps</span>`;
        }
    }

    // Update UI based on connection state
    function updateUI(state, proxy, publicIp, location) {
        currentConnectionState = state;
        selectedProxy = proxy;

        document.body.classList.toggle('connected', state === 'connected');
        elements.connectionButton.classList.toggle('connected', state === 'connected');

        switch (state) {
            case 'connected':
                elements.statusText.textContent = '● Connected';
                elements.statusText.className = 'status-text connected';
                elements.circleInner.className = 'circle-inner connected';
                elements.currentProxy.classList.remove('hidden');
                elements.speedStats.classList.remove('hidden');
                elements.ipRefreshContainer.classList.remove('hidden');
                
                elements.ipAddressDisplay.textContent = `IP: ${publicIp || 'Fetching...'}`;
                elements.locationDisplay.textContent = `Location: ${location || 'Fetching...'}`;
                
                if (proxy) {
                    elements.proxyName.textContent = proxy.name || 'Proxy Server';
                    elements.proxyAddress.textContent = buildProxyString(proxy);
                    elements.proxyFlag.textContent = getCountryFlag(proxy.name || '');
                    
                    if (proxy.connectedAt) {
                        startTimer(proxy.connectedAt);
                    }
                }
                break;

            case 'connecting':
            case 'reconnecting':
                elements.statusText.textContent = state === 'connecting' ? '● Connecting' : '● Reconnecting';
                elements.statusText.className = `status-text ${state}`;
                elements.circleInner.className = `circle-inner ${state}`;
                elements.currentProxy.classList.add('hidden');
                elements.speedStats.classList.add('hidden');
                elements.ipRefreshContainer.classList.add('hidden');
                elements.ipAddressDisplay.textContent = 'IP: ';
                elements.locationDisplay.textContent = 'Location: ';
                stopTimer();
                break;

            default: // disconnected
                elements.statusText.textContent = '● Disconnected';
                elements.statusText.className = 'status-text';
                elements.circleInner.className = 'circle-inner';
                elements.currentProxy.classList.add('hidden');
                elements.speedStats.classList.add('hidden');
                elements.ipRefreshContainer.classList.add('hidden');
                elements.ipAddressDisplay.textContent = 'IP: ';
                elements.locationDisplay.textContent = 'Location: ';
                stopTimer();
                break;
        }
    }

    // Show proxy selection screen
    function showProxySelection() {
        document.body.classList.add('selecting-proxy');
        elements.proxySelectionScreen.classList.remove('hidden');
        setTimeout(() => {
            elements.proxySelectionScreen.classList.add('show');
        }, 10);
        renderProxyList();
    }

    // Hide proxy selection screen
    function hideProxySelection() {
        document.body.classList.remove('selecting-proxy');
        elements.proxySelectionScreen.classList.remove('show');
        setTimeout(() => {
            elements.proxySelectionScreen.classList.add('hidden');
        }, 300);
    }

    // Render proxy list in selection screen
    function renderProxyList() {
        const proxyListContainer = elements.proxyList;
        
        const existingItems = proxyListContainer.querySelectorAll('.proxy-item');
        existingItems.forEach(item => item.remove());
        
        let unlockedSection = proxyListContainer.querySelector('.section-header:first-of-type');
        let premiumSection = proxyListContainer.querySelector('.section-header:last-of-type');
        
        proxies.forEach((proxy, index) => {
            const proxyItem = document.createElement('div');
            proxyItem.className = 'proxy-item';
            proxyItem.dataset.index = index;
            
            const flag = getCountryFlag(proxy.name || '');
            const proxyString = buildProxyString(proxy);
            
            proxyItem.innerHTML = `
                <div class="proxy-item-content">
                    <div class="proxy-details">
                        <div class="proxy-country">${proxy.name || 'Unnamed Proxy'}</div>
                        <div class="proxy-locations">${proxyString}</div>
                    </div>
                </div>
                <button class="connect-btn" data-index="${index}">Connect</button>
            `;
            
            if (unlockedSection && unlockedSection.nextElementSibling) {
                proxyListContainer.insertBefore(proxyItem, unlockedSection.nextElementSibling);
            } else if (premiumSection) {
                proxyListContainer.insertBefore(proxyItem, premiumSection);
            } else {
                proxyListContainer.appendChild(proxyItem);
            }
        });
        
        proxyListContainer.querySelectorAll('.connect-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(btn.dataset.index);
                const proxy = proxies[index];
                if (proxy) {
                    connectToProxy(proxy);
                    hideProxySelection();
                }
            });
        });
    }

    // Connect to proxy
    function connectToProxy(proxy) {
        chrome.runtime.sendMessage({
            type: "set-proxy",
            proxy: proxy
        }, () => {
            showToast("Connecting to proxy...");
        });
    }

    // Disconnect from proxy
    function disconnect() {
        chrome.runtime.sendMessage({
            type: "clear-proxy"
        }, () => {
            showToast("Disconnected");
            loadPopup();
        });
    }

    // Load popup data and update UI
    function loadPopup() {
        chrome.storage.local.get(["proxies", "connectedProxy", "connectedStatus", "lastUsed", "connectingProxy", "publicIp", "location"], data => {
            
            proxies = data.proxies || [];
            const status = data.connectedStatus || "disconnected";
            const publicIp = data.publicIp;
            const location = data.location;

            let currentProxy = null;
            if (status === "connected") {
                currentProxy = data.connectedProxy;
            } else if (status === "connecting" || status === "reconnecting") {
                currentProxy = data.connectingProxy || data.connectedProxy;
            }

            const currentUUID = currentProxy && currentProxy.uuid;

            if (!currentProxy || !currentUUID) {
                if (status !== "disconnected") {
                    chrome.storage.local.set({ connectedStatus: "disconnected" });
                }
                updateUI("disconnected", null, null, null);
                return;
            }

            if (["connected", "connecting", "reconnecting"].includes(status)) {
                chrome.storage.local.get(`startTime-${currentUUID}`, (result) => {
                    const startTime = result[`startTime-${currentUUID}`];

                    if (!startTime && status === "connected") {
                        if (retryCount++ < 15) {
                            setTimeout(loadPopup, 300);
                        } else {
                            updateUI("disconnected", null, null, null);
                        }
                        return;
                    }

                    if (startTime) {
                        currentProxy.connectedAt = startTime;
                    }
                    updateUI(status, currentProxy, publicIp, location);
                });
                return;
            }

            updateUI("disconnected", null, null, null);
        });
    }

    // Event Listeners
    elements.connectionButton.addEventListener('click', () => {
        if (currentConnectionState === 'connected') {
            disconnect();
        } else if (currentConnectionState === 'disconnected') {
            if (proxies.length > 0) {
                showProxySelection();
            } else {
                showToast('No proxies configured. Click "Manage Proxies" to add one.');
            }
        }
    });
    
    // Refresh IP button listener
    elements.ipRefreshBtn?.addEventListener('click', () => {
        if (currentConnectionState === 'connected') {
            chrome.runtime.sendMessage({ type: 'refresh-ip' });
        }
    });


    elements.proxySelector?.addEventListener('click', () => {
        if (proxies.length > 0) {
            showProxySelection();
        }
    });

    elements.backBtn?.addEventListener('click', hideProxySelection);
    
    elements.manageHeaderBtn?.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
    
    elements.closeBtn?.addEventListener('click', () => {
        window.close();
    });

    // Listen for messages from background
    chrome.runtime.onMessage.addListener(msg => {
        if (msg.type === "status-update") loadPopup();
        if (msg.type === "toast") showToast(msg.message);
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.theme) {
            const isDark = changes.theme.newValue === "dark";
            document.body.classList.toggle("dark", isDark);
        }
        if (changes.proxies || changes.connectedProxy || changes.connectedStatus || changes.lastUsed || changes.connectingProxy || changes.publicIp || changes.location) {
            loadPopup();
        }
    });

    // Initial load
    loadPopup();
});