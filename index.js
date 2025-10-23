(function start() {
  const child = require("child_process")
    .spawn(process.argv0, ["main.js", ...process.argv.slice(2)], {
      stdio: ["inherit", "inherit", "inherit", "ipc"],
    })
    .on("message", (msg) => {
      if (msg === "restart") {
        child.kill();
        start();
        delete child;
      }
      if (msg === "exit") {
        child.kill();
        delete child;
      }
    })
    .on("exit", (code) => {
      if (code) {
        child.kill();
        start();
        delete child;
      }
    })
    .on("error", console.log);
})();
