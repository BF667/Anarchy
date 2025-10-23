const moment = require("moment-timezone");
moment.locale(global.locale);

module.exports = (type, title, message) => {
  const date = moment.tz(global.timezone).format("dddd, DD MMMM YYYY");
  const time = moment.tz(global.timezone).format("HH:mm:ss");
  let color = Math.floor(Math.random() * 10);
  switch (type.toLowerCase()) {
    case "primary":
      color = 4;
      break;
    case "success":
      color = 2;
      break;
    case "info":
      color = 6;
      break;
    case "error":
      color = 1;
      break;
  }
  console.log(
    `\x1b[1;4${color}m\x20${botName}\x20\x1b[0m\x20\x20${time}\x20\x20\x1b[1;4${color}m\x20\x1b[0m\n\x1b[1;4${color}m\x20\x1b[0m\x20${date}\x20\x1b[1;4${color}m\x20\x1b[0m\n\x1b[1;4${color}m\x20${title}\x20\x1b[0m\x20\x20${message}\x20\x1b[1;4${color}m\x20\x1b[0m\n`
  );
};
