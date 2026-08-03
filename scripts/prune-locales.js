const fs = require("fs");
const path = require("path");

exports.default = async function afterPack(context) {
  const { appOutDir } = context;
  const localesDir = path.join(appOutDir, "locales");
  if (!fs.existsSync(localesDir)) return;

  const keep = ["en-US.pak"];
  for (const file of fs.readdirSync(localesDir)) {
    if (!keep.includes(file)) {
      fs.unlinkSync(path.join(localesDir, file));
    }
  }
  console.log(`Pruned locale files in ${localesDir}, kept: ${keep.join(", ")}`);
};
