const prompt = "cat";
const url = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&nologo=true`;

async function testFetch() {
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers.get('content-type')}`);
        if (!response.ok) {
            const text = await response.text();
            console.log(text.substring(0, 200));
        }
    } catch (e) {
        console.error(e);
    }
}
testFetch();
