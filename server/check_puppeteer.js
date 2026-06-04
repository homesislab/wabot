import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  console.log("Navigating to https://wabot.homesislab.my.id/api/docs/...");
  await page.goto('https://wabot.homesislab.my.id/api/docs/', { waitUntil: 'networkidle2' });
  console.log("Page loaded.");
  
  // wait 2 seconds just in case
  await new Promise(r => setTimeout(r, 2000));

  await browser.close();
})();
