const fs = require("fs");

global.dev = process.env.NODE_ENV === "development";

global.botName = "Anarchy Based V1";
global.botNumber = "6282135214781";

global.owner = {
  name: "Rico Ardiansyah",
  number: "",
  social: [
    {
      name: "example",
      url: "https://example.com",
    },
  ],
};

global.useStore = true;
global.online = false;
global.prefixCommand = ".";
global.splitArgs = "|";
global.locale = "id_ID";
global.timezone = "Asia/Jakarta";
global.inviteCode = "";

global.image = {
  logo: "https://files.catbox.moe/h6log1.png",
};

global.setting = JSON.parse(fs.readFileSync("./config/setting.json"));
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
