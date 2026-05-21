import { ToggleClient } from './dist/client.js';
import http from 'http';

const server = http.createServer((req, res) => {
    if (req.url === '/api/toggles/test-toggle') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { name: 'test-toggle', enabled: true } }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(3098, async () => {
    const client = new ToggleClient({ serviceUrl: 'http://localhost:3098', cacheTtlMs: 100, retryAttempts: 1, retryDelayMs: 10 });
    
    // Initial fetch
    const t1 = await client.getToggle('test-toggle');
    console.log('T1:', t1);
    
    // Wait for cache to expire
    await new Promise(r => setTimeout(r, 150));
    
    // Close server to simulate API down
    server.close(async () => {
        // Fetch again, should fallback to stale
        const t2 = await client.getToggle('test-toggle');
        console.log('T2 (stale):', t2);
        
        // Wait and fetch again
        const t3 = await client.getToggle('test-toggle');
        console.log('T3 (stale):', t3);
    });
});
