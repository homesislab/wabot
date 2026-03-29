async function testFetch() {
    const prompt = "cat";
    // Try different subdomains
    const urls = [
        `https://image.pollinations.ai/prompt/${prompt}`,
        `https://gen.pollinations.ai/image/${prompt}`,
        `https://pollinations.ai/p/${prompt}`
    ];

    for (const url of urls) {
        try {
            console.log(`\nTesting: ${url}`);
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                }
            });
            console.log(`Status: ${response.status}`);
            console.log(`Content-Type: ${response.headers.get('content-type')}`);

            if (response.ok) {
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('image')) {
                    const buffer = await response.arrayBuffer();
                    console.log(`Success! Received image buffer: ${buffer.byteLength} bytes`);
                } else {
                    const text = await response.text();
                    console.log(`Not an image. First 100 chars: ${text.substring(0, 100)}`);
                }
            } else {
                const text = await response.text();
                console.log(`Error body: ${text.substring(0, 100)}`);
            }
        } catch (e) {
            console.error(`Fetch error: ${e.message}`);
        }
    }
}

testFetch();
