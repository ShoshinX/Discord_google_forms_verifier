import Discord, { Message } from "discord.js";
// setup your token in src/token.ts
import {token,guild_id,verified_guild_role_id, sender_email, channel_log_id, google_form_verifier_url,server_name, send_grid_api_key, channel_welcome_id, exec_mention} from "./src/token";
import express from "express";
import crypto from "crypto";
import nodemailer from "nodemailer";
import sgTransport from "nodemailer-sendgrid";
import sqlite3, { OPEN_CREATE, OPEN_READWRITE } from "sqlite3";
import {open} from "sqlite";

(async () => {
const client = new Discord.Client();
const app = express();

app.use(express.json()); // to parse application/json

// TODO
//1. bot pings them in verification channel w form
//2. bot sends message in verification channel "email sent to [discord tag] please respond with !verify [code]"
//3. bot says "verified welcome!"


// Members comes in -> bot saves member id and discord tag -> bot sends member google form -> member submits google form -> bot sends email to member -> member uses verification code to verify to the bot

// TODO: setup a database so that restarting doesn't fuck everything up
let db = await open({
  filename: "./AnDAwaitingMembers.db",
  driver: sqlite3.Database,
  mode: OPEN_READWRITE
}).then(db1 => db1, err => {console.log("ERROR: no database found, creating one"); return null;});
// When database does not exist create the tables
if (db == null){
  db = await open({
    filename: "./AnDAwaitingMembers.db",
    driver: sqlite3.Database,
    mode: OPEN_READWRITE | OPEN_CREATE
  }).then(db1 => db1, err => {console.log("ERROR: cannot create db, " + err); return null;});
  if (db !== null){
    await db.exec(`CREATE TABLE pendingDiscordMembers (
      discord_id TEXT PRIMARY KEY,
      discord_tag TEXT,
      has_submit_form BOOLEAN,
      verification_code TEXT
    )`);
  }
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`)
})

client.on('message', async msg => {
  // Pre-emptive ban
  if(msg.channel.id === channel_log_id){
    let prefix = '!ban';
    if (!msg.content.startsWith(prefix)) return;
    const args = msg.content.slice(prefix.length).trim().split(/ +/);
    const id = args.shift()!?.toLowerCase();
    if (id){
      let guild = await client.guilds.fetch(guild_id);
      let user = await guild.members.ban(id);
      client.channels.fetch(channel_log_id).then(channel => {
        (channel as Discord.TextChannel).send(`Banned ${user.toString()} from this server`)
      });
    }
    
  }

  let prefix = '!verifyme';
  if (!msg.content.startsWith(prefix)) return;
  const args = msg.content.slice(prefix.length).trim().split(/ +/);
  const verification_code = args.shift()!?.toLowerCase();
  // TODO: Handle when verification code does not exist
  let row = await db?.get("SELECT * FROM pendingDiscordMembers WHERE verification_code=?", verification_code);
  let discord_id = row["discord_id"];
  //console.log(`args: ${args}; id: ${id}; discord_id: ${discord_id}`);
  let log_channel = await client.channels.fetch(channel_log_id);
  if (discord_id){
    let guild = await client.guilds.fetch(guild_id);
    // Fetch latest list of members from server to be stored in cache
    let members = await guild.members.fetch();
    // Find discord tag from list1587
    let member = await guild.members.cache.find(u => u.user.tag.toLowerCase() === discord_id.toLowerCase());
    // If member is in ban list exit function
    let verified_role_id = verified_guild_role_id;
    let member_role_manager = member?.roles;
    try {
      await member_role_manager?.add(verified_role_id);
    }catch (err) {
      console.log(err);
    }
    msg.reply(`Thanks! I've verified you. 
    Feel free to introduce yourself in #introductions and grab some roles from #reacc-roles.
    Hope you have fun on our server!
    Otherwise wait a couple mins or ping the execs`
    );
    (log_channel as Discord.TextChannel).send(`[${Date().toString()}]${discord_id} has been verified`);
  } else {
    console.log(`Received a bogus uuid from ${msg.author.tag}: ${verification_code}`)
  }
})

client.on('guildMemberAdd', async member => {
  // If member is on the ban list then ghost.
  let guild = await client.guilds.fetch(guild_id);
  let channel = await guild.channels.resolve(channel_welcome_id);
  // This should be fine since we're not storing sensitive personal data.
  await db?.run("INSERT OR REPLACE INTO pendingDiscordMembers (discord_id, discord_tag, has_submit_form, verification_code) VALUES (?,?,FALSE,?)", 
  `${member.id}`,
  `${member.user.tag}`,
  `${crypto.randomBytes(16).toString("hex")}`);

  (channel as Discord.TextChannel).send(`Hello ${member.user.tag}! Welcome to ${server_name}!
  Please fill in the following form so I can verify you!
  ${google_form_verifier_url}
  Once you've filled in the form, our bot should send you an email to your ***inbox*** or ***junk/spam*** to your ***zID UNSW email***!
  Reply to me with the secret message in the email~`
  )
})

client.login(token);

const port = 4000;

app.get('/pingack', (req,res) => {
  res.send("Pinging back");
})

app.post('/sendEmail', async (req, res) => {
  // add zid and discord_id into sqlite database
  const zid = req.body.zid;
  const discord_tag = req.body.discord_id;
  const is_arc = req.body.is_arc;
  let channel = await client.channels.fetch(channel_log_id);
  if (is_arc === 'No'){
    (channel as Discord.TextChannel).send(`***${discord_tag}*** is a ***non-arc*** member, ${exec_mention} please check :)`)
    res.sendStatus(200);
    return;
  }
  // google forms parses the input such that it has the form of ([A-Z]|[a-z])+#[0-9]{4}, so there shouldn't be any problems unless someone who hasn't entered the server submits there name
  await db?.run(`UPDATE pendingDiscordMembers SET has_submit_form =TRUE WHERE discord_tag=?`, discord_tag);
  // Send email to zid@ad.unsw.edu.au
  const recipient = `${zid}@ad.unsw.edu.au`;
  const charset = "UTF-8";
  let row = await db?.get("SELECT * FROM pendingDiscordMembers WHERE discord_tag=?", discord_tag);
  // Specify the parameters to pass to the API.
  let transporter = nodemailer.createTransport(sgTransport({apiKey: send_grid_api_key}));

  let mailOptions = {
      from: sender_email,
      to: recipient,
      subject: 'UNSW Art & Drawing Society verification and events',
      html: `<p><b>!verifyme ${row["verification_code"]}</b></p> <p>Copy paste the above into the bot's dms so that we can see you in the server</p>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
      if (err)
        (channel as Discord.TextChannel).send(`[${Date().toString()}]There's an error in sending email for ${discord_tag}:${zid}`);
      else
        (channel as Discord.TextChannel).send(`[${Date().toString()}]mail sent to ${discord_tag}:${zid} `);
  });

  res.sendStatus(200);
})

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
})();