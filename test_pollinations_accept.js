async function testPollinationsAcceptHeader() {
    const prompt = "cat";
    const url = `https://pollinations.ai/p/${prompt}`;

    try {
        console.log(`Testing with Accept header: ${url}`);
        const response = await fetch(url, {
            headers: {
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            }
        });

        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers.get('content-type')}`);

        if (response.ok) {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('image')) {
                const buffer = await response.arrayBuffer();
                console.log(`Success! Image received: ${buffer.byteLength} bytes`);
            } else {
                const text = await response.text();
                console.log(`Still HTML. First 100 chars: ${text.substring(0, 100)}`);
            }
        }
    } catch (e) {
        console.error("Fetch Error:", e.message);
    }
}

testPollinationsAcceptHeader();
