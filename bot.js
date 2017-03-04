'use strict'

const RtmClient = require('@slack/client').RtmClient;
const MemoryDataStore = require('@slack/client').MemoryDataStore;
const CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
const RTM_EVENTS = require('@slack/client').RTM_EVENTS;

class Bot {
  constructor(opts) {
    let slackToken = opts.token;
    let autoReconnect = opts.autoReconnect || true;
    let autoMark = opts.autoMark || true;

    this.slack = new RtmClient(slackToken, {
      // sets the level of logging required
      logLevel: 'error',
      // initialize a data store for my client,
      // this will load additional helper functions for the storing and retrieval of data
      dataStore: new MemoryDataStore(),
      // Boolean indicating whether Slack should automatically
      // reconnect after error response
      autoReconnect: autoReconnect,
      // Boolean indicating whether each message should be marked
      // as read or not after it is processed
      autoMark: autoMark
    });

    this.slack.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, () => {
      let user = this.slack.dataStore.getUserById(this.slack.activeUserId);
      let team = this.slack.dataStore.getTeamById(this.slack.activeTeamId);
      this.name = user.name;
      console.log(`Connected to ${team.name} as ${user.name}`);
    });

    // create an es6 Map to store our regular expressions
    this.keywords = new Map();

    this.slack.on(RTM_EVENTS.MESSAGE, (message) => {
      // only process text messages
      if (!message.text) {
        return;
      }

      let channel = this.slack.dataStore.getChannelGroupOrDMById(message.channel);
      let user = this.slack.dataStore.getUserById(message.user);

      // loop over the keys of the keywords Map object and test each
      // regular expression against the message's text property
      for (let regex of this.keywords.keys()) {
        if (regex.test(message.text)) {
          let callback = this.keywords.get(regex);
          callback(message, channel, user);
        }
      }
    });

    this.slack.start();
  };

  // send a message to a channel, with an optional callback
  send(message, channel, cb) {
    this.slack.sendMessage(message, channel.id, () => {
      if (cb) {
        cb();
      }
    });
  }

  respondTo(keywords, callback, start) {
    // If 'start' is truthy, prepend the '^' anchor to instruct the
    // expression to look for matches at the beginning of the string
    if (start) {
      keywords = '^' + keywords;
    }
    // create a new regular expression, setting the case
    // insensitive (i) flag
    let regex = new RegExp(keywords, 'i');
    // set the regular expression to be the key with the callback
    // function as the value
    this.keywords.set(regex, callback);
  }

  getMembersbyChannel(channel) {
    // if the channel has no members then that means we're in a DM
    if (!channel.members) {
      return false;
    }
    // only select members which are active and not a bot
    let members = channel.members.filter((member) => {
      let m = this.slack.dataStore.getUserById(member);
      // make sure member is active (i.e. not set to 'away' status)
      return (m.presence === 'active' && !m.is_bot);
    });

    // get the names of the members
    members = members.map((member) => {
      return this.slack.dataStore.getUserById(member).name;
    });
    return members;
  }

  setTypingIndicator(channel) {
    this.slack.send({
      id: 1,
      type: 'typing',
      channel: channel
    })
  }
};

//export bot class
module.exports = Bot;
