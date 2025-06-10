// src/index.js

const ADMIN_HELP_MESSAGE = `
سلام ادمین گرامی! به پنل مدیریت ربات خوش آمدید.

می‌توانید از دستورات زیر یا دکمه‌های پنل ادمین (/panel) استفاده کنید:

/newpost - شروع فرآیند ایجاد پست جدید
/deletepost <ID پست> - حذف یک پست
/panel - نمایش پنل مدیریت

کانال‌های هدف:
/addtargetchannel <ID یا یوزرنیم کانال> - افزودن کانال هدف
/removetargetchannel <ID یا یوزرنیم کانال> - حذف کانال هدف
/listtargetchannels - نمایش لیست کانال‌های هدف

ادمین‌ها:
/addadmin <ID کاربر> - افزودن ادمین جدید (فقط توسط ادمین اصلی)
/removeadmin <ID کاربر> - حذف ادمین (فقط توسط ادمین اصلی)
/listadmins - نمایش لیست ادمین‌ها

آمار و مدیریت کاربران:
/stats - نمایش آمار ربات
/listusers - نمایش لیست کاربران
/ban <ID کاربر> - مسدود کردن کاربر
/unban <ID کاربر> - رفع مسدودیت کاربر

پیام همگانی:
/broadcast <متن پیام> - ارسال پیام به همه کاربران

عضویت اجباری:
/addjoinchannel <ID یا یوزرنیم کانال> - افزودن کانال عضویت اجباری
/removejoinchannel <ID یا یوزرنیم کانال> - حذف کانال عضویت اجباری
/listjoinchannels - نمایش لیست کانال‌های عضویت اجباری
`;

const USER_WELCOME_MESSAGE = `
سلام! به ربات ما خوش آمدید.
برای دریافت فایل‌ها، کافی است روی دکمه "دریافت فایل" زیر پست‌های موجود در کانال کلیک کنید.
`;

const FORCED_JOIN_MESSAGE = "کاربر گرامی، برای دریافت فایل ابتدا باید در کانال(های) زیر عضو شوید:\n";
const POSTS_PER_PAGE = 5; 
const USERS_PER_PAGE = 10; 
const ANTI_SPAM_COOLDOWN_SECONDS = 20;
const FILE_DELETION_DELAY_SECONDS = 15; 

// Helper to escape MarkdownV2 special characters
const escapeMarkdown = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
};

// --- Jalali / Gregorian Date Conversion ---
function toGregorian(jy, jm, jd) {
  const G_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const J_DAYS_IN_MONTH = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

  let gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  let jy_day_no = 365 * jy + parseInt(jy / 33) * 8 + parseInt((jy % 33 + 3) / 4);
  for (var i = 0; i < jm - 1; ++i) jy_day_no += J_DAYS_IN_MONTH[i];
  jy_day_no += jd;
  let g_day_no = jy_day_no + 79;
  let gy_ = 1600 + 400 * parseInt(g_day_no / 146097);
  g_day_no %= 146097;
  let leap = true;
  if (g_day_no >= 36525) {
    g_day_no--;
    gy_ += 100 * parseInt(g_day_no / 36524);
    g_day_no %= 36524;
    if (g_day_no >= 365) g_day_no++;
    else leap = false;
  }
  gy_ += 4 * parseInt(g_day_no / 1461);
  g_day_no %= 1461;
  if (g_day_no >= 366) {
    leap = false;
    g_day_no--;
    gy_ += parseInt(g_day_no / 365);
    g_day_no %= 365;
  }
  for (var i = 0; g_day_no >= G_DAYS_IN_MONTH[i] + ((i === 1 && leap) ? 1 : 0); i++) g_day_no -= G_DAYS_IN_MONTH[i] + ((i === 1 && leap) ? 1 : 0);
  let gm = i + 1;
  let gd = g_day_no + 1;
  return {gy: gy_, gm: gm, gd: gd};
}


export default {
  // fetch handler for user interactions
  async fetch(request, env, ctx) {
    if (request.method === "POST") {
      try {
        const update = await request.json();
        ctx.waitUntil(handleUpdate(update, env, ctx)); 
      } catch (e) {
        console.error("Error processing update in fetch:", e.message, e.stack);
      }
      return new Response("OK", { status: 200 });
    } else if (request.method === "GET") {
      const url = new URL(request.url);
      if (url.pathname === "/setwebhook") {
        if (!env.BOT_TOKEN) {
            return new Response("BOT_TOKEN not configured.", { status: 500 });
        }
        const webhookUrl = `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=${url.origin}`;
        const response = await fetch(webhookUrl);
        const result = await response.json();
        return new Response(`Webhook Set: ${JSON.stringify(result)}`);
      }
      return new Response("Hello from Telegram Bot Worker! Bot is active. Use POST for Telegram updates.", { status: 200 });
    }
    return new Response("Method not allowed", { status: 405 });
  },
};

async function handleUpdate(update, env, ctx) { 
  console.log("Received update snippet:", JSON.stringify(update, null, 2).substring(0, 500));
  if (update.message) {
    await handleMessage(update.message, env, ctx); 
  } else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, env, ctx); 
  }
}

async function handleMessage(message, env, ctx) { 
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text ? message.text.trim() : "";

  console.log(`[handleMessage] From: ${userId}, Chat: ${chatId}, Text: "${text}"`);

  const userProfileKey = `user_profile:${userId}`;
  let userProfile = await env.BOT_KV.get(userProfileKey, { type: "json" });
  if (!userProfile) {
      console.log(`[handleMessage] User profile for ${userId} not found. Creating.`);
      userProfile = {
          id: userId,
          username: message.from.username || "",
          first_name: message.from.first_name || "",
          last_name: message.from.last_name || "",
          first_seen: new Date().toISOString(),
          is_banned: false 
      };
      ctx.waitUntil(env.BOT_KV.put(userProfileKey, JSON.stringify(userProfile)));
      console.log(`[handleMessage] New user profile for ${userId} creation queued.`);

      let usersIdList = await env.BOT_KV.get("bot_master_user_ids", { type: "json" }) || [];
      if (!usersIdList.includes(userId)) {
          usersIdList.push(userId);
          ctx.waitUntil(env.BOT_KV.put("bot_master_user_ids", JSON.stringify(usersIdList)));
          console.log(`[handleMessage] User ${userId} addition to bot_master_user_ids queued.`);
      }
  } else { 
      let profileChanged = false;
      if (userProfile.username !== (message.from.username || "")) { userProfile.username = message.from.username || ""; profileChanged = true; }
      if (userProfile.first_name !== (message.from.first_name || "")) { userProfile.first_name = message.from.first_name || ""; profileChanged = true; }
      if (userProfile.last_name !== (message.from.last_name || "")) { userProfile.last_name = message.from.last_name || ""; profileChanged = true; }
      if (profileChanged) {
          ctx.waitUntil(env.BOT_KV.put(userProfileKey, JSON.stringify(userProfile)));
          console.log(`[handleMessage] User profile update for ${userId} queued.`);
      }
  }

  if (text.startsWith("/")) {
    const commandPart = text.split(" ")[0]; 
    const command = commandPart.split("@")[0]; 
    const payload = text.substring(commandPart.length).trim();
    const userIsAdmin = await isAdmin(userId, env);
    console.log(`[handleMessage] Command: ${command}, Payload: "${payload}", IsAdmin: ${userIsAdmin}`);

    if (command === "/start") {
      if (userIsAdmin) { await sendMessage(env.BOT_TOKEN, chatId, ADMIN_HELP_MESSAGE); }
      else { await sendMessage(env.BOT_TOKEN, chatId, USER_WELCOME_MESSAGE); }
      if (payload && payload.startsWith("post_")) {
        const postId = payload.substring("post_".length);
        console.log(`[handleMessage] Processing /start with post payload: ${postId}`);
        await processPostDownload(postId, userId, null, env, chatId, true, null, ctx); 
      }
      return;
    }
    if (command === "/help") {
        if (userIsAdmin) { await sendMessage(env.BOT_TOKEN, chatId, ADMIN_HELP_MESSAGE); }
        else { await sendMessage(env.BOT_TOKEN, chatId, USER_WELCOME_MESSAGE); }
        return;
    }

    if (command === "/panel") {
      if (userIsAdmin) { await sendAdminPanel(chatId, env); }
      else { await sendMessage(env.BOT_TOKEN, chatId, "شما اجازه دسترسی به این بخش را ندارید."); }
      return;
    }

    if (userIsAdmin) {
        if (command === "/newpost") { await startNewPostProcess(chatId, env); return; }
        if (command === "/deletepost") {
            if (!payload) { await sendMessage(env.BOT_TOKEN, chatId, "لطفا ID پستی که میخواهید حذف کنید را بعد از دستور وارد کنید: /deletepost <post_id>"); return; }
            await confirmPostDeletion(chatId, payload, env);
            return;
        }
        if (command === "/addtargetchannel") { await handleAddTargetChannelCommand(chatId, payload, env); return; }
        if (command === "/removetargetchannel") { await handleRemoveTargetChannelCommand(chatId, payload, env); return; }
        if (command === "/listtargetchannels") { await handleListTargetChannelsCommand(chatId, env); return; }
        if (command === "/setchannel") { await handleAddTargetChannelCommand(chatId, payload, env); return; } 
        if (command === "/getchannel") { await handleListTargetChannelsCommand(chatId, env); return; } 


        if (command === "/addadmin") { await handleAddAdminCommand(chatId, payload, userId, env); return; }
        if (command === "/removeadmin") { await handleRemoveAdminCommand(chatId, payload, userId, env); return; }
        if (command === "/listadmins") { await handleListAdminsCommand(chatId, env); return; }
        if (command === "/stats") { await handleStatsCommand(chatId, env, ctx); return; }
        if (command === "/listusers") { await sendUserList(chatId, env, 0, null, null); return;} 
        if (command === "/ban") { await handleBanUserCommand(chatId, payload, env, ctx); return; } 
        if (command === "/unban") { await handleUnbanUserCommand(chatId, payload, env, ctx); return; } 
        if (command === "/broadcast") { 
            if (!payload) { await sendMessage(env.BOT_TOKEN, chatId, "لطفا متن پیام همگانی را بعد از دستور وارد کنید."); return; }
            await handleBroadcastCommand(chatId, payload, env, ctx); return;  
        }
        if (command === "/addjoinchannel") { await handleAddJoinChannelCommand(chatId, payload, env); return; }
        if (command === "/removejoinchannel") { await handleRemoveJoinChannelCommand(chatId, payload, env); return; }
        if (command === "/listjoinchannels") { await handleListJoinChannelsCommand(chatId, env); return; }

    } else if (text.startsWith("/")) { 
        await sendMessage(env.BOT_TOKEN, chatId, "شما اجازه اجرای این دستور را ندارید.");
        return;
    }
  }

  const userState = await getUserState(userId, env);
  if (userState) {
    console.log(`[handleMessage] User ${userId} has state: ${JSON.stringify(userState)}`);
    if (userState.action === "new_post") { await handleNewPostFlow(message, userState, env); }
    else if (userState.action === "awaiting_schedule_date") { await processScheduleDateInput(message, userId, env); }
    else if (userState.action === "awaiting_schedule_time") { await processScheduleTimeInput(message, userId, env); }
    else if (userState.action === "awaiting_target_channel_add") { await processAddTargetChannelInput(message, userId, env); }
    else if (userState.action === "awaiting_target_channel_remove") { await processRemoveTargetChannelInput(message, userId, env); }
    else if (userState.action === "awaiting_user_id_to_ban") { await processBanUserInput(message, userId, env, ctx); } 
    else if (userState.action === "awaiting_user_id_to_unban") { await processUnbanUserInput(message, userId, env, ctx); } 
    else if (userState.action === "awaiting_broadcast_message") { await processBroadcastMessageInput(message, userId, env, ctx); } 
    else if (userState.action === "awaiting_forced_channel_add") { await processAddForcedChannelInput(message, userId, env); }
    else if (userState.action === "awaiting_forced_channel_remove") { await processRemoveForcedChannelInput(message, userId, env); }
    else if (userState.action === "awaiting_post_id_to_delete_by_id") { await processDirectDeletePostInput(message, userId, env); } 
  }
}

// --- Command Handler Functions for Admin ---
async function handleAddTargetChannelCommand(chatId, payload, env) {
    if (!payload) { await sendMessage(env.BOT_TOKEN, chatId, "فرمت: /addtargetchannel <ID یا یوزرنیم کانال>"); return; }
    if (!payload.startsWith("@") && !payload.startsWith("-100")) { await sendMessage(env.BOT_TOKEN, chatId, "فرمت شناسه کانال نامعتبر است."); return; }
    let targetChannels = await env.BOT_KV.get("config:target_channels", { type: "json" }) || [];
    if (!targetChannels.includes(payload)) {
        targetChannels.push(payload);
        await env.BOT_KV.put("config:target_channels", JSON.stringify(targetChannels));
        await sendMessage(env.BOT_TOKEN, chatId, `کانال ${payload} به لیست کانال‌های هدف اضافه شد.`);
    } else {
        await sendMessage(env.BOT_TOKEN, chatId, `کانال ${payload} قبلاً در لیست کانال‌های هدف بود.`);
    }
}
async function handleRemoveTargetChannelCommand(chatId, payload, env) {
    if (!payload) { await sendMessage(env.BOT_TOKEN, chatId, "فرمت: /removetargetchannel <ID یا یوزرنیم کانال>"); return; }
    let targetChannels = await env.BOT_KV.get("config:target_channels", { type: "json" }) || [];
    const initialLength = targetChannels.length;
    targetChannels = targetChannels.filter(ch => ch !== payload);
    if (targetChannels.length < initialLength) {
        await env.BOT_KV.put("config:target_channels", JSON.stringify(targetChannels));
        await sendMessage(env.BOT_TOKEN, chatId, `کانال ${payload} از لیست کانال‌های هدف حذف شد.`);
    } else {
        await sendMessage(env.BOT_TOKEN, chatId, `کانال ${payload} در لیست کانال‌های هدف نبود.`);
    }
}
async function handleListTargetChannelsCommand(chatId, env) {
    const targetChannels = await env.BOT_KV.get("config:target_channels", { type: "json" }) || [];
    await sendMessage(env.BOT_TOKEN, chatId, `کانال‌های هدف فعلی:\n${targetChannels.length > 0 ? targetChannels.join("\n") : "(هیچ کانال هدفی تنظیم نشده است)"}`);
}

async function handleAddAdminCommand(chatId, payload, currentAdminId, env) {
    if (currentAdminId.toString() !== env.ADMIN_CHAT_ID) { await sendMessage(env.BOT_TOKEN, chatId, "فقط ادمین اصلی مجاز است."); return; }
    const targetUserId = parseInt(payload);
    if (!targetUserId) { await sendMessage(env.BOT_TOKEN, chatId, "فرمت: /addadmin <ID کاربر>"); return; }
    let admins = await env.BOT_KV.get("config:admins", { type: "json" }) || [];
    if (!admins.includes(targetUserId)) { admins.push(targetUserId); await env.BOT_KV.put("config:admins", JSON.stringify(admins)); }
    await sendMessage(env.BOT_TOKEN, chatId, admins.includes(targetUserId) ? `کاربر ${targetUserId} به ادمین‌ها اضافه شد.` : `کاربر ${targetUserId} قبلاً ادمین بوده.`);
}
async function handleRemoveAdminCommand(chatId, payload, currentAdminId, env) {
    if (currentAdminId.toString() !== env.ADMIN_CHAT_ID) { await sendMessage(env.BOT_TOKEN, chatId, "فقط ادمین اصلی مجاز است."); return; }
    const targetUserId = parseInt(payload);
    if (!targetUserId) { await sendMessage(env.BOT_TOKEN, chatId, "فرمت: /removeadmin <ID کاربر>"); return; }
    let admins = await env.BOT_KV.get("config:admins", { type: "json" }) || [];
    const initialLength = admins.length;
    admins = admins.filter(id => id !== targetUserId);
    if (admins.length < initialLength) { await env.BOT_KV.put("config:admins", JSON.stringify(admins)); }
    await sendMessage(env.BOT_TOKEN, chatId, admins.length < initialLength ? `کاربر ${targetUserId} از ادمین‌ها حذف شد.` : `کاربر ${targetUserId} ادمین نبود.`);
}
async function handleListAdminsCommand(chatId, env) {
    const mainAdmin = env.ADMIN_CHAT_ID;
    let admins = await env.BOT_KV.get("config:admins", { type: "json" }) || [];
    let adminListText = `ادمین اصلی: ${mainAdmin}\nسایر ادمین‌ها:\n${admins.length > 0 ? admins.map(id => `- ${id}`).join("\n") : "(موردی یافت نشد)"}`;
    await sendMessage(env.BOT_TOKEN, chatId, adminListText);
}
async function handleStatsCommand(chatId, env, ctx) {
    const users = await env.BOT_KV.get("bot_master_user_ids", { type: "json" }) || []; 
    
    let bannedCount = 0;
    if (users.length > 0) { 
        for (const userId of users) { 
            const userProfile = await env.BOT_KV.get(`user_profile:${userId}`, {type: "json"});
            if (userProfile && userProfile.is_banned) {
                bannedCount++;
            }
        }
    }
    await sendMessage(env.BOT_TOKEN, chatId, `📊 آمار ربات:\nتعداد کل کاربران: ${users.length}\nتعداد کاربران مسدود: ${bannedCount}`);
}
async function handleBanUserCommand(chatId, payload, env, ctx) { 
    const targetUserId = parseInt(payload);
    if (!targetUserId) { await sendMessage(env.BOT_TOKEN, chatId, "فرمت: /ban <ID کاربر>"); return; }
    const userProfileKey = `user_profile:${targetUserId}`;
    let userProfile = await env.BOT_KV.get(userProfileKey, { type: "json" });
    if (userProfile) {
        if (userProfile.is_banned) {
            await sendMessage(env.BOT_TOKEN, chatId, `کاربر ${targetUserId} قبلاً مسدود شده بود.`);
        } else {
            userProfile.is_banned = true;
            ctx.waitUntil(env.BOT_KV.put(userProfileKey, JSON.stringify(userProfile)));
            await sendMessage(env.BOT_TOKEN, chatId, `کاربر ${targetUserId} مسدود شد.`);
        }
    } else {
         ctx.waitUntil(env.BOT_KV.put(userProfileKey, JSON.stringify({ id: targetUserId, is_banned: true, first_name: "N/A (Banned)", username:"", last_name:"", first_seen: new Date().toISOString() })));
         await sendMessage(env.BOT_TOKEN, chatId, `کاربر ${targetUserId} (بدون پروفایل قبلی) مسدود شد.`);
    }
}
async function handleUnbanUserCommand(chatId, payload, env, ctx) { 
    const targetUserId = parseInt(payload);
    if (!targetUserId) { await sendMessage(env.BOT_TOKEN, chatId, "فرمت: /unban <ID کاربر>"); return; }
    const userProfileKey = `user_profile:${targetUserId}`;
    let userProfile = await env.BOT_KV.get(userProfileKey, { type: "json" });
    if (userProfile) {
        if (!userProfile.is_banned) {
            await sendMessage(env.BOT_TOKEN, chatId, `کاربر ${targetUserId} مسدود نبود.`);
        } else {
            userProfile.is_banned = false;
            ctx.waitUntil(env.BOT_KV.put(userProfileKey, JSON.stringify(userProfile)));
            await sendMessage(env.BOT_TOKEN, chatId, `کاربر ${targetUserId} رفع مسدودیت شد.`);
        }
    } else {
        await sendMessage(env.BOT_TOKEN, chatId, `کاربر ${targetUserId} یافت نشد یا پروفایلی برای رفع مسدودیت ندارد.`);
    }
}
async function handleBroadcastCommand(adminChatId, messageText, env, ctx) { 
    await sendMessage(env.BOT_TOKEN, adminChatId, "⏳ در حال شروع ارسال پیام همگانی...");
    const userIds = await env.BOT_KV.get("bot_master_user_ids", { type: "json" }) || []; 
    
    const broadcastTask = async () => {
        let successCount = 0; 
        let failCount = 0;
        for (const userId of userIds) {
            try {
                const userProfile = await env.BOT_KV.get(`user_profile:${userId}`, {type: "json"});
                if (userProfile && userProfile.is_banned) {
                    console.log(`[Broadcast] Skipping banned user ${userId}`);
                    continue; 
                }
                await sendMessage(env.BOT_TOKEN, userId, messageText);
                successCount++;
            } catch (e) {
                console.error(`[Broadcast] Failed to send to ${userId}:`, e.message);
                failCount++;
            }
            await new Promise(resolve => setTimeout(resolve, 50)); 
        }
        await sendMessage(env.BOT_TOKEN, adminChatId, `📣 ارسال پیام همگانی تکمیل شد.\n✅ موفق: ${successCount}\n❌ ناموفق: ${failCount} (از ${userIds.length} کاربر)`);
    };
    
    if(ctx && ctx.waitUntil) {
      ctx.waitUntil(broadcastTask());
      await sendMessage(env.BOT_TOKEN, adminChatId, `پیام همگانی برای ${userIds.length} کاربر در پس‌زمینه شروع به ارسال شد. نتیجه نهایی پس از تکمیل اعلام خواهد شد.`);
    } else {
      console.warn("[Broadcast] ctx.waitUntil not available. Broadcast will run synchronously.");
      await broadcastTask(); 
    }
}
async function handleAddJoinChannelCommand(chatId, payload, env) {
    if (!payload) { await sendMessage(env.BOT_TOKEN, chatId, "فرمت: /addjoinchannel <ID یا یوزرنیم کانال>"); return; }
    if (!payload.startsWith("@") && !payload.startsWith("-100")) { await sendMessage(env.BOT_TOKEN, chatId, "فرمت شناسه کانال نامعتبر است."); return; }
    let joinChannels = await env.BOT_KV.get("config:forced_join_channels", { type: "json" }) || [];
    if (!joinChannels.includes(payload)) { joinChannels.push(payload); await env.BOT_KV.put("config:forced_join_channels", JSON.stringify(joinChannels)); }
    await sendMessage(env.BOT_TOKEN, chatId, joinChannels.includes(payload) ? `کانال ${payload} به لیست عضویت اجباری اضافه شد.` : `کانال ${payload} قبلاً در لیست بود.`);
}
async function handleRemoveJoinChannelCommand(chatId, payload, env) {
    if (!payload) { await sendMessage(env.BOT_TOKEN, chatId, "فرمت: /removejoinchannel <ID یا یوزرنیم کانال>"); return; }
    let joinChannels = await env.BOT_KV.get("config:forced_join_channels", { type: "json" }) || [];
    const initialLength = joinChannels.length;
    joinChannels = joinChannels.filter(ch => ch !== payload);
    if (joinChannels.length < initialLength) { await env.BOT_KV.put("config:forced_join_channels", JSON.stringify(joinChannels)); }
    await sendMessage(env.BOT_TOKEN, chatId, joinChannels.length < initialLength ? `کانال ${payload} از لیست عضویت اجباری حذف شد.` : `کانال ${payload} در لیست نبود.`);
}
async function handleListJoinChannelsCommand(chatId, env) {
    let joinChannels = await env.BOT_KV.get("config:forced_join_channels", { type: "json" }) || [];
    await sendMessage(env.BOT_TOKEN, chatId, `کانال‌های عضویت اجباری:\n${joinChannels.length > 0 ? joinChannels.join("\n") : "(موردی تنظیم نشده است)"}`);
}

async function confirmPostDeletion(adminChatId, postId, env) {
    const postKey = `posts:${postId}`;
    const postJson = await env.BOT_KV.get(postKey);
    if (!postJson) {
        await sendMessage(env.BOT_TOKEN, adminChatId, `پستی با کد ${postId} یافت نشد.`);
        return;
    }
    const post = JSON.parse(postJson);
    const confirmationKeyboard = {
        inline_keyboard: [
            [
                { text: "🗑️ بله، حذف کن", callback_data: `admin_confirm_delete_post:${postId}` },
                { text: "❌ خیر، لغو", callback_data: `admin_cancel_delete_post:${postId}` }
            ]
        ]
    };
    await sendMessage(env.BOT_TOKEN, adminChatId, `⚠️ آیا از حذف پست با کد ${postId} و عنوان "${post.title ? post.title.substring(0, 50) + "..." : 'بدون عنوان'}" مطمئن هستید؟\nاین عملیات پست را از کانال (در صورت امکان) و دیتابیس ربات حذف می‌کند و غیرقابل بازگشت است.`, confirmationKeyboard);
}

async function deletePost(adminChatId, postId, env) {
    const postKey = `posts:${postId}`;
    const postJson = await env.BOT_KV.get(postKey);
    if (!postJson) {
        await sendMessage(env.BOT_TOKEN, adminChatId, `پستی با کد ${postId} برای حذف یافت نشد (ممکن است قبلا حذف شده باشد).`);
        return false;
    }
    const post = JSON.parse(postJson);

    let anyChannelMessageDeleted = false;
    if (post.sent_to_channels && Array.isArray(post.sent_to_channels)) {
        for (const sentInfo of post.sent_to_channels) {
            if (sentInfo.channel_id && sentInfo.message_id) {
                try {
                    const deleteResult = await apiRequest(env.BOT_TOKEN, "deleteMessage", {
                        chat_id: sentInfo.channel_id,
                        message_id: sentInfo.message_id
                    });
                    if (deleteResult.ok) {
                        anyChannelMessageDeleted = true; 
                        console.log(`Post message ${sentInfo.message_id} in channel ${sentInfo.channel_id} deleted successfully.`);
                    } else {
                        console.error(`Failed to delete message ${sentInfo.message_id} from channel ${sentInfo.channel_id}: ${deleteResult.description}`);
                    }
                } catch (e) {
                    console.error(`Exception deleting message from channel ${sentInfo.channel_id} for post ${postId}:`, e);
                }
            }
        }
    }


    await env.BOT_KV.delete(postKey);
    
    let feedbackMsg = `پست با کد ${postId} از دیتابیس ربات حذف شد.`;
    if (post.sent_to_channels && post.sent_to_channels.length > 0) { 
        if (anyChannelMessageDeleted) {
            feedbackMsg += " پیام(های) مربوطه نیز از کانال(ها) حذف شد(ند).";
        } else {
            feedbackMsg += " (توجه: حذف پیام از کانال(ها) ناموفق بود یا اطلاعات لازم برای حذف پیام کانال موجود نبود).";
        }
    }
    await sendMessage(env.BOT_TOKEN, adminChatId, feedbackMsg);
    return true;
}


// --- Input Processors for States ---
async function processAddTargetChannelInput(message, userId, env) {
    const channelId = message.text ? message.text.trim() : "";
    if (channelId === "/cancel") { await sendMessage(env.BOT_TOKEN, message.chat.id, "عملیات لغو شد."); }
    else if (channelId && (channelId.startsWith("@") || channelId.startsWith("-100"))) {
        await handleAddTargetChannelCommand(message.chat.id, channelId, env); 
    } else {
        await sendMessage(env.BOT_TOKEN, message.chat.id, "فرمت شناسه کانال نامعتبر است. یا با /cancel لغو کنید.");
    }
    await clearUserState(userId, env);
}
async function processRemoveTargetChannelInput(message, userId, env) {
    const channelId = message.text ? message.text.trim() : "";
    if (channelId === "/cancel") { await sendMessage(env.BOT_TOKEN, message.chat.id, "عملیات لغو شد."); }
    else if (channelId) {
        await handleRemoveTargetChannelCommand(message.chat.id, channelId, env); 
    } else {
         await sendMessage(env.BOT_TOKEN, message.chat.id, "شناسه کانال نامعتبر است. یا با /cancel لغو کنید.");
    }
    await clearUserState(userId, env);
}

async function processSetChannelInput(message, userId, env) { /* Deprecated */ }
async function processBanUserInput(message, userId, env, ctx) { 
    const targetUserIdToBan = parseInt(message.text ? message.text.trim() : "");
    if (message.text === "/cancel") { await sendMessage(env.BOT_TOKEN, message.chat.id, "عملیات لغو شد.");}
    else if (targetUserIdToBan) {
        const userProfileKey = `user_profile:${targetUserIdToBan}`;
        let userProfile = await env.BOT_KV.get(userProfileKey, { type: "json" });
        if (userProfile) {
            userProfile.is_banned = true;
            ctx.waitUntil(env.BOT_KV.put(userProfileKey, JSON.stringify(userProfile)));
            await sendMessage(env.BOT_TOKEN, message.chat.id, `کاربر ${targetUserIdToBan} مسدود شد.`);
        } else {
            ctx.waitUntil(env.BOT_KV.put(userProfileKey, JSON.stringify({ id: targetUserIdToBan, is_banned: true, first_name: "N/A (Banned)", username:"", last_name:"", first_seen: new Date().toISOString() })));
            await sendMessage(env.BOT_TOKEN, message.chat.id, `کاربر ${targetUserIdToBan} (بدون پروفایل قبلی) مسدود شد.`);
        }
    } else {
        await sendMessage(env.BOT_TOKEN, message.chat.id, "شناسه کاربر نامعتبر است. لطفا یک ID عددی وارد کنید یا با /cancel لغو کنید.");
    }
    await clearUserState(userId, env); 
}
async function processUnbanUserInput(message, userId, env, ctx) { 
    const targetUserIdToUnban = parseInt(message.text ? message.text.trim() : "");
    if (message.text === "/cancel") { await sendMessage(env.BOT_TOKEN, message.chat.id, "عملیات لغو شد.");}
    else if (targetUserIdToUnban) {
        const userProfileKey = `user_profile:${targetUserIdToUnban}`;
        let userProfile = await env.BOT_KV.get(userProfileKey, { type: "json" });
        if (userProfile) {
            userProfile.is_banned = false;
            ctx.waitUntil(env.BOT_KV.put(userProfileKey, JSON.stringify(userProfile)));
            await sendMessage(env.BOT_TOKEN, message.chat.id, `کاربر ${targetUserIdToUnban} رفع مسدودیت شد.`);
        } else {
            await sendMessage(env.BOT_TOKEN, message.chat.id, `کاربر ${targetUserIdToUnban} یافت نشد یا پروفایلی برای رفع مسدودیت ندارد.`);
        }
    } else {
        await sendMessage(env.BOT_TOKEN, message.chat.id, "شناسه کاربر نامعتبر است. یا با /cancel لغو کنید.");
    }
    await clearUserState(userId, env); 
}
async function processBroadcastMessageInput(message, userId, env, ctx) { 
    const broadcastText = message.text ? message.text.trim() : "";
    if (broadcastText === "/cancel") { await sendMessage(env.BOT_TOKEN, message.chat.id, "ارسال پیام همگانی لغو شد."); }
    else if (broadcastText) {
        await handleBroadcastCommand(message.chat.id, broadcastText, env, ctx); 
    } else {
        await sendMessage(env.BOT_TOKEN, message.chat.id, "متن پیام خالی است. ارسال لغو شد.");
    }
    await clearUserState(userId, env); 
}
async function processAddForcedChannelInput(message, userId, env) {
    const channelId = message.text ? message.text.trim() : "";
    if (channelId === "/cancel") { await sendMessage(env.BOT_TOKEN, message.chat.id, "عملیات لغو شد."); }
    else if (channelId && (channelId.startsWith("@") || channelId.startsWith("-100"))) {
        let joinChannels = await env.BOT_KV.get("config:forced_join_channels", { type: "json" }) || [];
        if (!joinChannels.includes(channelId)) { joinChannels.push(channelId); await env.BOT_KV.put("config:forced_join_channels", JSON.stringify(joinChannels)); }
        await sendMessage(env.BOT_TOKEN, message.chat.id, `کانال ${channelId} به لیست عضویت اجباری اضافه شد.`);
    } else {
        await sendMessage(env.BOT_TOKEN, message.chat.id, "فرمت شناسه کانال نامعتبر است. یا با /cancel لغو کنید.");
    }
    await clearUserState(userId, env);
}
async function processRemoveForcedChannelInput(message, userId, env) {
    const channelId = message.text ? message.text.trim() : "";
     if (channelId === "/cancel") { await sendMessage(env.BOT_TOKEN, message.chat.id, "عملیات لغو شد."); }
    else if (channelId) {
        let joinChannels = await env.BOT_KV.get("config:forced_join_channels", { type: "json" }) || [];
        joinChannels = joinChannels.filter(ch => ch !== channelId);
        await env.BOT_KV.put("config:forced_join_channels", JSON.stringify(joinChannels));
        await sendMessage(env.BOT_TOKEN, message.chat.id, `کانال ${channelId} از لیست عضویت اجباری حذف شد (اگر وجود داشت).`);
    } else {
         await sendMessage(env.BOT_TOKEN, message.chat.id, "شناسه کانال نامعتبر است. یا با /cancel لغو کنید.");
    }
    await clearUserState(userId, env);
}
async function processDirectDeletePostInput(message, adminId, env) { 
    const postId = message.text ? message.text.trim() : "";
    if (postId === "/cancel") {
        await sendMessage(env.BOT_TOKEN, adminId, "عملیات حذف پست لغو شد.");
        await clearUserState(adminId, env);
        return;
    }
    if (!/^\d+$/.test(postId)) { 
        await sendMessage(env.BOT_TOKEN, adminId, "کد پست نامعتبر است. لطفا فقط عدد ID پست را وارد کنید یا با /cancel لغو کنید.");
        return;
    }
    await clearUserState(adminId, env); 
    await confirmPostDeletion(adminId, postId, env);
}
async function processScheduleDateInput(message, adminId, env) {
    const text = message.text ? message.text.trim() : "";
    if (text.toLowerCase() === "/cancel") {
        await sendMessage(env.BOT_TOKEN, adminId, "زمانبندی لغو شد.");
        await clearUserState(adminId, env);
        return;
    }
    const dateRegex = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
    const match = text.match(dateRegex);

    if (!match) {
        await sendMessage(env.BOT_TOKEN, adminId, "فرمت تاریخ نامعتبر است. لطفا با فرمت `YYYY/MM/DD` وارد کنید یا با /cancel لغو کنید.");
        return;
    }
    
    const [, year, month, day] = match.map(Number);
    
    const userState = await getUserState(adminId, env);
    if (!userState || userState.action !== "awaiting_schedule_date") {
        await sendMessage(env.BOT_TOKEN, adminId, "خطای داخلی. لطفا دوباره تلاش کنید.");
        await clearUserState(adminId, env);
        return;
    }
    
    userState.schedule = { year, month, day };
    userState.action = "awaiting_schedule_time";
    await setUserState(adminId, userState, env);

    const messageToSend = `تاریخ \`${text}\` دریافت شد\\.\n\nاکنون لطفا ساعت را با فرمت ۲۴ ساعته \`HH:MM\` وارد کنید \\(مثال: \`15:30\`\\) یا با /cancel لغو کنید\\.`;
    await sendMessage(env.BOT_TOKEN, adminId, messageToSend, {parse_mode: "MarkdownV2"});
}
async function processScheduleTimeInput(message, adminId, env) {
    const text = message.text ? message.text.trim() : "";
    if (text.toLowerCase() === "/cancel") {
        await sendMessage(env.BOT_TOKEN, adminId, "زمانبندی لغو شد.");
        await clearUserState(adminId, env);
        return;
    }
    const timeRegex = /^(\d{1,2}):(\d{2})$/;
    const match = text.match(timeRegex);

    if (!match) {
        await sendMessage(env.BOT_TOKEN, adminId, "فرمت ساعت نامعتبر است. لطفا با فرمت `HH:MM` وارد کنید یا با /cancel لغو کنید.");
        return;
    }

    const userState = await getUserState(adminId, env);
    if (!userState || !userState.data || userState.action !== "awaiting_schedule_time" || !userState.schedule) {
        await sendMessage(env.BOT_TOKEN, adminId, "خطای داخلی: اطلاعات پست یا تاریخ برای زمانبندی یافت نشد. لطفا دوباره تلاش کنید.");
        await clearUserState(adminId, env);
        return;
    }
    
    const [, hour, minute] = match.map(Number);
    const { year, month, day } = userState.schedule;
    
    // Convert Jalali to Gregorian
    const gregorianDate = toGregorian(year, month, day);

    // Convert Tehran time to UTC Date object
    const tehranOffsetMinutes = (3 * 60) + 30;
    const localDate = new Date(Date.UTC(gregorianDate.gy, gregorianDate.gm - 1, gregorianDate.gd, hour, minute)); 
    const utcTime = localDate.getTime() - (tehranOffsetMinutes * 60 * 1000);

    if (isNaN(utcTime) || utcTime <= Date.now()) {
        await sendMessage(env.BOT_TOKEN, adminId, "تاریخ یا ساعت وارد شده نامعتبر یا در گذشته است. لطفا یک زمان در آینده وارد کنید.");
        return;
    }
    
    const scheduleTimestamp = Math.floor(utcTime / 1000); // Telegram needs Unix timestamp in seconds
    await publishPost(userState.data, env, adminId, scheduleTimestamp);
    await clearUserState(adminId, env);
}



async function startNewPostProcess(chatId, env) {
    const targetChannels = await env.BOT_KV.get("config:target_channels", { type: "json" }) || [];
    if (targetChannels.length === 0) {
    await sendMessage(env.BOT_TOKEN, chatId, "ابتدا باید حداقل یک کانال هدف را از طریق پنل تنظیم کنید.");
    return;
    }
    await clearUserState(chatId, env); 
    await setUserState(chatId, { action: "new_post", step: "awaiting_title", data: {} }, env);
    await sendMessage(env.BOT_TOKEN, chatId, "لطفا تیتر پست را ارسال کنید:");
}
async function handleNewPostFlow(message, userState, env) {
  const chatId = message.chat.id; 
  const userId = message.from.id; 
  const text = message.text ? message.text.trim() : "";
  let postData = userState.data || {};

  switch (userState.step) {
    case "awaiting_title":
      if (!text) { await sendMessage(env.BOT_TOKEN, chatId, "تیتر نمی‌تواند خالی باشد."); return; }
      postData.title = text;
      userState.step = "awaiting_description";
      await setUserState(userId, userState, env);
      await sendMessage(env.BOT_TOKEN, chatId, "تیتر دریافت شد. لطفا توضیحات پست را ارسال کنید:");
      break;
    case "awaiting_description":
      if (!text) { await sendMessage(env.BOT_TOKEN, chatId, "توضیحات نمی‌تواند خالی باشد."); return; }
      postData.description = text;
      userState.step = "awaiting_image";
      await setUserState(userId, userState, env);
      await sendMessage(env.BOT_TOKEN, chatId, "توضیحات دریافت شد. لطفا تصویر پست را ارسال کنید یا 'skip' بفرستید.");
      break;
    case "awaiting_image":
      if (message.photo && message.photo.length > 0) {
        postData.image_file_id = message.photo[message.photo.length - 1].file_id;
      } else if (text.toLowerCase() === "skip") {
        postData.image_file_id = null;
      } else { await sendMessage(env.BOT_TOKEN, chatId, "لطفا تصویر معتبر یا 'skip' ارسال کنید."); return; }
      userState.step = "awaiting_limit";
      await setUserState(userId, userState, env);
      await sendMessage(env.BOT_TOKEN, chatId, "تصویر دریافت شد. لطفا محدودیت دانلود را (0 برای نامحدود) وارد کنید:");
      break;
    case "awaiting_limit":
      const limit = parseInt(text);
      if (isNaN(limit) || limit < 0) { await sendMessage(env.BOT_TOKEN, chatId, "محدودیت نامعتبر. لطفا عدد صحیح بزرگتر یا مساوی صفر وارد کنید."); return; }
      postData.limit = limit;
      userState.step = "awaiting_content_file";
      await setUserState(userId, userState, env);
      await sendMessage(env.BOT_TOKEN, chatId, "محدودیت دریافت شد. لطفا فایل اصلی محتوا (یا متن پیام) را ارسال کنید:");
      break;
    case "awaiting_content_file":
      let fileId = null; let fileType = null; let contentText = null;
      if (message.document) { fileId = message.document.file_id; fileType = "document"; }
      else if (message.photo && message.photo.length > 0) { fileId = message.photo[message.photo.length - 1].file_id; fileType = "photo"; }
      else if (message.video) { fileId = message.video.file_id; fileType = "video"; }
      else if (message.audio) { fileId = message.audio.file_id; fileType = "audio"; }
      else if (message.text) { 
        fileType = "text_message";
        contentText = message.text;
      }
      if (!fileId && !contentText) { await sendMessage(env.BOT_TOKEN, chatId, "فایل یا متن معتبری دریافت نشد."); return; }
      
      postData.content_file_id = fileId; 
      postData.content_file_type = fileType;
      if (contentText) postData.content_text = contentText; 

      postData.creator_id = userId; 
      postData.download_count = 0; 
      postData.creation_date = new Date().toISOString();

      // Ask for publishing options
      const publishingOptionsKeyboard = {
          inline_keyboard: [
              [
                  { text: "✅ ارسال فوری", callback_data: "publish_now" },
                  { text: "🕒 زمانبندی ارسال", callback_data: "publish_schedule" },
                  { text: "❌ لغو", callback_data: "publish_cancel" }
              ]
          ]
      };
      userState.step = "awaiting_publish_option";
      userState.data = postData; // Make sure postData is in the state
      await setUserState(userId, userState, env);
      await sendMessage(env.BOT_TOKEN, chatId, "محتوا دریافت شد. چگونه می‌خواهید پست را منتشر کنید؟", publishingOptionsKeyboard);
      break;
    default:
      await sendMessage(env.BOT_TOKEN, chatId, "خطای داخلی. با /newpost یا از پنل شروع کنید.");
      await clearUserState(userId, env);
  }
}

async function savePostData(postData, env) {
    let postCounter = parseInt(await env.BOT_KV.get("posts:counter") || "0");
    postCounter++;
    const postId = postCounter.toString();
    await env.BOT_KV.put("posts:counter", postId);

    const finalPostData = { 
        id: postId, 
        ...postData, 
        sent_to_channels: postData.sent_to_channels || [] 
    };
    await env.BOT_KV.put(`posts:${postId}`, JSON.stringify(finalPostData));
    console.log(`Post ${postId} saved to KV.`);
    return postId;
}


async function publishPost(postData, env, adminChatId = null, schedule_date = null) {
  const targetChannels = await env.BOT_KV.get("config:target_channels", { type: "json" }) || [];
  if (targetChannels.length === 0) { 
      if (adminChatId) await sendMessage(env.BOT_TOKEN, adminChatId, "خطا: هیچ کانال هدفی تنظیم نشده است."); 
      return { success: false }; 
  }
  
  const botUsername = env.BOT_USERNAME; 
  if (!botUsername && env.NODE_ENV !== 'test') { 
      console.error("BOT_USERNAME environment variable is not set.");
      if (adminChatId) await sendMessage(env.BOT_TOKEN, adminChatId, "خطای پیکربندی: BOT_USERNAME تنظیم نشده.");
  }
  
  // Save post data first to get an ID
  const postId = await savePostData(postData, env);
  
  const channelUsernameToDisplay = await env.BOT_KV.get("config:channel_username_display") || ""; 
  
  let caption = `🔢 کد شماره: ${postId}\n🗂 ${postData.title}\n\n📌 ${postData.description}\n\n`;
  caption += `محدودیت دانلود: 0 از ${postData.limit === 0 ? 'نامحدود' : postData.limit}\n\n`; 
  if (channelUsernameToDisplay) caption += `📣 ${channelUsernameToDisplay}`;

  const downloadButtonText = `دریافت فایل (کد: ${postId})`; 
  const statsButtonText = `تعداد دانلود : 0 از ${postData.limit === 0 ? 'نامحدود' : postData.limit}`;

  const replyMarkup = { 
      inline_keyboard: [
          [{ text: downloadButtonText, url: `https://t.me/${botUsername || 'YOUR_BOT_USERNAME_FALLBACK'}?start=post_${postId}` }],
          [{ text: statsButtonText, callback_data: `post_stats_display:${postId}`}] 
      ] 
  };

  let successfulSends = 0;
  const sentChannelInfo = []; 

  for (const targetChannel of targetChannels) {
      let responseData;
      let params = { chat_id: targetChannel, reply_markup: JSON.stringify(replyMarkup) };
      if (schedule_date) {
        params.schedule_date = schedule_date;
      }

      if (postData.image_file_id) {
        params.photo = postData.image_file_id;
        params.caption = caption;
        responseData = await apiRequest(env.BOT_TOKEN, "sendPhoto", params);
      } else {
        params.text = caption;
        responseData = await apiRequest(env.BOT_TOKEN, "sendMessage", params);
      }

      if (responseData && responseData.ok) {
        sentChannelInfo.push({ 
            channel_id: targetChannel,
            message_id: responseData.result.message_id
        });
        successfulSends++;
        console.log(`Post ${postId} ${schedule_date ? 'scheduled for' : 'sent to'} channel ${targetChannel}, message_id: ${responseData.result.message_id}`);
      } else {
        console.error(`Failed to send/schedule post ${postId} to channel ${targetChannel}:`, responseData ? responseData.description : "Unknown error");
        if (adminChatId) await sendMessage(env.BOT_TOKEN, adminChatId, `خطا در ارسال/زمانبندی پست به کانال ${targetChannel}: ${responseData ? responseData.description : 'Unknown error'}.`);
      }
      await new Promise(resolve => setTimeout(resolve, 200)); 
  }
  
  const postKey = `posts:${postId}`;
  const finalPostData = await env.BOT_KV.get(postKey, {type: "json"});
  if (finalPostData) {
      finalPostData.sent_to_channels = sentChannelInfo;
      await env.BOT_KV.put(postKey, JSON.stringify(finalPostData));
  }
  
  if (successfulSends > 0 && adminChatId) {
    if (schedule_date) {
        await sendMessage(env.BOT_TOKEN, adminChatId, `پست ${postId} با موفقیت برای ارسال در ${successfulSends} کانال زمانبندی شد.`);
    } else {
        await sendMessage(env.BOT_TOKEN, adminChatId, `پست ${postId} با موفقیت به ${successfulSends} کانال از ${targetChannels.length} کانال ارسال شد.`);
    }
  } else if (adminChatId) {
    await sendMessage(env.BOT_TOKEN, adminChatId, `ارسال/زمانبندی پست ${postId} به هیچ یک از کانال‌های هدف موفقیت آمیز نبود.`);
  }

  return { success: successfulSends > 0, postId: postId };
}

// Renamed from saveAndPublishPost for clarity
async function publishPostNow(postData, env, adminChatId) {
    return await publishPost(postData, env, adminChatId, null);
}


async function sendAdminPanel(chatId, env) {
    const adminPanelKeyboard = {
        inline_keyboard: [
            [{ text: "➕ ایجاد پست جدید", callback_data: "admin_panel_new_post" }],
            [{ text: "📜 لیست و حذف پست‌ها", callback_data: "admin_panel_list_delete_posts:0" }], 
            [{ text: "🗑️ حذف پست با ID", callback_data: "admin_panel_delete_post_by_id_prompt" }],
            [{ text: "📢 مدیریت کانال‌های هدف", callback_data: "admin_panel_target_channels_menu" }],
            [{ text: "📊 آمار ربات", callback_data: "admin_panel_stats" }],
            [{ text: "👥 مدیریت کاربران", callback_data: "admin_panel_user_management" }],
            [{ text: "📣 ارسال پیام همگانی", callback_data: "admin_panel_broadcast" }],
            [{ text: "🔗 مدیریت عضویت اجباری", callback_data: "admin_panel_forced_join" }]
        ]
    };
    await sendMessage(env.BOT_TOKEN, chatId, "پنل مدیریت ادمین:", adminPanelKeyboard);
}

async function sendTargetChannelsMenu(chatId, env) {
    const targetChannelsMenuKeyboard = {
        inline_keyboard: [
            [{ text: "➕ افزودن کانال هدف", callback_data: "admin_panel_add_target_channel" }],
            [{ text: "➖ حذف کانال هدف", callback_data: "admin_panel_remove_target_channel" }],
            [{ text: "📜 لیست کانال‌های هدف", callback_data: "admin_panel_list_target_channels" }],
            [{ text: "بازگشت به پنل اصلی", callback_data: "admin_panel_main" }]
        ]
    };
    await sendMessage(env.BOT_TOKEN, chatId, "بخش مدیریت کانال‌های هدف:", targetChannelsMenuKeyboard);
}

async function sendUserManagementPanel(chatId, env) {
    const userManagementKeyboard = {
        inline_keyboard: [
            [{ text: "📜 لیست کاربران", callback_data: "admin_panel_list_users:0" }], 
            [{ text: "🚫 بن کردن کاربر", callback_data: "admin_panel_ban_user" }, { text: "✅ آنبن کردن کاربر", callback_data: "admin_panel_unban_user" }],
            [{ text: "بازگشت به پنل اصلی", callback_data: "admin_panel_main" }]
        ]
    };
    await sendMessage(env.BOT_TOKEN, chatId, "بخش مدیریت کاربران:", userManagementKeyboard);
}
async function sendForcedJoinPanel(chatId, env) {
    const forcedJoinKeyboard = {
        inline_keyboard: [
            [{ text: "➕ افزودن کانال عضویت اجباری", callback_data: "admin_panel_add_join_channel" }],
            [{ text: "➖ حذف کانال عضویت اجباری", callback_data: "admin_panel_remove_join_channel" }],
            [{ text: "📜 لیست کانال‌های عضویت اجباری", callback_data: "admin_panel_list_join_channels" }],
            [{ text: "بازگشت به پنل اصلی", callback_data: "admin_panel_main" }]
        ]
    };
    await sendMessage(env.BOT_TOKEN, chatId, "بخش مدیریت عضویت اجباری:", forcedJoinKeyboard);
}

async function sendPostListForDeletion(chatId, env, page = 0, messageIdToEdit = null, callbackQueryIdToAnswer = null) {
    console.log(`[sendPostListForDeletion] Called. Page: ${page}, cbId: ${callbackQueryIdToAnswer}`);
    const listResult = await env.BOT_KV.list({ prefix: "posts:" }); 
    const allPostKeysData = [];
    for (const key of listResult.keys) {
        allPostKeysData.push({ name: key.name }); 
    }
    
    const sortedPostKeys = allPostKeysData.map(k => k.name).sort((a, b) => {
        try { 
            const idA = parseInt(a.split(":")[1]);
            const idB = parseInt(b.split(":")[1]);
            if (isNaN(idA) || isNaN(idB)) return 0; 
            return idB - idA; 
        } catch (e) { console.error("Error sorting post keys:", e); return 0; }
    });

    const startIndex = page * POSTS_PER_PAGE;
    const endIndex = startIndex + POSTS_PER_PAGE;
    const paginatedKeys = sortedPostKeys.slice(startIndex, endIndex);

    const keyboard = []; 
    if (paginatedKeys.length === 0 && page === 0) {
        const emptyText = "هیچ پستی برای نمایش و حذف یافت نشد.";
        const backButton = {inline_keyboard: [[{text: "بازگشت به پنل اصلی", callback_data: "admin_panel_main"}]]};
        if (messageIdToEdit) {
            try { await editMessageText(env.BOT_TOKEN, chatId, messageIdToEdit, emptyText, backButton); }
            catch(e) { await sendMessage(env.BOT_TOKEN, chatId, emptyText, backButton); }
        } else {
            await sendMessage(env.BOT_TOKEN, chatId, emptyText, backButton);
        }
        if (callbackQueryIdToAnswer) await answerCallbackQuery(env.BOT_TOKEN, callbackQueryIdToAnswer); 
        return;
    }
     if (paginatedKeys.length === 0 && page > 0) { 
        if (callbackQueryIdToAnswer) await answerCallbackQuery(env.BOT_TOKEN, callbackQueryIdToAnswer, "صفحه دیگری برای نمایش وجود ندارد.", true);
        return; 
    }

    for (const key of paginatedKeys) {
        const postJson = await env.BOT_KV.get(key);
        if (postJson) {
            const post = JSON.parse(postJson);
            const titleSnippet = post.title ? (post.title.substring(0, 25) + (post.title.length > 25 ? "..." : "")) : "بدون عنوان";
            keyboard.push([
                { text: `"${titleSnippet}" (کد: ${post.id})`, callback_data: `admin_noop:${post.id}` }, 
                { text: "🗑️", callback_data: `admin_confirm_delete_post_from_list_prompt:${post.id}` } 
            ]);
        }
    }

    const navigationButtons = [];
    if (page > 0) {
        navigationButtons.push({ text: "⬅️ قبل", callback_data: `admin_panel_list_delete_posts:${page - 1}` });
    }
    if (sortedPostKeys.length > endIndex) {
        navigationButtons.push({ text: "بعد ➡️", callback_data: `admin_panel_list_delete_posts:${page + 1}` });
    }
    if (navigationButtons.length > 0) {
        keyboard.push(navigationButtons);
    }
    keyboard.push([{ text: "بازگشت به پنل اصلی", callback_data: "admin_panel_main" }]);

    const messageText = `لیست پست‌ها (صفحه ${page + 1} از ${Math.ceil(sortedPostKeys.length / POSTS_PER_PAGE)}):\nبرای حذف، روی دکمه 🗑️ کنار هر پست کلیک کنید.`;
    
    const messageOptions = { inline_keyboard: keyboard };
    if (messageIdToEdit) {
        try {
            await editMessageText(env.BOT_TOKEN, chatId, messageIdToEdit, messageText, messageOptions);
        } catch (e) { 
            console.error("Failed to edit post list message, sending new one:", e);
            await sendMessage(env.BOT_TOKEN, chatId, messageText, messageOptions);
        }
    } else {
        await sendMessage(env.BOT_TOKEN, chatId, messageText, messageOptions);
    }
    if (callbackQueryIdToAnswer) await answerCallbackQuery(env.BOT_TOKEN, callbackQueryIdToAnswer); 
}

async function sendUserList(chatId, env, page = 0, messageIdToEdit = null, callbackQueryIdToAnswer = null) {
    console.log(`[sendUserList] Called. Page: ${page}, MsgIdEdit: ${messageIdToEdit}, CBId: ${callbackQueryIdToAnswer}`);
    let allUserIds = await env.BOT_KV.get("bot_master_user_ids", { type: "json" });
    
    if (!Array.isArray(allUserIds)) {
        console.warn("[sendUserList] 'bot_master_user_ids' is not an array or null/undefined. Defaulting to empty list.");
        allUserIds = []; 
    }
    console.log(`[sendUserList] Total user IDs from KV: ${allUserIds.length}`);
    
    const sortedUserIds = [...allUserIds].map(id => String(id)).sort((a, b) => parseInt(a) - parseInt(b));

    const startIndex = page * USERS_PER_PAGE;
    const endIndex = startIndex + USERS_PER_PAGE;
    const paginatedUserIds = sortedUserIds.slice(startIndex, endIndex);
    console.log(`[sendUserList] Users for page ${page} (count: ${paginatedUserIds.length}):`, paginatedUserIds.join(", "));

    let messageText = `لیست کاربران \\(صفحه ${page + 1} از ${Math.ceil(sortedUserIds.length / USERS_PER_PAGE)}\\):\n\n`; // Escaped parentheses
    const keyboardRows = []; 

    if (paginatedUserIds.length === 0 && page === 0) {
        messageText = "هیچ کاربری در ربات ثبت نشده است.";
        keyboardRows.push([{text: "بازگشت به مدیریت کاربران", callback_data: "admin_panel_user_management"}]);
    } else if (paginatedUserIds.length === 0 && page > 0) {
        console.log("[sendUserList] No more users to display on this page.");
        if (callbackQueryIdToAnswer) await answerCallbackQuery(env.BOT_TOKEN, callbackQueryIdToAnswer, "صفحه دیگری برای نمایش کاربران وجود ندارد.", true);
        return; 
    } else {
        for (const userId of paginatedUserIds) {
            const userProfileKey = `user_profile:${userId}`;
            const userProfile = await env.BOT_KV.get(userProfileKey, { type: "json" });
            let userName = "";
            let banStatus = "";
            if (userProfile) {
                userName = userProfile.first_name || "";
                if (userProfile.last_name) userName += ` ${userProfile.last_name}`;
                if (userProfile.username) userName += ` (@${userProfile.username})`; 
                if (userProfile.is_banned) banStatus = " (مسدود)"; 
            } else {
                console.warn(`[sendUserList] User profile not found for ID: ${userId}, will display ID only.`);
                userName = "[پروفایل یافت نشد]";
            }
            const escapedUserName = escapeMarkdown(userName);
            const escapedBanStatus = escapeMarkdown(banStatus); 
            // Ensure the leading hyphen for list items is also escaped for MarkdownV2
            messageText += `\\- ID: \`${userId}\`${escapedUserName ? ` \\- ${escapedUserName}` : ""}${escapedBanStatus}\n`;
        }

        const navigationButtons = [];
        if (page > 0) {
            navigationButtons.push({ text: "⬅️ قبل", callback_data: `admin_panel_list_users:${page - 1}` });
        }
        if (sortedUserIds.length > endIndex) {
            navigationButtons.push({ text: "بعد ➡️", callback_data: `admin_panel_list_users:${page + 1}` });
        }
        if (navigationButtons.length > 0) {
            keyboardRows.push(navigationButtons);
        }
        keyboardRows.push([{ text: "بازگشت به مدیریت کاربران", callback_data: "admin_panel_user_management" }]);
    }
    
    const replyMarkup = { inline_keyboard: keyboardRows };
    const messageOptions = { parse_mode: "MarkdownV2" };

    try {
        if (messageIdToEdit) {
            console.log(`[sendUserList] Attempting to edit message ${messageIdToEdit}`);
            await editMessageText(env.BOT_TOKEN, chatId, messageIdToEdit, messageText, { ...replyMarkup, ...messageOptions});
        } else {
            console.log(`[sendUserList] Attempting to send new message`);
            await sendMessage(env.BOT_TOKEN, chatId, messageText, { ...replyMarkup, ...messageOptions});
        }
        if (callbackQueryIdToAnswer) {
            console.log(`[sendUserList] Answering callback query ${callbackQueryIdToAnswer}`);
            await answerCallbackQuery(env.BOT_TOKEN, callbackQueryIdToAnswer);
        }
    } catch (e) {
        console.error("[sendUserList] Error sending or editing user list message:", e.message, "\nText:", messageText, "\nMarkup:", JSON.stringify(replyMarkup) ,"\nStack:", e.stack);
        if (callbackQueryIdToAnswer) await answerCallbackQuery(env.BOT_TOKEN, callbackQueryIdToAnswer, "خطا در نمایش لیست کاربران. جزئیات در لاگ.", true);
    }
}


async function handleCallbackQuery(callbackQuery, env, ctx) { 
  const callbackQueryId = callbackQuery.id;
  const userId = callbackQuery.from.id; 
  const chatId = callbackQuery.message.chat.id; 
  const data = callbackQuery.data;     
  const messageId = callbackQuery.message.message_id;
  console.log(`[handleCallbackQuery] Data: "${data}", User: ${userId}, Chat: ${chatId}, MsgId: ${messageId}`);


  const userIsAdmin = await isAdmin(userId, env);

  if (!userIsAdmin && (data.startsWith("admin_panel_") || data.startsWith("admin_confirm_delete_post:") || data.startsWith("admin_cancel_delete_post:") || data.startsWith("admin_confirm_delete_post_from_list_prompt:") || data.startsWith("post_stats_display:") || data.startsWith("schedule_"))) {
      await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId, "شما اجازه انجام این عملیات را ندارید.", true);
      return;
  }

  const deletePreviousMessage = async (msgIdToDelete = messageId) => { 
    try { 
        console.log(`[handleCallbackQuery] Attempting to delete message ${msgIdToDelete} in chat ${chatId}`);
        await apiRequest(env.BOT_TOKEN, "deleteMessage", { chat_id: chatId, message_id: msgIdToDelete }); 
        console.log(`[handleCallbackQuery] Message ${msgIdToDelete} deleted successfully.`);
    } 
    catch (e) { console.error("[handleCallbackQuery] Failed to delete previous message:", e.message, e.stack); }
  };
  
  if (data === "publish_now") {
        const userState = await getUserState(userId, env);
        if (userState && userState.action === "new_post" && userState.step === "awaiting_publish_option") {
            await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId, "در حال ارسال فوری پست...");
            await deletePreviousMessage(messageId);
            await publishPost(userState.data, env, chatId); 
            await clearUserState(userId, env);
        }
        return;
  }
  if (data === "publish_schedule") {
        const userState = await getUserState(userId, env);
        if (userState && userState.action === "new_post" && userState.step === "awaiting_publish_option") {
            await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
            userState.action = "awaiting_schedule_date"; // Start new 2-step text flow
            await setUserState(userId, userState, env);
            const today = new Date();
            // Use Intl.DateTimeFormat for reliable Jalali date formatting with correct timezone
            const jalaliTodayFormatted = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                timeZone: 'Asia/Tehran'
            }).format(today);
            
            await deletePreviousMessage(messageId);
            await sendMessage(env.BOT_TOKEN, chatId, `لطفا تاریخ انتشار پست را با فرمت زیر ارسال کنید:\n\n` + '`YYYY/MM/DD`' + `\n\nمثال \\(تاریخ امروز\\): \`${jalaliTodayFormatted}\`\n\nیا با ارسال /cancel لغو کنید\\.`, {parse_mode: "MarkdownV2"});
        }
        return;
  }
  if (data === "publish_cancel") {
        await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId, "ارسال پست لغو شد.");
        await deletePreviousMessage(messageId);
        await clearUserState(userId, env);
        return;
  }
  
  if (data === "admin_panel_main") {
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
    await deletePreviousMessage();
    await sendAdminPanel(chatId, env); 
    return;
  }

  if (data === "admin_panel_new_post") {
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId, "شروع فرآیند پست جدید...");
    await startNewPostProcess(chatId, env); 
    return;
  }
  if (data === "admin_panel_delete_post_by_id_prompt") { 
      await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
      await setUserState(userId, { action: "awaiting_post_id_to_delete_by_id" }, env); 
      await sendMessage(env.BOT_TOKEN, chatId, "لطفا کد (ID) پستی که می‌خواهید با ID حذف کنید را ارسال نمایید یا با /cancel لغو کنید:");
      return;
  }
  if (data.startsWith("admin_panel_list_delete_posts:")) {
    const page = parseInt(data.split(":")[1] || "0");
    await sendPostListForDeletion(chatId, env, page, messageId, callbackQueryId); 
    return;
  }
  if (data.startsWith("admin_confirm_delete_post_from_list_prompt:")) {
    const postIdToDelete = data.split(":")[1];
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
    await confirmPostDeletion(chatId, postIdToDelete, env); 
    return;
  }
  if (data.startsWith("admin_confirm_delete_post:")) { 
      const postIdToDelete = data.split(":")[1];
      await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId, "در حال پردازش حذف پست...");
      await deletePreviousMessage(messageId); 
      const deleteSuccess = await deletePost(chatId, postIdToDelete, env);
      return;
  }
  if (data.startsWith("admin_cancel_delete_post:")) { 
      await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId, "حذف پست لغو شد.");
      await deletePreviousMessage(messageId); 
      return;
  }
  
  if (data === "admin_panel_target_channels_menu") {
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
    await deletePreviousMessage();
    await sendTargetChannelsMenu(chatId, env);
    return;
  }
  if (data === "admin_panel_add_target_channel") {
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
    await setUserState(userId, { action: "awaiting_target_channel_add" }, env);
    await sendMessage(env.BOT_TOKEN, chatId, "لطفا شناسه کانال یا نام کاربری آن را برای افزودن به لیست اهداف ارسال کنید (مثال: @MyChannel یا -100...) یا با /cancel لغو کنید:");
    return;
  }
  if (data === "admin_panel_remove_target_channel") {
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
    await setUserState(userId, { action: "awaiting_target_channel_remove" }, env);
    await sendMessage(env.BOT_TOKEN, chatId, "لطفا شناسه کانال یا نام کاربری آن را برای حذف از لیست اهداف ارسال کنید یا با /cancel لغو کنید:");
    return;
  }
  if (data === "admin_panel_list_target_channels") {
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
    await handleListTargetChannelsCommand(chatId, env); 
    return;
  }
  
   if (data === "admin_panel_stats") {
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId, "در حال محاسبه آمار، لطفا صبر کنید...");
    ctx.waitUntil(handleStatsCommand(chatId, env, ctx)); 
    return;
  }
  if (data === "admin_panel_user_management") {
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
    await deletePreviousMessage();
    await sendUserManagementPanel(chatId, env);
    return;
  }
   if (data.startsWith("admin_panel_list_users:")) {
    const page = parseInt(data.split(":")[1] || "0");
    console.log(`[handleCallbackQuery] Routing to sendUserList. Page: ${page}, MsgId: ${messageId}, CBId: ${callbackQueryId}`);
    await sendUserList(chatId, env, page, messageId, callbackQueryId); 
    return;
  }
  if (data === "admin_panel_ban_user") {
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
    await setUserState(userId, { action: "awaiting_user_id_to_ban" }, env);
    await sendMessage(env.BOT_TOKEN, chatId, "لطفا شناسه عددی کاربری که می‌خواهید مسدود کنید را ارسال نمایید یا با /cancel لغو کنید:");
    return;
  }
  if (data === "admin_panel_unban_user") {
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
    await setUserState(userId, { action: "awaiting_user_id_to_unban" }, env);
    await sendMessage(env.BOT_TOKEN, chatId, "لطفا شناسه عددی کاربری که می‌خواهید رفع مسدودیت کنید را ارسال نمایید یا با /cancel لغو کنید:");
    return;
  }
  if (data === "admin_panel_broadcast") {
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
    await setUserState(userId, { action: "awaiting_broadcast_message" }, env);
    await sendMessage(env.BOT_TOKEN, chatId, "لطفا متن پیامی که می‌خواهید برای همه کاربران ارسال شود را بنویسید یا با /cancel لغو کنید:\n(با احتیاط استفاده شود!)");
    return;
  }
  if (data === "admin_panel_forced_join") {
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
    await deletePreviousMessage();
    await sendForcedJoinPanel(chatId, env);
    return;
  }
  if (data === "admin_panel_add_join_channel") {
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
    await setUserState(userId, { action: "awaiting_forced_channel_add" }, env);
    await sendMessage(env.BOT_TOKEN, chatId, "لطفا شناسه یا نام کاربری کانالی که می‌خواهید به لیست عضویت اجباری اضافه کنید را ارسال نمایید (مثال: @MyChannel یا -100...) یا با /cancel لغو کنید:");
    return;
  }
  if (data === "admin_panel_remove_join_channel") {
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
    await setUserState(userId, { action: "awaiting_forced_channel_remove" }, env);
    await sendMessage(env.BOT_TOKEN, chatId, "لطفا شناسه یا نام کاربری کانالی که می‌خواهید از لیست عضویت اجباری حذف کنید را ارسال نمایید یا با /cancel لغو کنید:");
    return;
  }
  if (data === "admin_panel_list_join_channels") {
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId);
    await handleListJoinChannelsCommand(chatId, env); 
    return;
  }
  if (data.startsWith("admin_noop")) { 
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId); 
    return;
  }
  if (data.startsWith("post_stats_display:")) { 
    await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId, "این دکمه فقط برای نمایش آمار است.", false);
    return;
  }


  console.log("[handleCallbackQuery] Received unhandled callback_query with data:", data);
  await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId, "عملیات نامشخص.", false);
}


async function checkUserMembership(userId, channel_id_or_username, env) { 
    try {
        const memberStatus = await apiRequest(env.BOT_TOKEN, "getChatMember", { chat_id: channel_id_or_username, user_id: userId });
        if (memberStatus.ok) {
            const status = memberStatus.result.status;
            return ["creator", "administrator", "member"].includes(status);
        } else {
            console.error(`[checkUserMembership] Error for user ${userId} in channel ${channel_id_or_username}: ${memberStatus.description}`);
            return false; 
        }
    } catch (e) {
        console.error(`[checkUserMembership] Exception for user ${userId} in channel ${channel_id_or_username}:`, e);
        return false; 
    }
}
async function processPostDownload(postId, userId, callbackQueryId, env, userChatId, isFromStartCommand = false, channelMessage = null, ctx = null) { 
  console.log(`[processPostDownload] PostId: ${postId}, User: ${userId}, FromStart: ${isFromStartCommand}`);
  const postKey = `posts:${postId}`;
  const postJson = await env.BOT_KV.get(postKey);

  if (!postJson) { 
    console.log(`[processPostDownload] Post ${postId} not found.`);
    if (!isFromStartCommand && callbackQueryId) await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId, "خطا: پست یافت نشد.", true);
    else if (isFromStartCommand) await sendMessage(env.BOT_TOKEN, userChatId, "خطا: پستی با این کد یافت نشد.");
    return;
  }

  let post = JSON.parse(postJson);
  console.log(`[processPostDownload] Post ${postId} data fetched.`);
  
  const cooldownKey = `cooldown:${userId}`;
  const isOnCooldown = await env.BOT_KV.get(cooldownKey);
  if (isOnCooldown) {
      console.log(`[processPostDownload] User ${userId} is on cooldown.`);
      const waitMessage = `لطفا ${ANTI_SPAM_COOLDOWN_SECONDS} ثانیه صبر کنید و دوباره تلاش نمایید.`;
      if (!isFromStartCommand && callbackQueryId) await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId, waitMessage, true);
      else if (isFromStartCommand) await sendMessage(env.BOT_TOKEN, userChatId, waitMessage);
      return;
  }

  const userProfileKey = `user_profile:${userId}`;
  const userProfile = await env.BOT_KV.get(userProfileKey, { type: "json" });
  if (userProfile && userProfile.is_banned) { 
      console.log(`[processPostDownload] User ${userId} is banned. Denying download for post ${postId}.`);
      const banMessage = "شما توسط ادمین از دریافت فایل منع شده‌اید.";
      if (!isFromStartCommand && callbackQueryId) await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId, banMessage, true);
      else if (isFromStartCommand) await sendMessage(env.BOT_TOKEN, userChatId, banMessage);
      return;
  }

  const forcedJoinChannels = await env.BOT_KV.get("config:forced_join_channels", { type: "json" }) || [];
  if (forcedJoinChannels.length > 0) { 
      console.log(`[processPostDownload] Checking forced join for user ${userId} for post ${postId}. Channels: ${forcedJoinChannels.join(', ')}`);
      let allChannelsJoined = true;
      let channelsToJoinMessage = FORCED_JOIN_MESSAGE;
      const channelLinks = [];

      for (const channel of forcedJoinChannels) {
          const isMember = await checkUserMembership(userId, channel, env);
          console.log(`[processPostDownload] User ${userId} membership in ${channel}: ${isMember}`);
          if (!isMember) {
              allChannelsJoined = false;
              let channelLink = channel; 
              if (channel.startsWith("@")) {
                  channelLink = `https://t.me/${channel.substring(1)}`;
              } else { 
                  try {
                      const chatInfo = await apiRequest(env.BOT_TOKEN, "getChat", { chat_id: channel });
                      if (chatInfo.ok && chatInfo.result.invite_link) {
                          channelLink = chatInfo.result.invite_link;
                      } else if (chatInfo.ok && chatInfo.result.title) {
                          channelLink = `${chatInfo.result.title} (ID: ${channel})`;
                      }
                  } catch (e) { console.error("[processPostDownload] Error getting chat info for private channel link:", e); }
              }
              channelLinks.push(channelLink);
          }
      }
      if (!allChannelsJoined) {
          console.log(`[processPostDownload] User ${userId} has not joined all required channels for post ${postId}.`);
          channelsToJoinMessage += channelLinks.join("\n");
          channelsToJoinMessage += "\n\nپس از عضویت، دوباره روی دکمه دریافت فایل در کانال اصلی کلیک کنید یا اگر از طریق لینک مستقیم آمده‌اید، دستور /start را دوباره با همان لینک ارسال کنید.";
          if (!isFromStartCommand && callbackQueryId) await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId, "لطفا ابتدا در کانال(های) مشخص شده عضو شوید.", true);
          await sendMessage(env.BOT_TOKEN, userChatId, channelsToJoinMessage); 
          return;
      }
      console.log(`[processPostDownload] User ${userId} has joined all required channels for post ${postId}.`);
  }


  if (post.limit !== 0 && post.download_count >= post.limit) { 
    console.log(`[processPostDownload] Download limit reached for post ${postId}.`);
    if (!isFromStartCommand && callbackQueryId) await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId, "متاسفانه ظرفیت دانلود این فایل تمام شده است.", true);
    else if (isFromStartCommand) await sendMessage(env.BOT_TOKEN, userChatId, "متاسفانه ظرفیت دانلود این فایل تمام شده است.");
    return;
  }

  // Set cooldown BEFORE attempting to send, to prevent spam
  ctx.waitUntil(env.BOT_KV.put(cooldownKey, "true", { expirationTtl: ANTI_SPAM_COOLDOWN_SECONDS }));

  // Check if user has downloaded this specific post before
  const userDownloadKey = `download:${postId}:${userId}`;
  const hasDownloaded = await env.BOT_KV.get(userDownloadKey);

  console.log(`[processPostDownload] Attempting to send file/text for post ${postId} to user ${userId}. Type: ${post.content_file_type}`);
  const sentFileResponse = await sendFileToUser(env.BOT_TOKEN, userChatId, post.content_file_id, post.content_file_type, post.content_text);

  if (sentFileResponse && sentFileResponse.ok) {
    console.log(`[processPostDownload] File/Text for post ${postId} sent successfully to user ${userId}. Message ID: ${sentFileResponse.result.message_id}`);
    
    // Only increment download count if user has NOT downloaded before
    if (!hasDownloaded) {
        post.download_count += 1;
        // Mark as downloaded
        ctx.waitUntil(env.BOT_KV.put(userDownloadKey, "true")); 
        // Update the main post data with new count
        ctx.waitUntil(env.BOT_KV.put(postKey, JSON.stringify(post)));
        console.log(`[processPostDownload] First time download. Download count for post ${postId} update queued to ${post.download_count}.`);
    } else {
        console.log(`[processPostDownload] Repeat download for user ${userId}. Count not incremented.`);
    }
    
    // Update the stats button in the channel(s) if it was the first download for this user
    if (!hasDownloaded && post.sent_to_channels && Array.isArray(post.sent_to_channels)) {
        const newStatsButtonText = `تعداد دانلود : ${post.download_count} از ${post.limit === 0 ? 'نامحدود' : post.limit}`;
        const botUsername = env.BOT_USERNAME || 'YOUR_BOT_USERNAME_FALLBACK';
        const newReplyMarkupForChannel = {
            inline_keyboard: [
                [{ text: `دریافت فایل (کد: ${postId})`, url: `https://t.me/${botUsername}?start=post_${postId}` }],
                [{ text: newStatsButtonText, callback_data: `post_stats_display:${postId}`}]
            ]
        };
        for (const sentInfo of post.sent_to_channels) {
            if (sentInfo.channel_id && sentInfo.message_id) {
                const editTask = apiRequest(env.BOT_TOKEN, "editMessageReplyMarkup", {
                    chat_id: sentInfo.channel_id,
                    message_id: sentInfo.message_id,
                    reply_markup: JSON.stringify(newReplyMarkupForChannel)
                }).catch(e => console.error(`Failed to update stats button in ${sentInfo.channel_id} for msg ${sentInfo.message_id}:`, e));
                ctx.waitUntil(editTask);
            }
        }
    }
    
    const sentContentMessageId = sentFileResponse.result.message_id;
    const confirmationMessage = `فایل درخواست شده برای شما ارسال شد! ✅\n\nفایل ارسالی تا ${FILE_DELETION_DELAY_SECONDS} ثانیه دیگه پاک میشه.\nلطفا در Save Messages خود فایل را ذخیره کنید!`;
    
    if (!isFromStartCommand && callbackQueryId) {
        await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId); 
        await sendMessage(env.BOT_TOKEN, userChatId, confirmationMessage);
    } else if (isFromStartCommand) {
        await sendMessage(env.BOT_TOKEN, userChatId, confirmationMessage);
    }
    
    const deletionTask = async () => {
        console.log(`[DeletionTask] Scheduled for message ${sentContentMessageId} in chat ${userChatId} after ${FILE_DELETION_DELAY_SECONDS}s.`);
        await new Promise(resolve => setTimeout(resolve, FILE_DELETION_DELAY_SECONDS * 1000));
        try {
            console.log(`[DeletionTask] Attempting to delete message ${sentContentMessageId} for user ${userChatId}.`);
            const deleteOp = await apiRequest(env.BOT_TOKEN, "deleteMessage", {
                chat_id: userChatId,
                message_id: sentContentMessageId
            });
            if (deleteOp.ok) {
                 console.log(`[DeletionTask] File message ${sentContentMessageId} deleted for user ${userChatId}.`);
            } else {
                 console.error(`[DeletionTask] Telegram API failed to delete message ${sentContentMessageId} for user ${userChatId}: ${deleteOp.description}`);
            }
        } catch (e) {
            console.error(`[DeletionTask] Exception during scheduled deletion of message ${sentContentMessageId} for user ${userChatId}:`, e.message, e.stack);
        }
    };

    ctx.waitUntil(deletionTask());
    console.log("[processPostDownload] Using ctx.waitUntil for deletion task.");

  } else { 
    console.error("[processPostDownload] Failed to send file/text to user:", sentFileResponse);
    const errorMessage = "خطا در ارسال فایل/پیام. لطفا دوباره تلاش کنید.";
    if (!isFromStartCommand && callbackQueryId) await answerCallbackQuery(env.BOT_TOKEN, callbackQueryId, errorMessage, true);
    else if (isFromStartCommand) await sendMessage(env.BOT_TOKEN, userChatId, errorMessage);
  }
}
async function sendFileToUser(botToken, chatId, fileId, fileType, contentText = null) { 
  switch (fileType) {
    case "document": return sendDocument(botToken, chatId, fileId, null); 
    case "photo": return sendPhoto(botToken, chatId, fileId, null); 
    case "video": return apiRequest(botToken, "sendVideo", { chat_id: chatId, video: fileId, caption: null });
    case "audio": return apiRequest(botToken, "sendAudio", { chat_id: chatId, audio: fileId, caption: null });
    case "text_message": 
        if (contentText) {
            return sendMessage(botToken, chatId, contentText);
        } else {
            console.error("Attempted to send text_message but contentText is null.");
            return { ok: false, description: "No text content to send." };
        }
    default: 
        console.error("Unsupported file type for sending:", fileType); 
        return { ok: false, description: "Unsupported file type" };
  }
}
async function setUserState(userId, state, env) { 
  await env.BOT_KV.put(`user_state:${userId}`, JSON.stringify(state), { expirationTtl: 3600 }); 
}
async function getUserState(userId, env) { 
  const stateStr = await env.BOT_KV.get(`user_state:${userId}`);
  return stateStr ? JSON.parse(stateStr) : null;
}
async function clearUserState(userId, env) { 
  await env.BOT_KV.delete(`user_state:${userId}`);
}
async function isAdmin(userId, env) { 
  if (!env.ADMIN_CHAT_ID) { console.error("ADMIN_CHAT_ID is not configured."); return false; }
  if (userId.toString() === env.ADMIN_CHAT_ID.toString()) return true;
  const admins = await env.BOT_KV.get("config:admins", { type: "json" });
  return admins && admins.includes(parseInt(userId)); 
}
async function apiRequest(botToken, methodName, params = {}) { 
  if (!botToken) { console.error("BOT_TOKEN is undefined in apiRequest."); return { ok: false, description: "BOT_TOKEN not configured" };}
  const url = `https://api.telegram.org/bot${botToken}/${methodName}`;
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
    const data = await response.json();
    if (!data.ok) { console.error(`Telegram API Error (${methodName}): ${data.error_code} - ${data.description}`, params); }
    return data;
  } catch (error) { console.error(`Fetch/JSON Parse Error (${methodName}):`, error.message, params); return { ok: false, description: error.message }; }
}
async function sendMessage(botToken, chatId, text, options = null) {
  const params = { chat_id: chatId, text: text };
  if (options) {
    if (options.inline_keyboard) { 
      params.reply_markup = JSON.stringify({ inline_keyboard: options.inline_keyboard });
    } else if (options.reply_markup) { 
      params.reply_markup = JSON.stringify(options.reply_markup);
    }
    if (options.parse_mode) {
      params.parse_mode = options.parse_mode;
    }
  }
  return apiRequest(botToken, "sendMessage", params);
}
async function sendPhoto(botToken, chatId, photoFileId, caption = null, reply_markup_obj = null) { 
  const params = { chat_id: chatId, photo: photoFileId };
  if (caption) { params.caption = caption; }
  if (reply_markup_obj) { params.reply_markup = JSON.stringify(reply_markup_obj); }
  return apiRequest(botToken, "sendPhoto", params);
}
async function sendDocument(botToken, chatId, documentFileId, caption = null, reply_markup_obj = null) { 
  const params = { chat_id: chatId, document: documentFileId };
  if (caption) { params.caption = caption; }
  if (reply_markup_obj) { params.reply_markup = JSON.stringify(reply_markup_obj); }
  return apiRequest(botToken, "sendDocument", params);
}
async function answerCallbackQuery(botToken, callbackQueryId, text = '', show_alert = false) { 
  if (!callbackQueryId) { 
    console.warn("answerCallbackQuery called with no callbackQueryId.");
    return {ok: false, description: "No callbackQueryId provided"};
  }
  const params = { callback_query_id: callbackQueryId, text: text, show_alert: show_alert };
  return apiRequest(botToken, "answerCallbackQuery", params);
}
async function editMessageText(botToken, chatId, messageId, text, options = null) {
  const params = { chat_id: chatId, message_id: messageId, text: text };
   if (options) {
    if (options.inline_keyboard) { 
      params.reply_markup = JSON.stringify({ inline_keyboard: options.inline_keyboard });
    } else if (options.reply_markup) { 
      params.reply_markup = JSON.stringify(options.reply_markup);
    }
    if (options.parse_mode) {
      params.parse_mode = options.parse_mode;
    }
  }
  return apiRequest(botToken, "editMessageText", params);
}
async function editMessageReplyMarkup(botToken, chatId, messageId, reply_markup_obj = null) { 
    const params = { chat_id: chatId, message_id: messageId };
    if (reply_markup_obj) { params.reply_markup = JSON.stringify(reply_markup_obj); }
    else { params.reply_markup = JSON.stringify({}); }
    return apiRequest(botToken, "editMessageReplyMarkup", params);
}
async function getChatMember(botToken, chatId, userId) {  
    return apiRequest(botToken, "getChatMember", { chat_id: chatId, user_id: userId });
}
