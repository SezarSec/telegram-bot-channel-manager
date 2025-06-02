# Telegram Bot Channel Manager (Cloudflare Workers)

**[English](#english) | [فارسی (Persian)](#persian)**

---

## 🇬🇧 English
<a name="english"></a>

[![Language](https://img.shields.io/badge/language-JavaScript-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Platform](https://img.shields.io/badge/platform-Cloudflare%20Workers-orange.svg)](https://workers.cloudflare.com/)
[![Dependency](https://img.shields.io/badge/dependency-Telegram%20Bot%20API-blue.svg)](https://core.telegram.org/bots/api)
[![Dependency](https://img.shields.io/badge/storage-Cloudflare%20KV-red.svg)](https://developers.cloudflare.com/workers/runtime-apis/kv/)
[![GitHub Stars](https://img.shields.io/github/stars/SezarSec/telegram-bot-channel-manager?style=social)](https://github.com/SezarSec/telegram-bot-channel-manager/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/SezarSec/telegram-bot-channel-manager?style=social)](https://github.com/SezarSec/telegram-bot-channel-manager/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/SezarSec/telegram-bot-channel-manager)](https://github.com/SezarSec/telegram-bot-channel-manager/issues)
[![License](https://img.shields.io/github/license/SezarSec/telegram-bot-channel-manager)](https://github.com/SezarSec/telegram-bot-channel-manager/blob/main/LICENSE)


This project is a powerful Telegram bot designed for advanced management of posts to Telegram channel(s), running on the serverless Cloudflare Workers platform. It allows admins to create posts with full details (title, description, optional image, main content, and download limit) and send them to target channels. It also features an advanced admin panel for user control, statistics, broadcasting messages, and forced join settings.

### ✨ Key Features

* **Multi-step Post Creation:** Get title, description, image (optional), download limit, and main content (file or text).
* **Send to Multiple Target Channels:** Ability to configure and send posts to one or more Telegram channels.
* **Advanced Inline Buttons in Channel:**
    * "Get File" button with a direct deep link to the bot.
    * Button to display post download statistics (downloaded count out of total limit).
* **Auto-delete Sent Files:** The main file sent to the user is automatically deleted from the user's chat after a specified time (e.g., 15 seconds).
* **Comprehensive Admin Panel (via `/panel` command):**
    * Create a new post.
    * Post Management:
        * Delete post by ID.
        * Display a paginated list of posts with an option to delete directly from the list.
    * Manage target channels (add, remove, list).
    * Bot Statistics: Display total users and banned users.
    * User Management:
        * Display a paginated list of users with details (ID, name, username, ban status).
        * Ban and unban users.
    * Broadcast messages to all bot users.
    * Manage forced-join channels (add, remove, list).
* **Forced Join Check:** Before sending a file to a user, their membership in specified channels is checked.
* **Data Storage:** Uses Cloudflare KV to store post information, user data, settings, etc.
* **Cloudflare Workers Based:** Lightweight, fast, and highly scalable.

### 🚀 Setup and Installation

Follow these steps to set up the bot:

#### Prerequisites

1.  **Cloudflare Account:** To deploy the Worker and use KV Namespace.
2.  **Telegram Bot Token:** Create a new bot by talking to [BotFather](https://t.me/BotFather) on Telegram and get its API token.
3.  **(Optional but Recommended) Wrangler CLI:** Cloudflare's command-line tool for developing and managing Workers. You can also proceed via the Cloudflare dashboard.
    ```bash
    npm install -g wrangler
    ```

#### Setup Steps

1.  **Clone the Project (or Copy the Code):**
    ```bash
    git clone [https://github.com/SezarSec/telegram-bot-channel-manager.git](https://github.com/SezarSec/telegram-bot-channel-manager.git)
    cd telegram-bot-channel-manager
    ```
    Alternatively, copy the `index.js` code into your Worker project.

2.  **Create a KV Namespace:**
    * In the Cloudflare dashboard, go to Workers & Pages -> KV.
    * Create a new KV Namespace (e.g., `TELEGRAM_BOT_DATA`).
    * Copy the **ID** of this Namespace.

3.  **Configure the Worker:**

    * **If using Wrangler:**
        * Create or edit the `wrangler.toml` file similar to the example below:
            ```toml
            name = "telegram-bot-channel-manager" # Your Worker's name
            main = "src/index.js"    # Path to your main code file (if in src/index.js)
            compatibility_date = "YYYY-MM-DD" # Today's date or a recent one

            # Your Cloudflare Account ID
            # account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"

            kv_namespaces = [
              { binding = "BOT_KV", id = "YOUR_KV_NAMESPACE_ID" } # ID of the created KV Namespace
            ]
            ```
        * Set the secrets using the following commands:
            ```bash
            wrangler secret put BOT_TOKEN 
            # Enter your bot token

            wrangler secret put ADMIN_CHAT_ID 
            # Enter the numeric Telegram ID of the main admin

            wrangler secret put BOT_USERNAME
            # Enter your bot's username (without @) for Deep Linking
            ```
    * **If using the Cloudflare Dashboard:**
        * Create a new Worker or edit an existing one.
        * Copy the `index.js` code into the online editor.
        * Go to Settings -> Variables:
            * **KV Namespace Bindings:** Add a binding named `BOT_KV` to your created KV Namespace.
            * **Environment Variables (Secrets):** Add and **Encrypt** the following variables:
                * `BOT_TOKEN`: Your bot token.
                * `ADMIN_CHAT_ID`: Numeric ID of the main admin.
                * `BOT_USERNAME`: Your bot's username (without `@`).
        * Set the Compatibility Date in Settings -> Compatibility.

4.  **Deploy the Worker:**
    * With Wrangler: `wrangler deploy`
    * Via Dashboard: Save and Deploy

5.  **Set Telegram Webhook:**
    * Get your Worker's URL (e.g., `https://telegram-bot-channel-manager.your-subdomain.workers.dev`).
    * Replace the placeholders in the URL below and open it in a web browser:
        `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>`
    * Alternatively, use the `/setwebhook` path defined in the code: `https://telegram-bot-channel-manager.your-subdomain.workers.dev/setwebhook` (run once in a browser).

6.  **Initial Bot Configuration via Chat:**
    * Go to your bot on Telegram and send the `/start` command.
    * Use the `/panel` command to access the admin panel and perform initial setups (like adding a target channel via the "Manage Target Channels" button).
    * Ensure your bot is an admin in the target channel(s) and forced-join channel(s) (if used) with necessary permissions (send messages, delete messages, edit messages).

### 🛠️ Main Admin Commands (Via Chat or Panel)

* `/panel`: Display the admin panel with inline buttons.
* **Create Post:** Via panel button or `/newpost` command.
* **Manage Posts:**
    * Delete Post by ID: Via panel button or `/deletepost <ID>` command.
    * List & Delete Posts: Via "List & Delete Posts" button in the panel.
* **Manage Target Channels:** Via "Manage Target Channels" button in the panel or commands:
    * `/addtargetchannel <ID or Username>`
    * `/removetargetchannel <ID or Username>`
    * `/listtargetchannels`
* **Stats & User Management:** Via "User Management" and "Bot Stats" buttons in the panel or commands:
    * `/stats`
    * `/listusers`
    * `/ban <User ID>`
    * `/unban <User ID>`
* **Broadcast Message:** Via panel button or `/broadcast <Message Text>` command.
* **Manage Forced Join:** Via "Manage Forced Join" button in the panel or commands:
    * `/addjoinchannel <ID or Username>`
    * `/removejoinchannel <ID or Username>`
    * `/listjoinchannels`
* **Manage Admins (Main Admin Only):**
    * `/addadmin <User ID>`
    * `/removeadmin <User ID>`
    * `/listadmins`

### ⚙️ Required Environment Variables (Secrets)

* `BOT_TOKEN`: Your Telegram Bot API token.
* `ADMIN_CHAT_ID`: The numeric Telegram ID of the main bot admin.
* `BOT_USERNAME`: Your bot's username (without the `@` symbol, used for Deep Linking).
* `(Optional) config:channel_username_display`: The username of the channel you want to display at the end of posts (e.g., `@MyPublicChannel`). If not set, a default value from the code is used, or you can remove it.

### 🤝 Contributing

Contributions to improve this project are welcome! Please create a Pull Request to submit changes or open Issues to report bugs and suggest features.

### 📞 Contact Us

* **Telegram Channel:** [https://t.me/sezar_Sec](https://t.me/sezar_Sec)
* **Support Bot:** [https://t.me/SezarSupport_bot](https://t.me/SezarSupport_bot)

### 📜 License

This project is licensed under the [MIT License]

---
---

## 🇮🇷 فارسی (Persian)
<a name="persian"></a>

[![زبان](https://img.shields.io/badge/language-JavaScript-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![پلتفرم](https://img.shields.io/badge/platform-Cloudflare%20Workers-orange.svg)](https://workers.cloudflare.com/)
[![وابستگی](https://img.shields.io/badge/dependency-Telegram%20Bot%20API-blue.svg)](https://core.telegram.org/bots/api)
[![وابستگی](https://img.shields.io/badge/storage-Cloudflare%20KV-red.svg)](https://developers.cloudflare.com/workers/runtime-apis/kv/)
[![ستاره‌های گیت‌هاب](https://img.shields.io/github/stars/SezarSec/telegram-bot-channel-manager?style=social&label=ستاره)](https://github.com/SezarSec/telegram-bot-channel-manager/stargazers)
[![فورک‌های گیت‌هاب](https://img.shields.io/github/forks/SezarSec/telegram-bot-channel-manager?style=social&label=فورک)](https://github.com/SezarSec/telegram-bot-channel-manager/network/members)
[![مشکلات گیت‌هاب](https://img.shields.io/github/issues/SezarSec/telegram-bot-channel-manager?label=مشکلات)](https://github.com/SezarSec/telegram-bot-channel-manager/issues)
[![مجوز](https://img.shields.io/github/license/SezarSec/telegram-bot-channel-manager?label=مجوز)](https://github.com/SezarSec/telegram-bot-channel-manager/blob/main/LICENSE)


این پروژه یک ربات تلگرامی قدرتمند است که برای مدیریت ارسال پست به کانال(های) تلگرام طراحی شده و بر روی پلتفرم بدون سرور Cloudflare Workers اجرا می‌شود. این ربات به ادمین‌ها امکان می‌دهد تا پست‌ها را با جزئیات کامل (تیتر، توضیحات، تصویر اختیاری، محتوای اصلی و محدودیت دانلود) ایجاد کرده و به کانال‌های هدف ارسال کنند. همچنین دارای پنل مدیریت پیشرفته برای کنترل کاربران، آمار، پیام همگانی و تنظیمات عضویت اجباری است.

### ✨ ویژگی‌های کلیدی

* **ایجاد پست چندمرحله‌ای:** دریافت تیتر، توضیحات، تصویر (اختیاری)، محدودیت دانلود و محتوای اصلی (فایل یا متن).
* **ارسال به چندین کانال هدف:** قابلیت تنظیم و ارسال پست به یک یا چند کانال تلگرام.
* **دکمه‌های شیشه‌ای پیشرفته در کانال:**
    * دکمه دریافت فایل با لینک مستقیم (Deep Linking) برای هدایت کاربر به ربات.
    * دکمه نمایش آمار دانلود پست (تعداد دانلود شده از کل محدودیت).
* **حذف خودکار فایل ارسالی:** فایل اصلی ارسال شده به کاربر پس از مدت زمان مشخص (مثلاً ۱۵ ثانیه) به طور خودکار از چت کاربر حذف می‌شود.
* **پنل مدیریت ادمین جامع (با دستور `/panel`):**
    * ایجاد پست جدید.
    * مدیریت پست‌ها:
        * حذف پست با وارد کردن ID.
        * نمایش لیست پست‌ها (صفحه‌بندی شده) با امکان حذف مستقیم از لیست.
    * مدیریت کانال‌های هدف (افزودن، حذف، لیست).
    * آمار ربات: نمایش تعداد کل کاربران و کاربران مسدود.
    * مدیریت کاربران:
        * نمایش لیست کاربران با جزئیات (ID، نام، یوزرنیم، وضعیت مسدودیت) به صورت صفحه‌بندی شده.
        * بن و آنبن کردن کاربران.
    * ارسال پیام همگانی به تمام کاربران ربات.
    * مدیریت کانال‌های عضویت اجباری (افزودن، حذف، لیست).
* **بررسی عضویت اجباری:** قبل از ارسال فایل به کاربر، عضویت او در کانال‌های مشخص شده بررسی می‌شود.
* **ذخیره‌سازی داده‌ها:** استفاده از Cloudflare KV برای ذخیره اطلاعات پست‌ها، کاربران، تنظیمات و ...
* **مبتنی بر Cloudflare Workers:** سبک، سریع و با قابلیت مقیاس‌پذیری بالا.

### 🚀 راه‌اندازی و نصب

برای راه‌اندازی این ربات، مراحل زیر را دنبال کنید:

#### پیش‌نیازها

1.  **حساب کاربری Cloudflare:** برای استقرار Worker و استفاده از KV Namespace.
2.  **توکن ربات تلگرام:** از طریق صحبت با [BotFather](https://t.me/BotFather) در تلگرام یک ربات جدید بسازید و توکن API آن را دریافت کنید.
3.  **(اختیاری اما پیشنهادی) Wrangler CLI:** ابزار خط فرمان Cloudflare برای توسعه و مدیریت Workers. می‌توانید بدون آن و از طریق داشبورد Cloudflare نیز اقدام کنید.
    ```bash
    npm install -g wrangler
    ```

#### مراحل راه‌اندازی

1.  **کلون کردن پروژه (یا کپی کردن کد):**
    ```bash
    git clone [https://github.com/SezarSec/telegram-bot-channel-manager.git](https://github.com/SezarSec/telegram-bot-channel-manager.git)
    cd telegram-bot-channel-manager
    ```
    یا کد `index.js` را در پروژه ورکر خود کپی کنید.

2.  **ایجاد KV Namespace:**
    * در داشبورد Cloudflare به بخش Workers & Pages -> KV بروید.
    * یک KV Namespace جدید ایجاد کنید (مثلاً با نام `TELEGRAM_BOT_DATA`).
    * **ID** این Namespace را کپی کنید.

3.  **پیکربندی ورکر:**

    * **اگر از Wrangler استفاده می‌کنید:**
        * فایل `wrangler.toml` را مشابه نمونه زیر ایجاد یا ویرایش کنید:
            ```toml
            name = "telegram-bot-channel-manager" # نام ورکر شما
            main = "src/index.js"    # مسیر فایل اصلی کد (اگر کد در src/index.js است)
            compatibility_date = "YYYY-MM-DD" # تاریخ امروز یا جدیدتر

            # شناسه حساب Cloudflare شما
            # account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"

            kv_namespaces = [
              { binding = "BOT_KV", id = "YOUR_KV_NAMESPACE_ID" } # ID مربوط به KV Namespace ایجاد شده
            ]
            ```
        * متغیرهای محرمانه (Secrets) را با دستورات زیر تنظیم کنید:
            ```bash
            wrangler secret put BOT_TOKEN 
            # توکن ربات خود را وارد کنید

            wrangler secret put ADMIN_CHAT_ID 
            # شناسه عددی تلگرام ادمین اصلی را وارد کنید

            wrangler secret put BOT_USERNAME
            # نام کاربری ربات خود (بدون @) را وارد کنید (برای لینک‌های Deep Linking)
            ```
    * **اگر از داشبورد Cloudflare استفاده می‌کنید:**
        * یک Worker جدید ایجاد کنید یا ورکر موجود را ویرایش نمایید.
        * کد `index.js` را در ویرایشگر آنلاین کپی کنید.
        * به بخش Settings -> Variables بروید:
            * **KV Namespace Bindings:** یک binding با نام `BOT_KV` به KV Namespace ایجاد شده، اضافه کنید.
            * **Environment Variables (Secrets):** متغیرهای زیر را اضافه و **Encrypt** کنید:
                * `BOT_TOKEN`: توکن ربات شما.
                * `ADMIN_CHAT_ID`: شناسه عددی ادمین اصلی.
                * `BOT_USERNAME`: نام کاربری ربات شما (بدون `@`).
        * تاریخ سازگاری (Compatibility Date) را در بخش Settings -> Compatibility تنظیم کنید.

4.  **استقرار ورکر:**
    * با Wrangler: `wrangler deploy`
    * از طریق داشبورد: Save and Deploy

5.  **تنظیم Webhook تلگرام:**
    * URL ورکر خود را (مثلاً `https://telegram-bot-channel-manager.your-subdomain.workers.dev`) بردارید.
    * URL زیر را با مقادیر خودتان جایگزین کرده و در مرورگر اجرا کنید:
        `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>`
    * یا از مسیر `/setwebhook` که در کد تعبیه شده استفاده کنید: `https://telegram-bot-channel-manager.your-subdomain.workers.dev/setwebhook` (یک بار در مرورگر اجرا کنید).

6.  **پیکربندی اولیه ربات از طریق چت:**
    * به ربات خود در تلگرام بروید و دستور `/start` را ارسال کنید.
    * از دستور `/panel` برای دسترسی به پنل ادمین و انجام تنظیمات اولیه (مانند افزودن کانال هدف با دکمه "مدیریت کانال‌های هدف") استفاده کنید.
    * مطمئن شوید ربات شما در کانال(های) هدف و کانال(های) عضویت اجباری (در صورت استفاده) ادمین است و مجوزهای لازم (ارسال پیام، حذف پیام، ویرایش پیام) را دارد.

### 🛠️ دستورات اصلی ادمین (از طریق چت یا پنل)

* `/panel`: نمایش پنل مدیریت با دکمه‌های شیشه‌ای.
* **ایجاد پست:** از طریق دکمه در پنل یا دستور `/newpost`.
* **مدیریت پست‌ها:**
    * حذف پست با ID: از طریق دکمه در پنل یا دستور `/deletepost <ID>`.
    * لیست و حذف پست‌ها: از طریق دکمه "لیست و حذف پست‌ها" در پنل.
* **مدیریت کانال‌های هدف:** از طریق دکمه "مدیریت کانال‌های هدف" در پنل یا دستورات:
    * `/addtargetchannel <ID یا یوزرنیم>`
    * `/removetargetchannel <ID یا یوزرنیم>`
    * `/listtargetchannels`
* **آمار و مدیریت کاربران:** از طریق دکمه "مدیریت کاربران" و "آمار ربات" در پنل یا دستورات:
    * `/stats`
    * `/listusers`
    * `/ban <ID کاربر>`
    * `/unban <ID کاربر>`
* **پیام همگانی:** از طریق دکمه در پنل یا دستور `/broadcast <متن پیام>`.
* **مدیریت عضویت اجباری:** از طریق دکمه "مدیریت عضویت اجباری" در پنل یا دستورات:
    * `/addjoinchannel <ID یا یوزرنیم>`
    * `/removejoinchannel <ID یا یوزرنیم>`
    * `/listjoinchannels`
* **مدیریت ادمین‌ها (فقط ادمین اصلی):**
    * `/addadmin <ID کاربر>`
    * `/removeadmin <ID کاربر>`
    * `/listadmins`

### ⚙️ متغیرهای محیطی (Secrets) مورد نیاز

* `BOT_TOKEN`: توکن API ربات تلگرام شما.
* `ADMIN_CHAT_ID`: شناسه عددی تلگرام ادمین اصلی ربات.
* `BOT_USERNAME`: نام کاربری ربات شما (بدون علامت `@`، برای ساخت لینک‌های Deep Linking).
* `(اختیاری) config:channel_username_display`: نام کاربری کانالی که می‌خواهید در انتهای پست‌ها نمایش داده شود (مثلاً `@MyPublicChannel`). اگر تنظیم نشود، از یک مقدار پیش‌فرض در کد استفاده می‌شود یا می‌توانید آن را حذف کنید.

### 🤝 مشارکت

از مشارکت شما در بهبود این پروژه استقبال می‌شود! لطفاً برای ارسال تغییرات، Pull Request ایجاد کنید یا Issues را برای گزارش باگ‌ها و پیشنهادات باز نمایید.

### 📞 ارتباط با ما

* **کانال تلگرام:** [https://t.me/sezar_Sec](https://t.me/sezar_Sec)
* **ربات پشتیبانی:** [https://t.me/SezarSupport_bot](https://t.me/SezarSupport_bot)

### 📜 مجوز (License)

این پروژه تحت مجوز [MIT License] منتشر شده است. 

---

