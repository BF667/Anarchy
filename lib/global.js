const fs = require("fs");

global.dev = process.env.NODE_ENV === "development";

global.botName = "Anarchy Based V1";
global.botNumber = "6285124252139";

global.owner = {
  name: "Rico Ardiansyah",
  number: "6283150958207",
  social: [
    {
      name: "Github",
      url: "https://github.com/BF667",
    },
  ],
};

global.useStore = true;
global.online = true;
global.prefixCommand = ".";
global.splitArgs = "|";
global.locale = "id_ID";
global.timezone = "Asia/Jakarta";
global.inviteCode = "";

global.image = {
  logo: "",
};

global.setting = JSON.parse(fs.readFileSync("./lib/setting.json"));
global.save = (name, data) => {
  switch (name.toLowerCase()) {
    case "setting": {
      fs.writeFileSync("./config/setting.json", JSON.stringify(data));
      return data;
    }
  }
};

global.mess = {
  dev: "Masih dalam tahap pengembangan",
};
