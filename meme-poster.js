require('dotenv').config();
const { IgApiClient } = require('instagram-private-api');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { get } = require('request-promise');

// Add stealth plugin
puppeteer.use(StealthPlugin());

// ======================
// UTILITY FUNCTIONS
// ======================
const utilities = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  randomDelay: () => utilities.delay(3000 + Math.random() * 5000),
  getRandomHashtags: () => {
    const trendingHashtags = [
      '#memesdaily', '#memesindia', '#hindimemes', '#desimemes', 
      '#viralmemes', '#trendingmemes', '#funnyindia', '#comedy',
      '#lol', '#funnymemes', '#memes', '#dankmemes', '#indianmemes',
      '#latestmemes', '#todaymeme', '#jokes', '#humor', '#laugh'
    ];
    // Select 5-8 random hashtags
    return trendingHashtags
      .sort(() => 0.5 - Math.random())
      .slice(0, 5 + Math.floor(Math.random() * 4))
      .join(' ');
  },
  getRandomCaption: () => {
    const captions = [
      "Aaj ka dose of laughter 😂",
      "Kya aap bhi aise hi sochte hain? 🤔",
      "Zindagi in a nutshell...",
      "Relatable much? 😅",
      "When you realize... 🤯",
      "Mood for the day 🥲",
      "Aisa lagta hai...",
      "Me everytime...",
      "Koi samjhao ise please 🙏",
      "Yehi hota hai jab...",
      "Aaj ka thought 💭",
      "Mera reaction exactly yahi tha 😂",
      "Kya aapke saath bhi aisa hota hai?",
      "When someone says...",
      "Me trying to...",
      "Sabke saath hota hai na? 😅",
      "Aaj ka viral moment 🚀",
      "Mood right now...",
      "Kya matlab? 🤨",
      "Aise hi chalta hai...",
      "Me waiting for... ⏳",
      "When you're trying to...",
      "Yehi to dikkat hai...",
      "Aaj ka relatable content 😌",
      "Zindagi ka sach...",
      "Me after...",
      "When someone asks...",
      "Aaj ka mood...",
      "Sabki life me ek aisa moment...",
      "Kya karein, aisa hi hai..."
    ];
    return captions[Math.floor(Math.random() * captions.length)];
  }
};

// ======================
// IMPROVED PINTEREST SCRAPER
// ======================
async function getSafeMeme() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  let retries = 3;
  
  while (retries > 0) {
    try {
      const page = await browser.newPage();
      
      // Set realistic browser fingerprints
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1280 + Math.floor(Math.random() * 100), height: 800 + Math.floor(Math.random() * 100) });
      
      // Bypass headless detection more effectively
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      });

      // Randomize search queries to get varied content
      const searchQueries = [
        'funny hindi memes',
        'trending indian memes',
        'latest viral memes',
        'desi comedy memes',
        'relatable hindi memes',
        'aaj ka trending meme',
        'dank indian memes'
      ];
      const randomQuery = searchQueries[Math.floor(Math.random() * searchQueries.length)];
      
      console.log(`🔍 Searching Pinterest for: ${randomQuery}`);
      await page.goto(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(randomQuery)}&rs=typed`, {
        waitUntil: 'networkidle2',
        timeout: 120000
      });

      console.log('Page loaded, scrolling to find fresh memes...');
      await utilities.randomDelay();

      // Scroll more naturally with random intervals
      for (let i = 0; i < 8 + Math.floor(Math.random() * 5); i++) {
        await page.evaluate(() => window.scrollBy(0, 1000 + Math.random() * 1000));
        await utilities.delay(800 + Math.random() * 2000);
      }

      // Get all image URLs and filter for originals
      const memeUrls = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img[src*="pinimg.com"]'))
          .map(img => {
            let src = img.src;
            // Try to get higher quality versions
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
      
      // Select a random meme but prefer newer ones (later in array)
      const selectedIndex = Math.min(
        memeUrls.length - 1,
        Math.floor(Math.random() * memeUrls.length * 0.7) + Math.floor(memeUrls.length * 0.3)
      );
      return memeUrls[selectedIndex];

    } catch (error) {
      console.error(`Attempt ${4-retries} failed:`, error.message);
      retries--;
      if (retries === 0) throw error;
      await utilities.delay(15000); // Wait longer before retry
    } finally {
      await browser.close();
    }
  }
}

// ======================
// IMPROVED INSTAGRAM POSTER
// ======================
async function safeInstagramPost(imagePath) {
  const ig = new IgApiClient();
  ig.state.generateDevice(process.env.INSTA_USERNAME);

  // More realistic device simulation
  ig.state.deviceString = `23/6.0.1/Android-${Math.floor(Math.random() * 5) + 28}/samsung/SM-G9${Math.floor(Math.random() * 5) + 20}`;
  ig.state.cookieJar = ig.state.cookieJar;

  const sessionPath = path.join(__dirname, 'ig-session.json');

  // Load session if it exists
  if (fs.existsSync(sessionPath)) {
    try {
      const savedSession = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      await ig.state.deserialize(savedSession);
      
      // Verify session is still valid
      try {
        await ig.account.currentUser();
        console.log('✅ Restored valid Instagram session');
      } catch (e) {
        console.log('⚠️ Session expired, logging in fresh...');
        await ig.account.login(process.env.INSTA_USERNAME, process.env.INSTA_PASSWORD);
      }
    } catch (e) {
      console.log('⚠️ Error loading session, logging in fresh...');
      await ig.account.login(process.env.INSTA_USERNAME, process.env.INSTA_PASSWORD);
    }
  } else {
    console.log('🔐 Logging in...');
    await ig.account.login(process.env.INSTA_USERNAME, process.env.INSTA_PASSWORD);
  }

  // Save the session
  const session = await ig.state.serialize();
  delete session.constants;
  fs.writeFileSync(sessionPath, JSON.stringify(session));

  // Generate dynamic caption
  const caption = `${utilities.getRandomCaption()}\n\n` +
                 `Credits to original creator 🙏\n` +
                 `${utilities.getRandomHashtags()}`;

  console.log('📤 Uploading post with caption:', caption);
  
  // Add random delay before posting (mimic human behavior)
  await utilities.delay(5000 + Math.random() * 10000);
  
  try {
    await ig.publish.photo({
      file: await fs.promises.readFile(imagePath),
      caption: caption,
    });
    console.log('✅ Post successful!');
    
    // Add random activity after posting
    if (Math.random() > 0.7) {
      await utilities.delay(10000 + Math.random() * 20000);
      await ig.feed.timeline().request();
      console.log('🔄 Performed random timeline refresh');
    }
  } catch (error) {
    // Handle specific Instagram errors
    if (error.message.includes('checkpoint')) {
      console.error('❌ Instagram checkpoint required! Please login manually to verify.');
      process.exit(1);
    } else if (error.message.includes('spam')) {
      console.error('❌ Instagram flagged this as spam. Waiting longer before next post.');
      await utilities.delay(3600000); // Wait 1 hour
      throw error;
    } else {
      throw error;
    }
  }
}

// ======================
// IMPROVED MAIN FUNCTION
// ======================
async function main() {
  let tempFile;
  try {
    console.log('🔍 Finding a fresh meme...');
    const memeUrl = await getSafeMeme();
    console.log('📌 Selected meme:', memeUrl);

    tempFile = path.join(__dirname, `meme_${Date.now()}${Math.floor(Math.random() * 1000)}.jpg`);
    
    // Download with retries
    let retries = 3;
    while (retries > 0) {
      try {
        const response = await axios({
          url: memeUrl,
          method: 'GET',
          responseType: 'stream',
          timeout: 30000
        });

        await new Promise((resolve, reject) => {
          const writer = fs.createWriteStream(tempFile);
          response.data.pipe(writer);
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        console.log(`Download failed, retrying (${retries} left)...`);
        await utilities.delay(5000);
      }
    }

    console.log('📤 Posting to Instagram...');
    await safeInstagramPost(tempFile);
  } catch (error) {
    console.error('❌ Failed:', error.message);
    // If it's an Instagram block, wait longer
    if (error.message.includes('block') || error.message.includes('spam')) {
      const waitHours = 2 + Math.random() * 6;
      console.log(`⏳ Waiting ${waitHours.toFixed(1)} hours due to block...`);
      await utilities.delay(waitHours * 3600000);
    }
  } finally {
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlink(tempFile, () => {});
    }
  }
}

// ======================
// IMPROVED SCHEDULER
// ======================
(async () => {
  // Initial random delay to avoid predictable patterns
  await utilities.delay(Math.random() * 3600000);
  
  while (true) {
    try {
      await main();
    } catch (error) {
      console.error('Fatal error:', error);
    }

    // Random wait between 1.5 to 4 hours (more human-like)
    const delayInHours = 1.5 + Math.random() * 2.5;
    console.log(`🕒 Waiting ${delayInHours.toFixed(1)} hours before next post...`);
    await utilities.delay(delayInHours * 3600000);
  }
})();
