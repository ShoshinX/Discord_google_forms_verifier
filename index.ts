
import Discord from "discord.js";
// setup your token in src/token.ts
import {token} from "./src/token";
import express from "express";

const client = new Discord.Client();
const app = express();

client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`)
})

client.on('message', msg => {
  if (msg.content == 'ping') {
    msg.reply('Pong!')
  }
})


client.login(token);

const port = 4000;

// Try to listen for verify links
app.get('/verify', (req,res) => {
  const id = req.query.id;
  // search id from database
  // if it's verified success
  // otherwise verify it
})
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})