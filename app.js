const express = require("express");
const app = express();

app.use(express.static(__dirname));

app.listen(3080, () => {
  console.log("Server running at http://localhost:3080");
});
