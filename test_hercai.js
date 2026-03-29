async function testHercai() {
    const prompt = "A beautiful sunset over a fantasy city";
    const url = `https://api.hercai.com/v3/text2image?prompt=${encodeURIComponent(prompt)}&model=v3`;

    try {
        console.log(`Testing Hercai: ${url}`);
        const response = await fetch(url);
        console.log(`Status: ${response.status}`);
        const data = await response.json();
        console.log("Response Data:", JSON.stringify(data, null, 2));

        if (data.url) {
            console.log("Found Image URL:", data.url);
            const imgRes = await fetch(data.url);
            console.log(`Image Fetch Status: ${imgRes.status}, Size: ${imgRes.headers.get('content-length')}`);
        }
    } catch (e) {
        console.error("Hercai Error:", e.message);
    }
}

testHercai();
