const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ==== Sozlamalar ====
const token = '8286923994:AAFyVMqHwG9PfucKmVh4H2o8YhS5y48VyHM';
const adminId = 2143535441;
const adminUsername = 'Asliddinamriddinov'; // admin username

// ==== Majburiy kanallar ====
const channels = ['@jahon_kinolari_maxsus', '@jahon_kinolarii01'];

// ==== Fayllar ====
const MOVIE_FILE = 'movies.json';
const USER_FILE = 'users.json';
const LOG_FILE = 'logs.json';

let movies = fs.existsSync(MOVIE_FILE) ? JSON.parse(fs.readFileSync(MOVIE_FILE)) : {};
let users = fs.existsSync(USER_FILE) ? JSON.parse(fs.readFileSync(USER_FILE)) : [];
let logs = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE)) : {};

function saveMovies() {
  fs.writeFileSync(MOVIE_FILE, JSON.stringify(movies, null, 2));
}

function saveUsers() {
  fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 2));
}

function saveLogs() {
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

// ==== Bot ishga tushishi ====
const bot = new TelegramBot(token, { polling: true });
console.log('✅ Kino bot ishga tushdi!');

// ==== Obuna tekshiruvi ====
async function checkSubscription(userId) {
  for (const channel of channels) {
    try {
      const member = await bot.getChatMember(channel, userId);
      if (member.status === 'left' || member.status === 'kicked') return false;
    } catch {
      return false;
    }
  }
  return true;
}

// ==== /start komandasi ====
bot.onText(/\/start/, async (msg) => {
  const userId = msg.chat.id;

  // Admin uchun panel
  if (userId === adminId) {
    const buttons = [
      [{ text: '🎬 Kino qo‘shish', callback_data: 'admin_add' }],
      [{ text: '🗑 Kino o‘chirish', callback_data: 'admin_delete' }],
      [{ text: '♻ Kino yangilash', callback_data: 'admin_update' }],
      [{ text: '📊 Statistika', callback_data: 'admin_stats' }]
    ];
    return bot.sendMessage(userId, '🔐 Admin paneliga xush kelibsiz:', {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // Oddiy foydalanuvchi uchun
  if (users.indexOf(userId) === -1) {
    users.push(userId);
    saveUsers();
  }

  const isSubscribed = await checkSubscription(userId);
  if (!isSubscribed) {
    const buttons = channels.map(ch => [{ text: ch, url: `https://t.me/${ch.replace('@', '')}` }]);
    buttons.push([{ text: '✅ A’zo bo‘ldim', callback_data: 'check_sub' }]);
    return bot.sendMessage(userId, "❗ Botdan foydalanish uchun quyidagi kanallarga a'zo bo'ling:", {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  bot.sendMessage(userId, '🎬 Kino kodini kiriting:');
});

// ==== Callback tugmalar ====
bot.on('callback_query', async (query) => {
  const userId = query.message.chat.id;

  if (query.data === 'check_sub') {
    const isSubscribed = await checkSubscription(userId);
    if (isSubscribed) {
      bot.sendMessage(userId, '✅ Rahmat! Endi kino kodini yuborishingiz mumkin.');
    } else {
      bot.sendMessage(userId, '❗ Hali ham barcha kanallarga a’zo bo‘lmadingiz.');
    }
  }

  // Admin funksiyalari
  if (userId === adminId) {
    if (query.data === 'admin_add') {
      bot.sendMessage(userId, 'Yangi kino kodi kiriting:');
      bot.once('message', (msg) => {
        const code = msg.text;
        bot.sendMessage(userId, `Kod "${code}" uchun kino faylini yuboring:`);
        bot.once('message', (movieMsg) => {
          let fileId = null;
          if (movieMsg.video) fileId = movieMsg.video.file_id;
          else if (movieMsg.document) fileId = movieMsg.document.file_id;
          if (!fileId) return bot.sendMessage(userId, '❌ Kino fayli aniqlanmadi.');
          movies[code] = fileId;
          saveMovies();
          bot.sendMessage(userId, `✅ Kino kod "${code}" saqlandi.`);
        });
      });
    }

    if (query.data === 'admin_delete') {
      bot.sendMessage(userId, 'O‘chirmoqchi bo‘lgan kino kodini kiriting:');
      bot.once('message', (msg) => {
        const code = msg.text;
        if (movies[code]) {
          delete movies[code];
          saveMovies();
          bot.sendMessage(userId, `🗑 Kino kod "${code}" o‘chirildi.`);
        } else {
          bot.sendMessage(userId, '❌ Bunday kod topilmadi.');
        }
      });
    }

    if (query.data === 'admin_update') {
      bot.sendMessage(userId, 'Yangilamoqchi bo‘lgan kino kodini kiriting:');
      bot.once('message', (msg) => {
        const code = msg.text;
        if (!movies[code]) return bot.sendMessage(userId, '❌ Bunday kod topilmadi.');
        bot.sendMessage(userId, `Kod "${code}" uchun yangi faylni yuboring:`);
        bot.once('message', (movieMsg) => {
          let fileId = null;
          if (movieMsg.video) fileId = movieMsg.video.file_id;
          else if (movieMsg.document) fileId = movieMsg.document.file_id;
          if (!fileId) return bot.sendMessage(userId, '❌ Kino fayli aniqlanmadi.');
          movies[code] = fileId;
          saveMovies();
          bot.sendMessage(userId, `✅ Kod "${code}" yangilandi.`);
        });
      });
    }

    if (query.data === 'admin_stats') {
      let mostRequested = Object.entries(logs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([code, count]) => `${code}: ${count} marta`)
        .join('\n');
      if (!mostRequested) mostRequested = 'Hali hech qanday so‘rov yo‘q.';

      bot.sendMessage(userId, `📊 Statistika:\n\n👥 Obunachilar: ${users.length}\n\n🔥 Eng ko‘p so‘ralgan kinolar:\n${mostRequested}`);
    }
  }
});

// ==== Kino kodi yuborilishi ====
bot.on('message', async (msg) => {
  const userId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;
  if (userId === adminId) return; // Admin kodi yuborish emas

  const isSubscribed = await checkSubscription(userId);
  if (!isSubscribed) {
    const buttons = channels.map(ch => [{ text: ch, url: `https://t.me/${ch.replace('@', '')}` }]);
    buttons.push([{ text: '✅ A’zo bo‘ldim', callback_data: 'check_sub' }]);
    return bot.sendMessage(userId, "❗ Avval quyidagi kanallarga a'zo bo'ling:", {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  const movie = movies[text];
  if (!movie) {
    return bot.sendMessage(userId, '❌ Bunday kod topilmadi. To‘g‘ri kiritganingizni tekshiring.');
  }

  logs[text] = (logs[text] || 0) + 1;
  saveLogs();

  try {
    await bot.sendMessage(userId, '📥 Mana siz so‘ragan kino:');
    await bot.sendVideo(userId, movie);
  } catch {
    await bot.sendMessage(
      userId,
      `❌ Kino faylini yuborishda xatolik yuz berdi. [Admin bilan bog‘laning](https://t.me/${adminUsername})`,
      { parse_mode: 'Markdown' }
    );
  }
});

// ==== Admin bilan bog‘lanish ====
bot.onText(/\/admin/, (msg) => {
  const userId = msg.chat.id;
  bot.sendMessage(
    userId,
    `📩 [Admin bilan bog‘lanish](https://t.me/${adminUsername})`,
    { parse_mode: 'Markdown' }
  );
});
