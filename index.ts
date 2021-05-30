
import Discord from "discord.js";
// setup your token in src/token.ts
import {token,guild_id,verified_guild_role_id,website, sender_email} from "./src/token";
import express from "express";
import crypto from "crypto";
import AWS from "aws-sdk";


const client = new Discord.Client();
const app = express();
AWS.config.update({region: "ap-southeast-2"});

app.use(express.json()); // to parse application/json

client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`)
})

client.on('message', msg => {
  // No need for processing messages
})


client.login(token);

const port = 4000;


let database : Record<string, string> = {};
// Try to listen for verify links
app.get('/verify', async (req,res) => {
  const id = req.query.id!?.toString();
  console.log("received message from public ip")
  // search id from database
  const discord_id = database[id];
  if (discord_id){
    let guild = await client.guilds.fetch(guild_id);
    // Find discord tag from list
    let member = await guild.members.cache.find(u => u.user.tag === discord_id);
    // TODO: Copy the role id from the server to here
    let verified_role_id = verified_guild_role_id;
    let member_role_manager = member?.roles;
    try {
      await member_role_manager?.add(verified_role_id);
    }catch (err) {
      console.log(err);
    }
    console.log(`going to update ${discord_id}'s role`);
    res.send("You're verified, otherwise ping the execs");
  } else {
    console.log(`Received a bogus uuid: ${id}`)
  }
})

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


app.post('/sendEmail',(req, res) => {
  // add zid and discord_id into sqlite database
  const zid = req.body.zid;
  const discord_id = req.body.discord_id;
  // This should be fine since we're not storing sensitive personal data.
  let new_uuid = crypto.randomBytes(16).toString("hex");
  database[new_uuid] = discord_id!.toString();
  // Send email to zid@ad.unsw.edu.au
  // TODO
  const sender = `A&Dsoc verification <${sender_email}>`;
  const recipient = `${zid}@ad.unsw.edu.au`;
  const subject = "A&Dsoc: Click here to finish verification";
  const body_text = `Click here to finish the verification: ${website}/verify?id=${new_uuid}`;
  const charset = "UTF-8";
  let ses = new AWS.SES();
  // Specify the parameters to pass to the API.
  let params = { 
    Source: sender, 
    Destination: { 
      ToAddresses: [
        recipient 
      ],
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: charset
      },
      Body: {
        Text: {
          Data: body_text,
          Charset: charset 
        },
      }
    }
  };

  ses.sendEmail(params,(err,data) => {
    if (err) console.log(err.message);
    else console.log("Email sent! Message ID: ", data.MessageId);
  })
})

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})