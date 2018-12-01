var accessTokenData = require("./accessToken.json");
var request = require("request");

var options = {
  url: "https://api.wink.com/users/me/wink_devices",
  headers: {
    "Authorization": "Bearer " + accessTokenData.access_token
  }
}

request(options, function(error, response, body) {
  if (!error && response.statusCode == 200) {
    var info = JSON.parse(body);
    console.log(info);
  } else {
    console.log(error);
  }
});
