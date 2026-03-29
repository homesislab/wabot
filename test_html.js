const axios = require('axios');
const cheerio = require('cheerio'); // Wabot doesn't have cheerio? Let's use regex.

async function testFetchHtml() {
    try {
        const response = await fetch("https://pollinations.ai/p/cat?nologo=true");
        const text = await response.text();
        console.log("HTML length:", text.length);
        const match = text.match(/<meta property="og:image" content="([^"]+)"/i);
        if (match) {
            console.log("Found OG Image:", match[1]);
        } else {
            console.log("No OG image found.");
            // check for other img tags
            const imgMatch = text.match(/<img[^>]+src="([^"]+)"/ig);
            if (imgMatch) {
                console.log("Found img tags:", imgMatch.join('\n'));
            }
        }
    } catch (e) {
        console.error(e);
    }
}
testFetchHtml();
