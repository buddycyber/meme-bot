// Add at the top of your file
const HINGLISH_KEYWORDS = [
  'desi%20memes',
  'indian%20memes',
  'hinglish%20memes',
  'hindi%20memes'
];

// Modify your getSafeMeme function to accept a keyword
async function getSafeMeme(keyword = 'funny%20memes') {
  // ... existing browser setup code ...
  
  await page.goto(`https://www.pinterest.com/search/pins/?q=${keyword}&rs=typed`, {
    waitUntil: 'networkidle2',
    timeout: 120000
  });
  // ... rest of the function ...
}

// Improved safeInstagramPost function
async function safeInstagramPost(imagePath) {
  const ig = new IgApiClient();
  ig.state.generateDevice(process.env.INSTA_USERNAME);

  // Add proxy support if needed
  // ig.request.defaults.proxy = process.env.PROXY;

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

    // Better caption with more hashtags
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
    await utilities.randomDelay(); // Add delay before posting
    
    await ig.publish.photo({
      file: await fs.promises.readFile(imagePath),
      caption: caption,
    });

    console.log('✅ Post successful!');
    await utilities.delay(10000); // Wait after posting

  } catch (error) {
    if (error.message.includes('checkpoint')) {
      console.error('❌ Instagram requires checkpoint verification!');
      // You might want to delete the session file here
      if (fs.existsSync(sessionPath)) {
        fs.unlinkSync(sessionPath);
      }
    }
    throw error;
  }
}

// Modified main function to rotate between English and Hinglish
async function main() {
  let tempFile;
  try {
    // Alternate between English and Hinglish memes
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
    // If it's a rate limit error, wait longer
    if (error.message.includes('rate limit') || error.message.includes('too many')) {
      const waitTime = 60 * 60 * 1000; // 1 hour
      console.log(`⏳ Rate limited, waiting ${waitTime/60000} minutes...`);
      await utilities.delay(waitTime);
    }
  } finally {
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlink(tempFile, () => {});
    }
  }
}

// SINGLE execution block with proper intervals
(async () => {
  while (true) {
    try {
      await main();
      
      // Random delay between 40-120 minutes to appear more human
      const delayInMinutes = Math.floor(Math.random() * 81) + 40;
      console.log(`🕒 Waiting ${delayInMinutes} minutes before next post...`);
      await utilities.delay(delayInMinutes * 60 * 1000);
      
    } catch (error) {
      console.error('Fatal error:', error);
      // If major error, wait 3 hours before retrying
      await utilities.delay(3 * 60 * 60 * 1000);
    }
  }
})();
