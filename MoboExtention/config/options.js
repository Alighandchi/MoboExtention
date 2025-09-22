document.addEventListener("DOMContentLoaded", () => {
    const proxyContainer = document.getElementById("proxyContainer");
    const addProxyRowBtn = document.getElementById("addProxyRow");
    const saveChangesBtn = document.getElementById("saveChanges");
    const savedStatus = document.getElementById("savedStatus");
    const toast = document.getElementById("toast");
    const proxyInput = document.getElementById("proxyInput");
    const themeToggle = document.getElementById("themeToggle");
    const themeText = document.querySelector(".theme-text");
  
    const serverAddressInput = document.getElementById("serverAddressInput");
    const tokenIdInput = document.getElementById("tokenIdInput");
    const saveLocalProxyBtn = document.getElementById("saveLocalProxyBtn");
  
    function initTheme() {
      chrome.storage.local.get("theme", (data) => {
        const isDark = data.theme === "dark";
        document.body.classList.toggle("dark", isDark);
        if (themeText) {
          themeText.textContent = isDark ? "Dark Mode" : "Light Mode";
        }
      });
    }
  
    themeToggle?.addEventListener("click", () => {
      const isDark = document.body.classList.toggle("dark");
      chrome.storage.local.set({ theme: isDark ? "dark" : "light" });
      if (themeText) {
        themeText.textContent = isDark ? "Dark Mode" : "Light Mode";
      }
    });
  
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.theme) {
        const isDark = changes.theme.newValue === "dark";
        document.body.classList.toggle("dark", isDark);
        if (themeText) {
          themeText.textContent = isDark ? "Dark Mode" : "Light Mode";
        }
      }
    });
  
    initTheme();
  
    const generateUUID = () => crypto.randomUUID();
  
    function generateRandomName(proxy = {}) {
      const host = proxy.host || "proxy";
      const randomNum = Math.floor(Math.random() * 10000);
      return `${host}-${randomNum}`;
    }
  
    function showToast(message = "Changes saved.") {
      toast.textContent = message;
      toast.classList.remove("hidden");
      toast.classList.add("opacity-100");
      setTimeout(() => {
        toast.classList.add("hidden");
        toast.classList.remove("opacity-100");
      }, 3000);
    }
  
    function markUnsaved() {
      saveChangesBtn.classList.remove("hidden");
      saveChangesBtn.disabled = false;
      savedStatus.classList.add("hidden");
    }
  
    function markSaved() {
      saveChangesBtn.classList.add("hidden");
      saveChangesBtn.disabled = true;
      savedStatus.classList.remove("hidden");
    }
  
    function createRow(proxy = {}) {
      const uuid = proxy.uuid || generateUUID();
      const name = proxy.name || generateRandomName(proxy);
  
      const wrapper = document.createElement("div");
      wrapper.className = "border rounded-lg p-4 space-y-3 sortable-item transition-all";
      wrapper.style.cssText = "background-color: var(--bg-tertiary); border-color: var(--border-primary);";
  
      wrapper.innerHTML = `
        <input type="hidden" class="uuid" value="${uuid}" />
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <div class="md:col-span-1">
            <label class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">Proxy Name</label>
            <input placeholder="My Proxy" class="px-3 py-2 rounded-lg w-full text-sm name border focus:outline-none transition-all" style="background-color: var(--bg-secondary); color: var(--text-primary); border-color: var(--border-primary);" value="${name}"/>
          </div>
          <div class="md:col-span-1">
            <label class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">Protocol</label>
            <select class="px-3 py-2 rounded-lg text-sm scheme border focus:outline-none transition-all w-full" style="background-color: var(--bg-secondary); color: var(--text-primary); border-color: var(--border-primary);">
              <option value="http" ${proxy.scheme === "http" ? "selected" : ""}>HTTP</option>
              <option value="socks5" ${proxy.scheme === "socks5" ? "selected" : ""}>SOCKS5</option>
            </select>
          </div>
          <div class="md:col-span-1">
            <label class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">Host/IP Address</label>
            <input placeholder="proxy.example.com" class="px-3 py-2 rounded-lg text-sm host w-full border focus:outline-none transition-all" style="background-color: var(--bg-secondary); color: var(--text-primary); border-color: var(--border-primary);" value="${proxy.host || ''}"/>
          </div>
          <div class="md:col-span-1">
            <label class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">Port</label>
            <input placeholder="8080" type="number" class="px-3 py-2 rounded-lg text-sm port w-full border focus:outline-none transition-all" style="background-color: var(--bg-secondary); color: var(--text-primary); border-color: var(--border-primary);" value="${proxy.port || ''}"/>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div class="md:col-span-1">
            <label class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">Username (Optional)</label>
            <input placeholder="username" class="px-3 py-2 rounded-lg w-full text-sm username border focus:outline-none transition-all" style="background-color: var(--bg-secondary); color: var(--text-primary); border-color: var(--border-primary);" value="${proxy.username || ''}"/>
          </div>
          <div class="relative md:col-span-1">
            <label class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">Password (Optional)</label>
            <input placeholder="password" type="password" class="password px-3 py-2 rounded-lg text-sm w-full border focus:outline-none transition-all pr-10" style="background-color: var(--bg-secondary); color: var(--text-primary); border-color: var(--border-primary);" value="${proxy.password || ''}">
            <button type="button" class="absolute right-2 bottom-2 text-sm toggle-pass transition-colors" style="color: var(--text-secondary);">👁️</button>
          </div>
          <div class="md:col-span-1 flex justify-end">
            <button class="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg p-2 text-lg delete-btn transition-all">🗑️ Remove</button>
          </div>
        </div>
      `;
  
      wrapper.addEventListener("mouseenter", () => {
        wrapper.style.borderColor = "var(--gradient-from)";
      });
  
      wrapper.addEventListener("mouseleave", () => {
        wrapper.style.borderColor = "var(--border-primary)";
      });
  
      wrapper.querySelector(".toggle-pass")?.addEventListener("click", () => {
        const input = wrapper.querySelector(".password");
        input.type = input.type === "password" ? "text" : "password";
      });
  
      wrapper.querySelector(".delete-btn").onclick = () => {
        showToast("Proxy will be removed after saving.");
        wrapper.remove();
        markUnsaved();
        saveProxies();
      };
  
      wrapper.querySelectorAll("input, select").forEach((el) => {
        el.addEventListener("input", markUnsaved);
      });
  
      proxyContainer.appendChild(wrapper);
    }
  
    function getAllProxies() {
      const rows = proxyContainer.querySelectorAll(".sortable-item");
      const proxies = [];
  
      rows.forEach((row) => {
        const uuid = row.querySelector(".uuid").value.trim();
        const name = row.querySelector(".name").value.trim();
        const scheme = row.querySelector(".scheme").value.trim();
        const host = row.querySelector(".host").value.trim();
        const port = row.querySelector(".port").value.trim();
        const username = row.querySelector(".username").value.trim();
        const password = row.querySelector(".password").value.trim();
  
        if (host && port) {
          proxies.push({ uuid, name, scheme, host, port, username, password });
        }
      });
  
      return proxies;
    }
  
    function saveProxies() {
      const proxies = getAllProxies();
      chrome.storage.local.set({ proxies }, () => {
        chrome.runtime.sendMessage({ type: "options-sync" });
        markSaved();
        showToast("Proxies saved.");
      });
    }
  
    addProxyRowBtn.onclick = () => {
      createRow();
      markUnsaved();
    };
  
    saveChangesBtn.onclick = saveProxies;
  
    chrome.storage.local.get("proxies", (data) => {
      (data.proxies || []).forEach(createRow);
    });
  
    Sortable.create(proxyContainer, {
      animation: 150,
      ghostClass: "sortable-ghost",
      onEnd: () => {
        markUnsaved();
      }
    });
  
    proxyInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const value = proxyInput.value.trim();
        const parsed = parseProxyString(value);
        if (parsed) {
          parsed.uuid = generateUUID();
          parsed.name = generateRandomName(parsed);
          createRow(parsed);
          markUnsaved();
          proxyInput.value = "";
        } else {
          showToast("Invalid proxy format");
        }
      }
    });
  
    function parseProxyString(str) {
      try {
        let url = new URL(str);
        const parsed = {
          scheme: url.protocol.replace(":", ""),
          host: url.hostname,
          port: url.port,
          username: url.username || "",
          password: url.password || ""
        };
        console.log("[DEBUG] Parsing proxy URL:", str);
        console.log("[DEBUG] Parsed result:", parsed);
        console.log("[DEBUG] Full username preserved:", parsed.username);
        return parsed;
      } catch (e) {
        console.error("[DEBUG] Failed to parse proxy URL:", e);
        return null;
      }
    }
  
    document.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabId = btn.getAttribute("data-tab");
        document.querySelectorAll("section[id^='tab']").forEach((sec) =>
          sec.classList.add("hidden")
        );
        document.getElementById(`tab-${tabId}`).classList.remove("hidden");
        document.querySelectorAll("[data-tab]").forEach((el) =>
          el.classList.remove("active-tab")
        );
        btn.classList.add("active-tab");
      });
    });
  
    const importFile = document.getElementById("importFile");
    const exportBtn = document.getElementById("exportBtn");
  
    importFile?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
  
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (Array.isArray(data.proxies)) {
            proxyContainer.innerHTML = "";
            data.proxies.forEach(createRow);
            markUnsaved();
            showToast("Proxies imported successfully");
          } else {
            showToast("Invalid file format");
          }
        } catch (err) {
          showToast("Failed to import file");
        }
      };
      reader.readAsText(file);
    });
  
    exportBtn?.addEventListener("click", () => {
      const proxies = getAllProxies();
      const data = { proxies, exportDate: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proxyomega-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Proxies exported successfully");
    });
  
    const autoConnectCheckbox = document.getElementById("autoConnectLastUsed");
    const showNotificationsCheckbox = document.getElementById("showNotifications");
    const clearCookiesCheckbox = document.getElementById("clearCookiesOnDisconnect");
    const connectionTimeoutInput = document.getElementById("connectionTimeout");
    const maxRetriesInput = document.getElementById("maxRetries");
    const saveSettingsBtn = document.getElementById("saveSettings");
  
    function loadSettings() {
      chrome.storage.local.get({
        autoConnectLastUsed: false,
        showNotifications: true,
        clearCookiesOnDisconnect: true,
        connectionTimeout: 30,
        maxRetries: 5
      }, (settings) => {
        if (autoConnectCheckbox) autoConnectCheckbox.checked = settings.autoConnectLastUsed;
        if (showNotificationsCheckbox) showNotificationsCheckbox.checked = settings.showNotifications;
        if (clearCookiesCheckbox) clearCookiesCheckbox.checked = settings.clearCookiesOnDisconnect;
        if (connectionTimeoutInput) connectionTimeoutInput.value = settings.connectionTimeout;
        if (maxRetriesInput) maxRetriesInput.value = settings.maxRetries;
      });
    }
  
    saveSettingsBtn?.addEventListener("click", () => {
      const settings = {
        autoConnectLastUsed: autoConnectCheckbox?.checked || false,
        showNotifications: showNotificationsCheckbox?.checked || true,
        clearCookiesOnDisconnect: clearCookiesCheckbox?.checked || true,
        connectionTimeout: parseInt(connectionTimeoutInput?.value || 30),
        maxRetries: parseInt(maxRetriesInput?.value || 5)
      };
  
      chrome.storage.local.set(settings, () => {
        showToast("Settings saved successfully");
      });
    });
  
    loadSettings();
  
    chrome.storage.local.get(['serverAddress', 'tokenId'], (data) => {
      if (serverAddressInput) serverAddressInput.value = data.serverAddress || '';
      if (tokenIdInput) tokenIdInput.value = data.tokenId || '';
    });
  
    saveLocalProxyBtn?.addEventListener('click', () => {
      const serverAddress = serverAddressInput?.value;
      const tokenId = tokenIdInput?.value;
  
      if (!serverAddress || !tokenId) {
        showToast("Server address and token are required.");
        return;
      }
  
      const config = {
        inbounds: [
          {
            tag: "socks",
            port: 10828,
            listen: "127.0.0.1",
            protocol: "socks",
            sniffing: {
              enabled: true,
              destOverride: [
                "http",
                "tls",
                "quic",
                "fakedns",
                "fakedns+others"
              ],
              routeOnly: true
            },
            settings: {
              auth: "noauth",
              udp: true,
              allowTransparent: false
            }
          }
        ],
        outbounds: [
          {
            tag: "proxy",
            protocol: "vless",
            settings: {
              vnext: [
                {
                  address: serverAddress,
                  port: 1001,
                  users: [
                    {
                      id: tokenId,
                      email: "t@t.tt",
                      security: "auto",
                      encryption: "none"
                    }
                  ]
                }
              ]
            },
            streamSettings: {
              network: "ws",
              security: "tls",
              tlsSettings: {
                allowInsecure: true,
                fingerprint: "chrome"
              },
              wsSettings: {
                path: "/SE",
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0"
                }
              }
            },
            mux: {
              enabled: true,
              concurrency: 8
            }
          }
        ]
      };
  
      chrome.storage.local.set({ serverAddress, tokenId }, () => {
        showToast("Local proxy settings saved. Starting service...");
        chrome.runtime.sendMessage({
          type: "start-local-service",
          config: config
        });
      });
    });
  
    const hash = window.location.hash;
    if (hash === '#about' || hash === '#welcome') {
      document.querySelectorAll("section[id^='tab']").forEach((sec) =>
        sec.classList.add("hidden")
      );
      document.getElementById('tab-about').classList.remove("hidden");
      document.querySelectorAll("[data-tab]").forEach((el) =>
        el.classList.remove("active-tab")
      );
      document.querySelector('[data-tab="about"]')?.classList.add("active-tab");
  
      if (hash === '#about') {
        setTimeout(() => {
          document.querySelector('[style*="What\'s New"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500);
      }
    }
  });