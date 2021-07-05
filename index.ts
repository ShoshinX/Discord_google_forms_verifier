
import Discord, { Message } from "discord.js";
// setup your token in src/token.ts
import {token,guild_id,verified_guild_role_id,website, sender_email, gmail_pass, gmail_user, channel_log_id, google_form_verifier_url,server_name, ban_list} from "./src/token";
import express from "express";
import crypto from "crypto";
import nodemailer from "nodemailer";


const client = new Discord.Client();
const app = express();

app.use(express.json()); // to parse application/json

client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`)
})

client.on('message', async msg => {
  // No need for processing messages
  let prefix = '!verifyme';
  if (!msg.content.startsWith(prefix)) return;
  const args = msg.content.slice(prefix.length).trim().split(/ +/);
  const id = args.shift()!?.toLowerCase();
  const discord_id = database[id];
  //console.log(`args: ${args}; id: ${id}; discord_id: ${discord_id}`);
  let log_channel = await client.channels.fetch(channel_log_id);
  if (discord_id){
    let guild = await client.guilds.fetch(guild_id);
    // Fetch latest list of members from server to be stored in cache
    let members = await guild.members.fetch();
    // Find discord tag from list
    let member = await guild.members.cache.find(u => u.user.tag.toLowerCase() === discord_id.toLowerCase());
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
    (log_channel as Discord.TextChannel).send(`[${(new Date).toUTCString}]${discord_id} has been verified`);
  } else {
    console.log(`Received a bogus uuid from ${msg.author.tag}: ${id}`)
  }
})

client.on('guildMemberAdd', member => {
  // If member is on the ban list then ghost.
  if (ban_list.includes(member.id)) return;
  member.send(`Hello ${member.user.tag}! Welcome to ${server_name}!
  Please fill in the following form so our exec team can verify you!
  ${google_form_verifier_url}
  Once you're done, feel free to ping the execs so they can give you access to the rest of the server. 
  
  Hope you have fun here!`)
  console.log(`${member.user.tag} has entered`)
})

client.login(token);

const port = 4000;

app.get('/pingack', (req,res) => {
  res.send("Pinging back");
})


let database : Record<string, string> = {};

async function testFetchingGuildMember(client: Discord.Client){
  console.log("---TEST---");
  const discord_id = "Shoshin#6925";
  const guild_id = "512903652453777418"; // currently test server
  let guild = await client.guilds.fetch(guild_id);
  // Fetch latest list of members from server
  let members = await guild.members.fetch();
  // Find discord tag from list
  let member = await guild.members.cache.find(u => u.user.tag === discord_id);
  // Copy the role id from the server to here
  let verified_role_id = "847716353746010123";
  let member_role_manager = member?.roles;
  let msg = await member_role_manager?.add(verified_role_id);
  console.log("---TEST---");
}


app.post('/sendEmail', async (req, res) => {
  // add zid and discord_id into sqlite database
  const zid = req.body.zid;
  const discord_id = req.body.discord_id;
  const is_arc = req.body.is_arc;
  if (is_arc === 'No'){
    let channel = await client.channels.fetch(channel_log_id);
    (channel as Discord.TextChannel).send(`***${discord_id}*** is a ***non-arc*** member, one of the execs please check :)`)
    res.sendStatus(200);
    return;
  }
  // This should be fine since we're not storing sensitive personal data.
  let new_uuid = crypto.randomBytes(16).toString("hex");
  database[new_uuid] = discord_id!.toString();
  // Send email to zid@ad.unsw.edu.au
  const recipient = `${zid}@ad.unsw.edu.au`;
  const charset = "UTF-8";
  // Specify the parameters to pass to the API.
  let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
          user: gmail_user,
          pass: gmail_pass,
      }
  });

  let mailOptions = {
      from: sender_email,
      to: recipient,
      subject: 'UNSW Art & Drawing Society verification and events',
      html: `<p><b>!verifyme ${new_uuid}</b></p> <p>Copy paste the above into the bot's dms so that we can see you in the server</p>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
      if (err)
          console.log(err);
      else
          console.log('Email sent: ' + JSON.stringify(info));
  });

  res.sendStatus(200);
  client.channels.fetch(channel_log_id).then(channel => (channel as Discord.TextChannel).send(`[${Date.now().toLocaleString()}] Verification email sent for: ${discord_id}`));
})

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
