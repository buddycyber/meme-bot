require('dotenv').config();
const { IgApiClient } = require('instagram-private-api');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ======================
// UTILITY FUNCTIONS (Moved to top-level)
// ======================
const utilities = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  randomDelay: () => utilities.delay(3000 + Math.random() * 5000)
};

// ======================
// CONSTANTS
// ======================
const HINGLISH_KEYWORDS = [
  'desi%20memes',
  'indian%20memes',
  'hinglish%20memes',
  'hindi%20memes'
];

// ======================
// PINTEREST SCRAPER (Fixed page reference)
// ======================
async function getSafeMeme(keyword = 'funny%20memes') {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process'
    ]
  });

  let retries = 3;
  let page; // Declare page variable here
  
  while (retries > 0) {
    try {
      page = await browser.newPage(); // Now properly scoped
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1280, height: 800 });

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });

      console.log('Loading Pinterest...');
      await page.goto(`https://www.pinterest.com/search/pins/?q=${keyword}&rs=typed`, {
        waitUntil: 'networkidle2',
        timeout: 120000
      });

      console.log('Page loaded, scrolling...');
      await utilities.randomDelay();

      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, 1500));
        await utilities.delay(1000);
      }

      const memeUrls = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img'))
          .map(img => {
            let src = img.src;
            if (src.includes('/236x/')) src = src.replace('/236x/', '/originals/');
            else if (src.includes('/474x/')) src = src.replace('/474x/', '/originals/');
            else if (src.includes('/736x/')) src = src.replace('/736x/', '/originals/');
            return src;
          })
          .filter(src =>
            src.startsWith('https://i.pinimg.com/originals/') &&
            /\.(jpg|jpeg|png)$/i.test(src)
          );
      });

      if (!memeUrls.length) throw new Error('No copyright-safe memes found');
      return memeUrls[Math.floor(Math.random() * memeUrls.length)];

    } catch (error) {
      console.error(`Attempt ${4-retries} failed:`, error.message);
      retries--;
      if (retries === 0) throw error;
      await utilities.delay(10000);
    } finally {
      if (page) await page.close();
      await browser.close();
    }
  }
}

// ======================
// INSTAGRAM POSTER
// ======================
async function safeInstagramPost(imagePath) {
  const ig = new IgApiClient();
  ig.state.generateDevice(process.env.INSTA_USERNAME);

  const sessionPath = path.join(__dirname, 'ig-session.json');

  try {
    if (fs.existsSync(sessionPath)) {
      const savedSession = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      await ig.state.deserialize(savedSession);
      console.log('✅ Restored previous Instagram session');
    } else {
      console.log('🔐 Logging in...');
      await ig.account.login(process.env.INSTA_USERNAME, process.env.INSTA_PASSWORD);
      const session = await ig.state.serialize();
      delete session.constants;
      fs.writeFileSync(sessionPath, JSON.stringify(session));
      console.log('✅ Logged in and saved session');
    }

    const captions = [
      `😂 Daily dose of laughter for you! ${Math.random() > 0.5 ? 'Hope this makes your day better!' : 'Enjoy!'}\n\n` +
      `Credits to original creator 🙏\n` +
      `#memes #funny #viral #trending #comedy #lol #memesdaily #indianmemes #desimemes #fun`,
      
      `🤣 Just found this gem! ${Math.random() > 0.5 ? 'Couldn\'t stop laughing!' : 'Too relatable!'}\n\n` +
      `Credit to the creator 👍\n` +
      `#funny #memes #viral #trending #laugh #comedy #indianmemes #desimemes #dankmemes`
    ];

    const caption = captions[Math.floor(Math.random() * captions.length)];

    console.log('📤 Uploading post...');
    await utilities.randomDelay();
    
    await ig.publish.photo({
      file: await fs.promises.readFile(imagePath),
      caption: caption,
    });

    console.log('✅ Post successful!');
    await utilities.delay(10000);

  } catch (error) {
    if (error.message.includes('checkpoint')) {
      console.error('❌ Instagram requires checkpoint verification!');
      if (fs.existsSync(sessionPath)) {
        fs.unlinkSync(sessionPath);
      }
    }
    throw error;
  }
}

// ======================
// MAIN FUNCTION
// ======================
async function main() {
  let tempFile;
  try {
    const useHinglish = Math.random() > 0.5;
    const keyword = useHinglish 
      ? HINGLISH_KEYWORDS[Math.floor(Math.random() * HINGLISH_KEYWORDS.length)]
      : 'funny%20memes';

    console.log(`🔍 Finding a ${useHinglish ? 'Hinglish' : 'English'} meme...`);
    const memeUrl = await getSafeMeme(keyword);
    console.log('📌 Selected:', memeUrl);

    tempFile = path.join(__dirname, `meme_${Date.now()}.jpg`);
    const response = await axios({
      url: memeUrl,
      method: 'GET',
      responseType: 'stream'
    });

    await new Promise((resolve, reject) => {
      response.data.pipe(fs.createWriteStream(tempFile))
        .on('finish', resolve)
        .on('error', reject);
    });

    console.log('📤 Posting to Instagram...');
    await safeInstagramPost(tempFile);
  } catch (error) {
    console.error('❌ Failed:', error.message);
    if (error.message.includes('rate limit') || error.message.includes('too many')) {
      const waitTime = 60 * 60 * 1000;
      console.log(`⏳ Rate limited, waiting ${waitTime/60000} minutes...`);
      await utilities.delay(waitTime);
    }
  } finally {
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlink(tempFile, () => {});
    }
  }
}

// ======================
// EXECUTION BLOCK
// ======================
(async () => {
  while (true) {
    try {
      await main();
      
      const delayInMinutes = Math.floor(Math.random() * 81) + 40;
      console.log(`🕒 Waiting ${delayInMinutes} minutes before next post...`);
      await utilities.delay(delayInMinutes * 60 * 1000);
      
    } catch (error) {
      console.error('Fatal error:', error);
      await utilities.delay(3 * 60 * 60 * 1000);
    }
  }
})();
