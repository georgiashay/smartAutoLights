const Sequelize = require("sequelize");
const remoteTables = require("./../remoteTables.js");
// const savePixels = require("save-pixels");
// const zeros = require("zeros");
// const ndarray = require("ndarray");
const Jimp = require("Jimp");

Promise.all([
  remoteTables.Light.findAll(),
  remoteTables.StateChange.findAll()
]).then(function(results) {
  var lights = results[0].map(function(l) {return l.dataValues});
  var statechanges = results[1].map(function(s) {return s.dataValues});
  // console.log(lights);
  // console.log(statechanges);
  var dc = getDayChunks(statechanges, lights);
  var dayArrays = getDayArrays(lights, dc);
  var averageDay = getAverageDay(dayArrays);
  var randomDay = addRandomness(averageDay);
  getImage(randomDay, "random");
})


function getDayChunks(statedata, lights) {
  //going to be like:
  // statedata {object_id, newstate, date}
  // lights {object_id, type, name, state}
  statedata = statedata.map(function(statechange) {
    statechange.date = new Date(statechange.date + " UTC");
    return statechange;
  });

  statedata.sort(function(d1, d2) {
    return d1.date - d2.date;
  });

  var minStateDate = Math.floor(statedata[0].date/8.64e7);
  var maxStateDate = Math.floor(statedata[statedata.length-1].date/8.64e7);


  var chunkedStateData = [];
  for(var day = minStateDate; day <= maxStateDate; day++) {
    var dayChunk = statedata.filter(function(d) {
      return Math.floor(d.date/8.64e7) == day;
    });
    chunkedStateData.push(dayChunk);
  }

  var rangesPerLight = {};
  for(var light = 0; light < lights.length; light++) {
    var dayRanges = [];
    for(var day = 0; day < chunkedStateData.length; day++) {
      var dayLightStateData = chunkedStateData[day].filter(function(sd) {return sd.object_id == lights[light].object_id});
      var currentMinute = 0;
      var statusLengths = [];
      for(var i = 0; i <  dayLightStateData.length; i++) {
        var updatedStatus = dayLightStateData[i];
        var timeStatusChanged = updatedStatus.date.getMinutes()+60*updatedStatus.date.getHours();
        var minutesOnLastStatus = timeStatusChanged - currentMinute;
        var lastStatus = !updatedStatus.newState;
        statusLengths.push({
          status: lastStatus,
          slength: minutesOnLastStatus
        });
        currentMinute = timeStatusChanged;
      }
      if(dayLightStateData.length) {
        var minutesToEndOfDay = 1440 - currentMinute;
        statusLengths.push({
          status: dayLightStateData[dayLightStateData.length-1].newState,
          slength: minutesToEndOfDay
        });
      } else {
        var currentStatus = lights[light].state;
        statusLengths.push({
          status: currentStatus,
          slength: 1440
        });
      }
      dayRanges.push(statusLengths);
    }
    rangesPerLight[lights[light].object_id]=dayRanges;
  }
  return rangesPerLight;
}

function getDayArrays(lights, dayChunks) {
  var numChunks = dayChunks[lights[0].object_id].length;
  //create array
  var dayArrays = [];
  for(var d = 0; d < numChunks; d++) {
    var stateArray = [];
    for(var i = 0; i < lights.length; i++) {
      var states = Array(1440).fill(0);
      var currentIndex = 0;
      for(var l = 0; l < dayChunks[lights[i].object_id][d].length; l++) {
        var statusAndLength = dayChunks[lights[i].object_id][d][l];
        var intState = statusAndLength.status ? 1 : 0;
        states.fill(intState, currentIndex, currentIndex + statusAndLength.slength);
        currentIndex = currentIndex + statusAndLength.slength;
      }
      stateArray.push(states);
    }
    dayArrays.push(stateArray);
    //savePixels(statend, "png").pipe(process.stdout);
  }
  return dayArrays;
}

function getImage(dayArray, addon) {
  var numLights = dayArray[0].length;
  let image = new Jimp(1440, numLights, function (err, image) {
    if (err) throw err;

    dayArray.forEach((row, y) => {
      row.forEach((color, x) => {
        var colorInt = Math.min(255,Math.floor(color*256));
        // console.log(Jimp.rgbaToInt(colorInt, colorInt, colorInt, 255));
        image.setPixelColor(Jimp.rgbaToInt(colorInt, colorInt, colorInt, 255), x, y);
      });
    });

    image.write('./resultingImages/Day ' + addon +  '.png', (err) => {
      if (err) throw err;
    });
  });

}

function getImages(lights, dayChunks, addon) {
  var dayArrays = getDayArrays(lights, dayChunks);
  for(var d = 0; d < dayArrays.length; d++) {
    let image = new Jimp(1440, lights.length, function (err, image) {
      if (err) throw err;

      dayArrays[d].forEach((row, y) => {
        row.forEach((color, x) => {
          var colorInt = Math.floor(color*256);
          console.log(Jimp.rgbaToInt(colorInt, colorInt, colorInt, 255));
          image.setPixelColor(color ? 0xFFFFFFFF : 0x000000FF, x, y);
        });
      });

      image.write('./resultingImages/Day ' + d + ' ' + addon +  '.png', (err) => {
        if (err) throw err;
      });
    });
  }
}

function getAverageDay(dayArrays) {
  var numLights = dayArrays[0].length;
  var averageDay = [];
  for(var l = 0; l < numLights; l++) {
    var averageDayForLight = [];
    for(var m = 0; m < 1440; m++) {
      var allValuesForLightAndMinute = dayArrays.map(function(d) {
        return d[l][m];
      });
      var sum = 0;
      for(var i = 0; i < allValuesForLightAndMinute.length; i++) {
        sum += allValuesForLightAndMinute[i];
      }
      var average = sum/allValuesForLightAndMinute.length;
      averageDayForLight.push(average);
    }
    averageDay.push(averageDayForLight);
  }

  return averageDay;
}

function addRandomness(averageDay) {
  var randomDay = averageDay.slice(0);
  var randomStrengths = [[5, 200, 1.5], [10, 90, 1], [10, 60, 0.75]];
  for(var l = 0; l < randomDay.length; l++) {
    for(var r = 0; r < randomStrengths.length; r++) {
      var numRandoms = Math.floor(Math.random()*randomStrengths[r][0]);
      for(var n = 0; n < numRandoms; n++) {
        var randomPos = Math.floor(Math.random()*1440);
        var randomLength = Math.floor(Math.random()*randomStrengths[r][1]);
        var randomValue = Math.random();
        var randomAdditive = (randomValue*2-1)*randomStrengths[r][2];
        for(var i = randomPos; i < Math.min(randomPos+randomLength, 1440); i++) {
          randomDay[l][i] = Math.max(0,Math.min(1, randomDay[l][i]+randomAdditive));
        }
      }
    }
    // var numBigRandoms = Math.floor(Math.random()*5);
    // for(var n = 0; n < numBigRandoms; n++) {
    //   var bigRandomPos = Math.floor(Math.random()*1440);
    //   var bigRandomLength = Math.floor(Math.random()*60);
    //   var randomValue = Math.random();
    //   var randomAdditive = (randomValue * 2 - 1)/2;
    //   for(var i = bigRandomPos; i < Math.min(bigRandomPos+bigRandomLength, 1440); i++) {
    //     randomDay[l][i] = Math.max(0,Math.min(1, randomDay[l][i]+randomAdditive));
    //   }
    // }
    // for(var m = 0; m < 1440; m++) {
    //   var randomNoise = (Math.random()*2 - 1)/4;
    //   randomDay[l][m] = Math.max(0, Math.min(1, randomDay[l][m]+randomNoise));
    // }
  }
  return randomDay;
}
