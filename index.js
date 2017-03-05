'use strict'
const Bot = require('./bot');
const request = require('superagent');
const express = require('express');
const app = express();
const port = process.env.PORT || 8000;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const wikiAPI = 'https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&titles=';
const wikiURL = 'https://en.wikipedia.org/wiki/';

//---------Server-------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.redirect(`https://slack.com/oauth/authorize?client_id=${CLIENT_ID}&scope=bot&redirect_uri=${escape('https://wikinerd.herokuapp.com/bot')}`);
});

app.get('/bot', (req, res) => {
  let code = req.query.code;

  request.get(`https://slack.com/api/oauth.access?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&code=${code}&redirect_uri=${escape('https://wikinerd.herokuapp.com/bot')}`)
  .end((err, result) => {
    if (err) {
      console.log(error);
      return res.send('An error occured! Please try again later.');
    }
    console.log(res.body);

    let botToken = result.body.bot.bot_access_token;
    console.log('Got the token:', botToken);

    startWikinerd(result.body.bot.bot_access_token);
    res.send('You have successfully install WikiNerd! You can now start using it in your Slack team, but make sure to invite the bot to your channel first with the /invite command!');
  });
});

app.listen(port, () => {
  console.log('listening');
});

//----------------------------------------------------------------------------------------

//---------BOT----------------------------------------------------------------------------

function startWikinerd(token) {
  const bot = new Bot({
    token: token,
    autoReconnect: true,
    autoMark: true
  });

  function getWikiSummary(term, cb) {
    // replace spaces with unicode
    let parameters = term.replace(/ /g, '%20');

  // get wikipedia search query
    request.get(wikiAPI + parameters).end((err, res) => {
      if (err) {
        cb(err);
        return;
      }
      let url = wikiURL + parameters;
      // parse data for easy access
      cb(null, JSON.parse(res.text), url);
    });
  }

  bot.respondTo('hello', (message, channel, user) => {
    bot.send(`Hello to you too, ${user.name}!`, channel)
  }, true);

  bot.respondTo('help', (message, channel) => {
    bot.send(`To use my Wikipedia functionality, type \`wiki\` followed by your search query`, channel);
  }, true);

  bot.respondTo('wiki', (message, channel, user) => {
    if (user && user.is_bot) {
      return;
    }
    // grab the search parameters, but remove the command 'wiki' from
    // the beginning of the message first
    let args = message.text.split(' ').slice(1).join(' ');
    bot.setTypingIndicator(message.channel);

    getWikiSummary(args, (err, result, url) => {
      if (err) {
        bot.send(`I\'m sorry, but something went wrong with your query`, channel);
        console.error(err);
        return;
      }
      // we want the first id property of the returned object from the wikipedia query
      let pageID = Object.keys(result.query.pages)[0];

      // -1 indicates that the article doesn't exist
      if (parseInt(pageID, 10) === -1) {
        bot.send('That page does not exist yet, perhaps you\'d like to create it:', channel);
        bot.send(url, channel);
        return;
      }

      let page = result.query.pages[pageID];
      let summary = page.extract;

      // if search term is too vague, multiple unwanted hits will return
      if (/may refer to/i.test(summary)) {
        bot.send('Your search query may refer to multiple things, please be more specific or visit:', channel);
        bot.send(url, channel);
        return;
      }
      // display the wikipedia search result
      if (summary !== '') {
        bot.send(url, channel);
        let paragraphs = summary.split('\n');
        paragraphs.forEach((paragraph) => {
          if (paragraph !== '') {
            bot.send(`> ${paragraph}`, channel);
          }
        });
      } else {
        bot.send('I\'m sorry, I couldn\'t find anything on that subject. Try another one!', channel);
      }
    });
  }, true);

  bot.respondTo('test', (message, channel) => {
    bot.setTypingIndicator(message.channel);
    setTimeout(() => {
      bot.send('Not typing anymore!', channel);
    }, 1000);
  }, true);
}
//-------------------------------------------------------------------------------------
