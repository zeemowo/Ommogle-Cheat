(function() {
    if (window.__wsIntercepted) return;
    window.__wsIntercepted = true;

    let autoClear = true;
    window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'AUTO_CLEAR_SETTING') {
            autoClear = e.data.value;
            if (autoClear) {
                try { localStorage.removeItem('ommogle.userId'); } catch (e) {}
            }
        }
    });

    let activeSendVerdict = null;

    window.addEventListener('message', function(event) {
        console.log('[WS Int] message event:', event.data.type);
        if (event.data.type === 'GEO_RESULT' && event.data.geo && event.data.geo.status === 'success') {
            const {ip, geo} = event.data;
            console.log(`[WS Int] ${ip} → ${geo.city}, ${geo.regionName} (${geo.country})`);
            function injectGeo() {
                const label = document.evaluate('//*[text()="ENEMY SCAN"]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                console.log('[WS Int] injectGeo: ENEMY SCAN label?', !!label, label);
                if (!label) return setTimeout(() => { console.log('[WS Int] injectGeo: retry...'); injectGeo(); }, 500);
                const card = label.closest('[style*="max-width: 380px"]') || label.closest('.absolute');
                console.log('[WS Int] injectGeo: card?', !!card, card);
                if (!card) return setTimeout(() => { console.log('[WS Int] injectGeo: retry card...'); injectGeo(); }, 500);
                const rightCol = card.querySelector('.flex-1.flex.flex-col');
                console.log('[WS Int] injectGeo: rightCol?', !!rightCol, rightCol);
                if (!rightCol) return setTimeout(() => { console.log('[WS Int] injectGeo: retry rightCol...'); injectGeo(); }, 500);
                const ipRow = document.createElement('div');
                ipRow.className = 'flex gap-1.5 items-center';
                ipRow.innerHTML = `<span class="text-[8px] font-black tracking-[0.15em] text-white/40 w-7">IP</span><span class="text-[10px] font-bold flex-1 truncate text-blue-400">${ip}</span>`;
                rightCol.appendChild(ipRow);
                const locRow = document.createElement('div');
                locRow.className = 'flex gap-1.5 items-center';
                locRow.innerHTML = `<span class="text-[8px] font-black tracking-[0.15em] text-white/40 w-7">LOC</span><span class="text-[10px] font-bold flex-1 truncate text-white/60">${geo.city}, ${geo.regionName}</span>`;
                rightCol.appendChild(locRow);
                const btn = document.createElement('button');
                btn.className = 'text-[9px] font-black tracking-widest text-white/50 hover:text-white px-1.5 py-0.5 border border-white/15 rounded mt-1';
                btn.textContent = 'INSTAWIN';
                btn.onclick = function() {
                    if (activeSendVerdict) activeSendVerdict();
                };
                rightCol.appendChild(btn);
                console.log('[WS Int] injectGeo: appended rows');
            }
            injectGeo();
        }
    });

    const OriginalWebSocket = window.WebSocket;

    const ProxiedWebSocket = function(...args) {
        const url = args[0] || '';
        const ws = new OriginalWebSocket(...args);

        if (typeof url !== 'string' || !url.includes('ommogle-signaling')) {
            return ws;
        }

        console.log('[WS Int] Intercepted connection to:', url);

        // ── Queue connection: auto-dodge ──
        if (url.includes('/queue')) {
            ws.addEventListener('message', function(event) {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'matched') {
                        console.log('[WS Int] Match assigned — role:', data.role);
                        if (data.role !== 'host') {
                            console.log('[WS Int] Not host, dodging');
                            setTimeout(() => location.reload(), 100);
                        } else {
                            console.log('[WS Int] We are host, proceeding');
                        }
                    }
                } catch (e) {}
            });
            return ws;
        }

        // ── Match connection: verdict-claim logic ──
        const role = new URL(url).searchParams.get('role') || 'guest';
        const winnerId = role === 'host' ? 1 : 2;
        console.log('[WS Int] Role:', role, '→ winnerId:', winnerId);

        activeSendVerdict = function() {
            const payload = JSON.stringify({type:"verdict-claim",winner:winnerId,score:97,roast:"You're a Nigger"});
            originalSend.call(ws, payload);
            originalSend.call(ws, payload);
        };

        let inactivityTimer = null;
        function resetInactivityTimer() {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                console.log('[WS Int] 5s inactivity — sending verdict-claim x2');
                if (activeSendVerdict) activeSendVerdict();
            }, 10000);
        }
        resetInactivityTimer();

        const seenWanIps = new Set();

        function isWanIp(ip) {
            const parts = ip.split('.').map(Number);
            if (parts.length !== 4 || parts.some(p => p < 0 || p > 255)) return false;
            if (parts[0] === 10) return false;
            if (parts[0] === 127) return false;
            if (parts[0] === 169 && parts[1] === 254) return false;
            if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
            if (parts[0] === 192 && parts[1] === 168) return false;
            if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return false;
            if (parts[0] === 0) return false;
            if (parts[0] >= 224) return false;
            return true;
        }

        ws.addEventListener('message', function(event) {
            resetInactivityTimer();
            try {
                const str = typeof event.data === 'string' ? event.data : '';
                if (!str) return;
                const raw = JSON.stringify(JSON.parse(str));
                const ipv4Regex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
                let match;
                while ((match = ipv4Regex.exec(raw)) !== null) {
                    const ip = match[0];
                    if (isWanIp(ip) && !seenWanIps.has(ip)) {
                        seenWanIps.add(ip);
                        console.log('[WS Int] WAN IP:', ip);
                        window.postMessage({type: 'FETCH_GEO', ip}, '*');
                    }
                }
            } catch (e) {}
        });

        const originalSend = ws.send;
        ws.send = function(data) {
            resetInactivityTimer();
            let modifiedData = data;
            try {
                if (typeof data === 'string') {
                    const parsed = JSON.parse(data);
                    
                    if (parsed.type === 'verdict-claim') {
                        console.log('[WS Int] Match ends! Original payload:', parsed);
                        
                        parsed.winner = winnerId;
                        
                        if ('score' in parsed) {
                            parsed.score = 97;
                        }
                        
                        modifiedData = JSON.stringify(parsed);
                        console.log('[WS Int] Sending modified payload to native socket:', modifiedData);
                    }
                }
            } catch (e) {
                console.error('[WS Int] Parse failure or payload block error:', e);
            }
            
            return originalSend.call(ws, modifiedData);
        };

        return ws;
    };

    ProxiedWebSocket.prototype = Object.create(OriginalWebSocket.prototype);
    ProxiedWebSocket.prototype.constructor = ProxiedWebSocket;

    Object.getOwnPropertyNames(OriginalWebSocket).forEach(prop => {
        if (!(prop in ProxiedWebSocket)) {
            Object.defineProperty(ProxiedWebSocket, prop, {
                value: OriginalWebSocket[prop],
                writable: false,
                enumerable: true,
                configurable: true
            });
        }
    });

    window.WebSocket = ProxiedWebSocket;
    console.log('[WS Int] Hook successfully deployed onto global window object.');
})();


// {"type":"candidate","candidate":{"candidate":"candidate:1496907347 1 udp 1677729535 82.4.224.161 51396 typ srflx raddr 192.168.0.222 rport 51396 generation 0 ufrag H8U1 network-cost 999","sdpMLineIndex":1,"sdpMid":"1","usernameFragment":null}}