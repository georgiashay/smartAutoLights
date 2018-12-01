const tables = require("./tables.js");
const queryDevices = require("./queryDevices.js");
const Sequelize = require("sequelize");

const nonObjectIDs = [
  "uuid",
  "manufacturer_device_id",
  "upc_id",
  "gang_id",
  "hub_id",
  "local_id",
  "linked_service_id"
];

async function recordActivityLog() {
  console.log("recording activity log");
  queryDevices.requestStates().then(function(deviceJson) {
    var devices = deviceJson.data;
    var currentDevices = [];
    for(var i = 0; i < devices.length; i++) {
      var currentDevice = {};
      var currentDeviceID = "";
      if(devices[i]["remote_id"]==undefined&&!devices[i]["manufacturer_device_model"].includes("wink")) {
        if(devices[i]["object_id"]!=undefined && devices["object_type"]!=undefined) {
          currentDeviceID = devices[i]["object_id"];
          currentDevice["object_type"] = devices[i]["object_type"];
        } else {
          var objectProperties = Object.keys(devices[i]);
          var idProperty = objectProperties.filter(function(prop){
            return !nonObjectIDs.includes(prop) && /_id$/.test(prop);
          });
          if(idProperty.length==1) {
            currentDeviceID = devices[i][idProperty[0]];
            currentDevice["object_type"] = idProperty[0].slice(0,-3);
          }
        }
        currentDevice["state"] = devices[i].last_reading.powered;
        currentDevice["name"] = devices[i].name;
        currentDevices.push({device: currentDevice, id: currentDeviceID});
      }

    }
    Promise.all(currentDevices.map(function(d) {return tables.Light.findOne({where: {object_id: d.id}})}))
    .then(function(lights){
      // console.log(lights.map(function(l) {
      //   if(l!=null) {
      //     return l.dataValues;
      //   } else {
      //     return null;
      //   }
      // }));
      for(var i = 0; i < lights.length; i++) {
        if(lights[i]==null) {
          var newDevice = currentDevices[i].device;
          newDevice.object_id = currentDevices[i].id;
          tables.Light.create(newDevice);
        } else {
          if(lights[i].state != currentDevices[i].device.state) {
            console.log("state changed for " + lights[i].name);
            console.log(currentDevices[i]);
            tables.StateChange.create({
              object_id: currentDevices[i].id,
              newState: currentDevices[i].device.state,
              date: Sequelize.literal("NOW()")
            }).catch(function(err){throw(err);});
            tables.Light.update(
              currentDevices[i].device,
              {where: {object_id: lights[i].object_id}},
            ).catch(function(err){throw(err);});
          }
        }
      }
    })
  }).catch(function(err){
    throw(err);
  })
}

setInterval(recordActivityLog,1000*60);
